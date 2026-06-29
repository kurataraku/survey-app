import { after, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logConsultationChat } from '@/lib/consultation-chat/log';
import {
  CHAT_MODEL_MAIN,
  CHAT_MODEL_ROUTER,
  chooseGenerationModel,
  getChatOpenAIClient,
} from '@/lib/chat/config';
import {
  fetchActiveSchoolsByCampusArea,
  fetchRagDocumentsBySchoolNames,
  fetchRagDocumentsBySchoolIds,
  fetchRagDocumentsByKeywords,
  inferReasonGroupFromText,
  rerankForGuardianConsultation,
  searchRagDocuments,
} from '@/lib/rag/retrieval';
import type { RagMatchRow } from '@/lib/rag/types';
import { appPath } from '@/lib/base-path';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(6000),
});

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(30),
  session_id: z.string().max(128).optional(),
  source: z.string().max(64).optional(),
  page_url: z.string().max(2000).optional(),
});

const RouterResultSchema = z.object({
  query: z.string().min(1).max(600),
  prefecture: z.string().nullable().optional(),
  reason_group: z
    .enum(['mental_relationship', 'learning_style', 'health_development'])
    .nullable()
    .optional(),
  school_name: z.string().nullable().optional(),
  difficulty: z.enum(['low', 'high']).default('low'),
});

type ChatIntent =
  | 'school_recommendation'
  | 'procedure_explanation'
  | 'style_comparison'
  | 'general_advice';
type FocusProfile = {
  keywords: string[];
  label: string;
  regex: RegExp;
  instruction: string;
};
type AreaProfile = {
  label: string;
  prefecture: string;
  cities: string[];
  keywords: string[];
};
type BroadRegionProfile = {
  label: string;
  prefectures: string[];
  keywords: string[];
};

const TOKYO_TAMA_CITIES = [
  '八王子市',
  '立川市',
  '武蔵野市',
  '三鷹市',
  '青梅市',
  '府中市',
  '昭島市',
  '調布市',
  '町田市',
  '小金井市',
  '小平市',
  '日野市',
  '東村山市',
  '国分寺市',
  '国立市',
  '福生市',
  '狛江市',
  '東大和市',
  '清瀬市',
  '東久留米市',
  '武蔵村山市',
  '多摩市',
  '稲城市',
  '羽村市',
  'あきる野市',
  '西東京市',
];

const TOKYO_23_WARDS = [
  '千代田区',
  '中央区',
  '港区',
  '新宿区',
  '文京区',
  '台東区',
  '墨田区',
  '江東区',
  '品川区',
  '目黒区',
  '大田区',
  '世田谷区',
  '渋谷区',
  '中野区',
  '杉並区',
  '豊島区',
  '北区',
  '荒川区',
  '板橋区',
  '練馬区',
  '足立区',
  '葛飾区',
  '江戸川区',
];

const TACHIKAWA_NEARBY_CITIES = [
  '立川市',
  '国立市',
  '国分寺市',
  '昭島市',
  '日野市',
  '小平市',
  '東大和市',
  '武蔵村山市',
  '府中市',
  '八王子市',
];

function truncate(text: string, maxLength = 360): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function estimateDifficultyFromText(text: string): 'low' | 'high' {
  const hardKeywords = ['比較', 'どっち', 'どちら', '複数', '候補', '優先順位', '迷って', '不安'];
  const hit = hardKeywords.some((word) => text.includes(word));
  if (hit || text.length > 140) return 'high';
  return 'low';
}

function isLowAttendancePreference(text: string): boolean {
  return (
    /年[に\s]*(?:1|2|3|１|２|３|一|二|三)[,，、〜~・\-－]*(?:2|3|２|３|二|三)?回.*(?:通学|登校|スクーリング)/u.test(text) ||
    /(?:通学|登校|スクーリング).{0,12}年[に\s]*(?:1|2|3|１|２|３|一|二|三)[,，、〜~・\-－]*(?:2|3|２|３|二|三)?回/u.test(text) ||
    /集中スクーリング|年数回|年に数回|年数日の登校|合宿型スクーリング/u.test(text)
  );
}

function isConciseRequest(text: string): boolean {
  return /簡単に|短く|要約|一言|ひとことで|3行|三行|箇条書きだけ/u.test(text);
}

function isFollowUpRefinement(text: string): boolean {
  const trimmed = text.trim();
  return (
    /^(それ|そこ|その|じゃあ|では|なら|あと|他|ほか|別|追加|具体|詳しく|比較|候補|おすすめ|近い|通える|関東|都内|東京都|週|月|年|理系|文系)/u.test(trimmed) ||
    /^(東京都|神奈川県|埼玉県|千葉県|茨城県|栃木県|群馬県|関東)$/u.test(trimmed) ||
    /在住|週\s*[0-9０-９一二三四五六七]|年[に\s]*(?:1|2|3|１|２|３|一|二|三).*通学|通学.*(?:希望|できる|少な)|についてどう|は.*(?:どう|強い|合う|向いて)/u.test(trimmed)
  );
}

function getRecentUserMessages(messages: Array<z.infer<typeof MessageSchema>>): string[] {
  return messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content);
}

function getSearchBasisMessage(messages: Array<z.infer<typeof MessageSchema>>, latest: string): string {
  const recentUsers = getRecentUserMessages(messages);
  const previousUsers = recentUsers.filter((content) => content !== latest);
  if (previousUsers.length === 0) return latest;
  if (isConciseRequest(latest)) {
    return `${previousUsers.slice(-3).join('\n')}\n回答の長さ指定: ${latest}`;
  }
  if (isFollowUpRefinement(latest)) {
    return recentUsers.slice(-4).join('\n追加条件: ');
  }
  return latest;
}

function detectAreaProfile(text: string): AreaProfile | null {
  if (/立川|国立|昭島|日野|国分寺/u.test(text)) {
    return {
      label: '立川市近辺',
      prefecture: '東京都',
      cities: TACHIKAWA_NEARBY_CITIES,
      keywords: ['立川', '国立', '国分寺', '昭島', '日野', '多摩', 'キャンパス', '校舎'],
    };
  }
  if (/多摩地区|多摩エリア|多摩地域|多摩の/u.test(text)) {
    return {
      label: '多摩地区',
      prefecture: '東京都',
      cities: TOKYO_TAMA_CITIES,
      keywords: ['多摩地区', '多摩', '八王子', '立川', '町田', '府中', 'キャンパス', '校舎'],
    };
  }
  if (/東京都心|都心|23区|二十三区/u.test(text)) {
    return {
      label: '東京都心・23区',
      prefecture: '東京都',
      cities: TOKYO_23_WARDS,
      keywords: ['東京都心', '23区', '新宿', '渋谷', '池袋', '秋葉原', 'キャンパス', '校舎'],
    };
  }
  return null;
}

function detectBroadRegionProfile(text: string): BroadRegionProfile | null {
  if (/関東/u.test(text)) {
    return {
      label: '関東',
      prefectures: ['東京都', '神奈川県', '埼玉県', '千葉県', '茨城県', '栃木県', '群馬県'],
      keywords: [
        '関東',
        '東京',
        '神奈川',
        '埼玉',
        '千葉',
        '茨城',
        '栃木',
        '群馬',
        'キャンパス',
        '校舎',
      ],
    };
  }
  return null;
}

function detectMentionedSchoolNames(text: string): string[] {
  const aliases: Array<[RegExp, string]> = [
    [/(^|[、,\s])N高(等学校|校)?/i, 'N高等学校'],
    [/(^|[、,\s])S高(等学校|校)?/i, 'S高等学校'],
    [/クラーク|Clark/i, 'クラーク記念国際高等学校'],
    [/鹿島学園/, '鹿島学園高等学校'],
    [/駿台\s*i|駿台i高等学校|駿台i高等学院/i, '駿台i高等学院'],
    [/第一高等学院|第一学院|第一学院高等学校/u, '第一学院高等学校'],
    [/トライ式|トライ式高等学院/u, 'トライ式高等学院'],
  ];
  const names: string[] = [];
  for (const [pattern, schoolName] of aliases) {
    if (pattern.test(text) && !names.includes(schoolName)) names.push(schoolName);
  }
  return names;
}

function detectFocusProfile(text: string): FocusProfile | null {
  if (isLowAttendancePreference(text)) {
    return {
      keywords: [
        '年数回',
        '年に数回',
        '年1回',
        '年2回',
        '年3回',
        '集中スクーリング',
        '合宿型スクーリング',
        'オンライン',
        '自宅学習',
        '通学少ない',
      ],
      label: '年数回・低頻度通学',
      regex: /年数回|年に数回|年[に\s]*(?:1|2|3|１|２|３|一|二|三)[,，、〜~・\-－]*(?:2|3|２|３|二|三)?回|集中スクーリング|合宿型スクーリング|オンライン|自宅学習|通学.*少な/u,
      instruction:
        '年数回・低頻度通学が主訴です。候補校は、集中スクーリング、オンライン中心、自宅学習、最少登校日数、振替対応に関する根拠がある学校を優先してください。年1〜3回で確実に卒業できると断定せず、公式日程と卒業要件の確認を促してください。',
    };
  }
  if (/就職|就活|キャリア|求人|職業|資格|専門職|インターン/.test(text)) {
    return {
      keywords: [
        '就職',
        '就活',
        'キャリア',
        '求人',
        '職業',
        '資格',
        '面接',
        '履歴書',
        '企業連携',
        'インターン',
      ],
      label: '就職・キャリア支援',
      regex: /就職|就活|キャリア|求人|職業|資格|面接|履歴書|企業連携|インターン|専門職/u,
      instruction:
        '就職・キャリア支援が主訴です。候補校は、資格取得、職業体験、企業連携、求人紹介、面接・履歴書指導、卒業後の進路相談に関する口コミ根拠がある学校を優先してください。',
    };
  }
  if (/大学|受験|進学|指定校|推薦|総合型|AO|模試|予備校|進路/.test(text)) {
    return {
      keywords: ['大学', '受験', '進学', '指定校', '推薦', '総合型', '模試', '予備校', '進路'],
      label: '大学受験・進学',
      regex: /大学|受験|進学|指定校|推薦|総合型|AO|模試|予備校|進路|面接練習|志望理由|合格/u,
      instruction:
        '大学受験・進学が主訴です。候補校は、進路相談・大学合格・受験時間の確保・指定校推薦・面接練習・模試・予備校連携など、進学に直接関係する口コミ根拠がある学校を優先してください。',
    };
  }
  if (/朝|起きられ|起きれ|午前|午後|睡眠|起立性|体調|低血圧/.test(text)) {
    return {
      keywords: ['朝', '起きられ', '午前', '午後', '睡眠', '起立性', '体調', 'オンライン', '振替'],
      label: '朝起きられない・体調面',
      regex: /朝|起きられ|起きれ|午前|午後|睡眠|起立性|体調|低血圧|オンライン|自宅|振替|スクーリング/u,
      instruction:
        '朝起きられない・体調面が主訴です。候補校は、登校時間の柔軟性、オンライン代替、振替スクーリング、体調への配慮、生活リズムの伴走に関する口コミ根拠がある学校を優先してください。',
    };
  }
  if (/勉強|学習|遅れ|遅れて|追いつ|基礎|レポート|単位/.test(text)) {
    return {
      keywords: ['勉強', '学習', '遅れ', '基礎', 'レポート', '単位', '補習', '個別', '添削'],
      label: '学習遅れ・学び直し',
      regex: /勉強|学習|遅れ|追いつ|基礎|レポート|単位|補習|個別|添削|伴走/u,
      instruction:
        '学習遅れ・学び直しが主訴です。候補校は、基礎からの学び直し、レポート提出支援、個別フォロー、補習、添削に関する口コミ根拠がある学校を優先してください。',
    };
  }
  if (/不登校|学校に行け|登校でき|人間関係|不安/.test(text)) {
    return {
      keywords: ['不登校', '登校', '人間関係', '不安', '先生', '面談', '少人数', '居場所'],
      label: '不登校・人間関係',
      regex: /不登校|登校|人間関係|不安|先生|面談|少人数|居場所|友人|寄り添/u,
      instruction:
        '不登校・人間関係が主訴です。候補校は、少人数、先生の寄り添い、面談、登校再開、居場所づくりに関する口コミ根拠がある学校を優先してください。',
    };
  }
  return null;
}

function detectChatIntent(text: string): ChatIntent {
  const area = detectAreaProfile(text);
  const broadRegion = detectBroadRegionProfile(text);
  const mentionedSchoolNames = detectMentionedSchoolNames(text);
  const hasConcreteSelectionCriteria =
    Boolean(detectPrefecture(text) || area || broadRegion) &&
    /週\s*[0-9０-９]|週[一二三四五六七]|\d[-〜~]\d通学|通学|登校|評定|友達|発達|サポート|進学|受験|就職|就活|不登校|安心/u.test(
      text
    );
  const lowAttendanceSchoolRequest =
    isLowAttendancePreference(text) && /高校|学校|探|いい|希望|おすすめ|お勧め/u.test(text);
  const criteriaSchoolRequest =
    /(?:通信制高校|通信制の高校|高校|学校)/u.test(text) &&
    /強い|力がある|サポート|交流|同年代|就職|就活|キャリア|進学|受験|不登校|スポーツ|勉強|学習|通学|登校|家から出|合う|向いて/u.test(
      text
    );
  const singleSchoolEvaluation =
    mentionedSchoolNames.length > 0 &&
    /どう|考え|強い|評判|口コミ|合う|向いて|有効|比較|知りたい|教えて/u.test(text);
  const wantsSchools =
    /おすすめ|お勧め|薦め|すすめ|候補|学校.*(教えて|探し|探して|知りたい)|高校.*(教えて|探し|探して|知りたい)|探しています|探してます|どこ|通える|合う.*学校|いい高校|いい学校/u.test(
      text
    ) ||
    mentionedSchoolNames.length >= 2 ||
    singleSchoolEvaluation ||
    lowAttendanceSchoolRequest ||
    criteriaSchoolRequest ||
    hasConcreteSelectionCriteria;
  const procedureTerms =
    /退学|転校|転入|編入|新入学|在籍|単位|卒業時期|留年|手続き|書類|成績証明|在学証明|入学時期|受付期間/;
  if (procedureTerms.test(text) && !wantsSchools) return 'procedure_explanation';
  const comparesLearningStyle =
    /オンライン中心|オンライン.*通学|通学型|登校型|通学.*オンライン|毎日通う|どちらがいい|どっちがいい/.test(
      text
    );
  if (comparesLearningStyle && !wantsSchools) return 'style_comparison';
  if (wantsSchools) return 'school_recommendation';
  return 'general_advice';
}

function detectPrefecture(text: string): string | null {
  const area = detectAreaProfile(text);
  if (area) return area.prefecture;

  const aliases: Array<[string, string]> = [
    ['東京', '東京都'],
    ['都内', '東京都'],
    ['神奈川', '神奈川県'],
    ['大阪', '大阪府'],
    ['京都', '京都府'],
    ['兵庫', '兵庫県'],
    ['埼玉', '埼玉県'],
    ['千葉', '千葉県'],
    ['愛知', '愛知県'],
    ['福岡', '福岡県'],
  ];
  for (const [keyword, prefecture] of aliases) {
    if (text.includes(keyword)) return prefecture;
  }

  const prefectures = [
    '北海道',
    '青森県',
    '岩手県',
    '宮城県',
    '秋田県',
    '山形県',
    '福島県',
    '茨城県',
    '栃木県',
    '群馬県',
    '埼玉県',
    '千葉県',
    '東京都',
    '神奈川県',
    '新潟県',
    '富山県',
    '石川県',
    '福井県',
    '山梨県',
    '長野県',
    '岐阜県',
    '静岡県',
    '愛知県',
    '三重県',
    '滋賀県',
    '京都府',
    '大阪府',
    '兵庫県',
    '奈良県',
    '和歌山県',
    '鳥取県',
    '島根県',
    '岡山県',
    '広島県',
    '山口県',
    '徳島県',
    '香川県',
    '愛媛県',
    '高知県',
    '福岡県',
    '佐賀県',
    '長崎県',
    '熊本県',
    '大分県',
    '宮崎県',
    '鹿児島県',
    '沖縄県',
  ];
  for (const pref of prefectures) {
    if (text.includes(pref)) return pref;
  }
  return null;
}

function buildSearchQuery(latestUserMessage: string): string {
  const fragments = [latestUserMessage];
  const area = detectAreaProfile(latestUserMessage);
  const broadRegion = detectBroadRegionProfile(latestUserMessage);
  if (area) {
    fragments.push(
      `${area.label} ${area.prefecture} ${area.keywords.join(' ')} ${area.cities.slice(0, 12).join(' ')} 通信制高校 キャンパス 校舎`
    );
  }
  if (broadRegion) {
    fragments.push(
      `${broadRegion.label} ${broadRegion.prefectures.join(' ')} ${broadRegion.keywords.join(' ')} 通信制高校 キャンパス 校舎`
    );
  }
  const mentionedSchools = detectMentionedSchoolNames(latestUserMessage);
  if (mentionedSchools.length > 0) {
    fragments.push(`${mentionedSchools.join(' ')} 比較 違い 口コミ 学習スタイル 進路 サポート`);
  }
  if (isLowAttendancePreference(latestUserMessage)) {
    fragments.push(
      '年数回 年に数回 年1回 年2回 年3回 通学 登校 集中スクーリング 合宿型スクーリング オンライン 自宅学習 最少登校日数'
    );
  }
  if (/大学|受験|進学|指定校|推薦|総合型|AO|模試|予備校|進路/.test(latestUserMessage)) {
    fragments.push(
      '大学受験 進学 指定校推薦 総合型選抜 進路指導 模試 予備校 個別指導 受験対策'
    );
  }
  if (/就職|就活|キャリア|求人|職業|資格|専門職|インターン/.test(latestUserMessage)) {
    fragments.push(
      '就職 就活 キャリア 求人 職業 資格 面接 履歴書 企業連携 インターン 進路指導'
    );
  }
  if (/退学|転校|転入|編入|新入学|在籍|単位|卒業時期|留年|手続き|書類/.test(latestUserMessage)) {
    fragments.push(
      '転入 編入 新入学 退学 単位認定 在籍 成績証明 在学証明 卒業時期 手続き'
    );
  }
  if (/朝|起きられ|起きれ|午前|午後|睡眠|起立性|体調|低血圧/.test(latestUserMessage)) {
    fragments.push(
      '朝起きられない 起立性調節障害 体調 午後登校 登校時間 柔軟 オンライン 振替 スクーリング'
    );
  }
  if (/勉強|学習|遅れ|遅れて|追いつ|基礎|レポート|単位/.test(latestUserMessage)) {
    fragments.push(
      '学習の遅れ 基礎から 個別フォロー レポート提出 サポート 少人数 補習'
    );
  }
  if (/不登校|学校に行け|登校でき|人間関係|不安/.test(latestUserMessage)) {
    fragments.push('不登校経験 登校再開 心身サポート 居場所 先生の寄り添い');
  }
  return fragments.join(' ');
}

async function routeQuery(
  conversationText: string,
  latestUserMessage: string
): Promise<z.infer<typeof RouterResultSchema>> {
  const fallback: z.infer<typeof RouterResultSchema> = {
    query: buildSearchQuery(latestUserMessage),
    prefecture: detectPrefecture(latestUserMessage) ?? detectPrefecture(conversationText),
    reason_group: inferReasonGroupFromText(latestUserMessage),
    school_name: null,
    difficulty: estimateDifficultyFromText(latestUserMessage),
  };

  if (process.env.CHAT_ENABLE_ROUTER_LLM !== 'true') return fallback;

  const openai = getChatOpenAIClient();

  try {
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL_ROUTER,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'あなたは検索ルーターです。保護者向け学校相談の文脈を読み、検索に使う条件のみをJSONで返してください。' +
            '出力は query, prefecture, reason_group, school_name, difficulty のみ。difficulty は low/high。',
        },
        {
          role: 'user',
          content: `会話:\n${conversationText}\n\n最新ユーザー発話:\n${latestUserMessage}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return RouterResultSchema.parse({
      ...fallback,
      ...parsed,
    });
  } catch {
    return fallback;
  }
}

function buildContextBlock(docs: RagMatchRow[]): string {
  return docs
    .map((doc, index) => {
      const score = Number.isFinite(doc.score) ? doc.score.toFixed(3) : '0.000';
      const reasonGroupText = Array.isArray(doc.reason_groups) ? doc.reason_groups.join(', ') : '';
      return [
        `[doc_${index + 1}]`,
        `source_type: ${doc.source_type}`,
        `title: ${doc.title}`,
        doc.school_name ? `school: ${doc.school_name}` : null,
        doc.prefecture ? `prefecture: ${doc.prefecture}` : null,
        reasonGroupText ? `reason_groups: ${reasonGroupText}` : null,
        `score: ${score}`,
        `content: ${truncate(doc.content, 320)}`,
      ]
        .filter((v): v is string => Boolean(v))
        .join('\n');
    })
    .join('\n\n');
}

function isLocalPublicSchoolName(schoolName: string): boolean {
  return /県立|都立|府立|市立|区立|町立|村立|公立/.test(schoolName);
}

function extractRelevantSnippet(text: string, regex?: RegExp): string {
  if (!regex) return truncate(text, 120);
  const match = regex.exec(text);
  regex.lastIndex = 0;
  if (!match?.index && match?.index !== 0) return truncate(text, 120);
  const start = Math.max(match.index - 45, 0);
  return truncate(text.slice(start), 140);
}

function focusHitCount(text: string, regex?: RegExp): number {
  if (!regex) return 0;
  const matches = text.match(new RegExp(regex.source, 'gu'));
  return matches?.length ?? 0;
}

function buildCandidateSchoolBlock(
  docs: RagMatchRow[],
  options: { focus?: FocusProfile | null; nationwideReferenceOnly?: boolean } = {}
): string {
  const grouped = new Map<
    string,
    {
      schoolName: string;
      prefectures: Set<string>;
      refs: number[];
      score: number;
      focusHits: number;
      focusSnippets: string[];
      snippets: string[];
    }
  >();

  docs.forEach((doc, index) => {
    if (!doc.school_name) return;
    const current =
      grouped.get(doc.school_name) ??
      {
        schoolName: doc.school_name,
        prefectures: new Set<string>(),
        refs: [],
        score: 0,
        focusHits: 0,
        focusSnippets: [],
        snippets: [],
      };

    if (doc.prefecture) current.prefectures.add(doc.prefecture);
    current.refs.push(index + 1);
    const targetText = `${doc.title}\n${doc.content}`;
    const hits = focusHitCount(targetText, options.focus?.regex);
    current.focusHits += hits;
    current.score += (doc.score ?? doc.similarity ?? 0) + hits * 0.35;
    if (hits > 0 && current.focusSnippets.length < 3) {
      current.focusSnippets.push(extractRelevantSnippet(doc.content, options.focus?.regex));
    }
    if (current.snippets.length < 2) current.snippets.push(extractRelevantSnippet(doc.content));
    grouped.set(doc.school_name, current);
  });

  const candidates = [...grouped.values()]
    .filter((candidate) => {
      if (!options.nationwideReferenceOnly) return true;
      if (isLocalPublicSchoolName(candidate.schoolName)) return false;
      if (options.focus) return true;
      const combinedSnippets = candidate.snippets.join(' ');
      return /オンライン|自宅|ネット|広域|全国|キャンパス|柔軟|通学.*選/.test(combinedSnippets);
    })
    .filter((candidate) => {
      if (!options.focus) return true;
      return candidate.focusHits > 0;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (candidates.length === 0) return '実名校候補なし';

  return candidates
    .map((candidate, index) => {
      const prefectures = [...candidate.prefectures].join(', ') || '都道府県不明';
      const refs = candidate.refs
        .slice(0, 4)
        .map((ref) => `[doc_${ref}]`)
        .join(' ');
      const snippets =
        candidate.focusSnippets.length > 0
          ? candidate.focusSnippets.join(' / ')
          : candidate.snippets.join(' / ');
      return `${index + 1}. ${candidate.schoolName}（${prefectures}） refs: ${refs}\n   ${
        options.focus ? `${options.focus.label}に関する口コミ根拠` : '根拠要約'
      }: ${snippets}`;
    })
    .join('\n');
}

function rerankRowsForFocus(rows: RagMatchRow[], focus: FocusProfile | null): RagMatchRow[] {
  if (!focus) return rows;
  return [...rows].sort((a, b) => {
    const aHits = focusHitCount(`${a.title}\n${a.content}`, focus.regex);
    const bHits = focusHitCount(`${b.title}\n${b.content}`, focus.regex);
    if (aHits !== bHits) return bHits - aHits;
    return (b.score ?? b.similarity ?? 0) - (a.score ?? a.similarity ?? 0);
  });
}

function mergeRagRows(primary: RagMatchRow[], secondary: RagMatchRow[]): RagMatchRow[] {
  const seen = new Set<string>();
  const out: RagMatchRow[] = [];
  for (const row of [...primary, ...secondary]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function buildSchoolLinkMap(docs: RagMatchRow[]): Map<string, string> {
  const priority: Partial<Record<RagMatchRow['source_type'], number>> = {
    school: 1,
    school_summary: 2,
    tuition: 3,
    course: 4,
    faq: 5,
    seo_section: 6,
    review: 20,
    article: 30,
  };
  const schoolPageById = new Map<string, string>();
  const best = new Map<string, { url: string; pri: number }>();

  for (const doc of docs) {
    if (!doc.school_id || !doc.source_url?.includes('/schools/')) continue;
    schoolPageById.set(doc.school_id, doc.source_url);
  }

  for (const doc of docs) {
    if (!doc.school_name) continue;
    const schoolPageUrl =
      (doc.source_url?.includes('/schools/') ? doc.source_url : null) ??
      (doc.school_id
        ? schoolPageById.get(doc.school_id) ??
          appPath(`/schools/id/${encodeURIComponent(doc.school_id)}`)
        : null);
    if (!schoolPageUrl) continue;

    const pri = priority[doc.source_type] ?? 50;
    const current = best.get(doc.school_name);
    if (!current || pri < current.pri) {
      best.set(doc.school_name, { url: schoolPageUrl, pri });
    }
  }

  return new Map([...best.entries()].map(([name, value]) => [name, value.url]));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function injectSchoolLinks(reply: string, schoolLinks: Map<string, string>): string {
  let out = reply;
  const names = [...schoolLinks.keys()].sort((a, b) => b.length - a.length);

  for (const name of names) {
    const url = schoolLinks.get(name);
    if (!url) continue;
    out = out.replace(
      new RegExp(`(^###\\s+)${escapeRegExp(name)}\\s*$`, 'gm'),
      `$1[${name}](${url})`
    );
    out = out.replace(new RegExp(`^${escapeRegExp(name)}\\s*$`, 'gm'), `[${name}](${url})`);
  }

  return out;
}

function extractSchoolCandidates(
  reply: string,
  schoolLinks: Map<string, string>
): Array<{ name: string; url: string }> {
  const resolveSchool = (rawName: string): { name: string; url: string } | null => {
    const normalized = rawName
      .replace(/^\d+[.)]\s*/, '')
      .replace(/[（(].*$/, '')
      .trim();
    const directUrl = schoolLinks.get(normalized);
    if (directUrl) return { name: normalized, url: directUrl };

    const matchedName = [...schoolLinks.keys()].find(
      (schoolName) => normalized.includes(schoolName) || schoolName.includes(normalized)
    );
    if (!matchedName) return null;
    const url = schoolLinks.get(matchedName);
    return url ? { name: matchedName, url } : null;
  };

  const headingMatches = [...reply.matchAll(/^###\s+(?:\[([^\]]+)\]\([^)]+\)|(.+?))\s*$/gm)];
  const fromHeadings: Array<{ name: string; url: string }> = [];

  for (const match of headingMatches) {
    const rawName = (match[1] ?? match[2] ?? '').trim();
    const resolved = resolveSchool(rawName);
    if (!resolved || fromHeadings.some((school) => school.name === resolved.name)) continue;
    fromHeadings.push(resolved);
    if (fromHeadings.length >= 4) return fromHeadings;
  }

  const names = [...schoolLinks.keys()].sort((a, b) => b.length - a.length);
  const picked: Array<{ name: string; url: string }> = [];

  for (const name of names) {
    if (!reply.includes(name)) continue;
    const url = schoolLinks.get(name);
    if (!url) continue;
    picked.push({ name, url });
    if (picked.length >= 4) break;
  }

  return picked.slice(0, 4);
}

type CitationRow = {
  ref: string;
  index: number;
  row: RagMatchRow;
};

function extractCitations(reply: string, docs: RagMatchRow[]): CitationRow[] {
  const docByRef = new Map<number, RagMatchRow>();
  docs.forEach((doc, index) => docByRef.set(index + 1, doc));
  const matches = [...reply.matchAll(/\[doc_(\d+)\]/g)];
  const picked: CitationRow[] = [];
  const seen = new Set<number>();

  for (const match of matches) {
    const idx = Number.parseInt(match[1] ?? '', 10);
    if (!Number.isFinite(idx) || seen.has(idx)) continue;
    const row = docByRef.get(idx);
    if (!row) continue;
    seen.add(idx);
    picked.push({ ref: `doc_${idx}`, index: idx, row });
  }

  if (picked.length > 0) return picked.slice(0, 12);
  return docs.slice(0, 6).map((row, index) => ({
    ref: `doc_${index + 1}`,
    index: index + 1,
    row,
  }));
}

function selectSourceRows(reply: string, docs: RagMatchRow[]): CitationRow[] {
  return extractCitations(reply, docs);
}

function isModelUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: unknown; status?: unknown };
  return maybeError.code === 'model_not_found' || maybeError.status === 404;
}

function buildChatPayload(replyRaw: string, docs: RagMatchRow[], model: string, intent: ChatIntent) {
  const schoolLinks = buildSchoolLinkMap(docs);
  const reply = injectSchoolLinks(replyRaw, schoolLinks);
  const citationRows = selectSourceRows(replyRaw, docs);
  const schoolCandidates =
    intent === 'school_recommendation' ? extractSchoolCandidates(replyRaw, schoolLinks) : [];

  const sources = citationRows.map(({ ref, index, row }) => ({
    ref,
    index,
    id: row.id,
    sourceType: row.source_type,
    title: row.title,
    schoolName: row.school_name,
    url: row.source_url,
  }));

  return {
    reply,
    sources,
    schoolCandidates,
    model,
  };
}

type ChatLogBase = {
  sessionId?: string;
  source?: string;
  pageUrl?: string;
  userQuestion: string;
  conversationPreview: string;
  intent: ChatIntent;
  focus: FocusProfile | null;
  mentionedSchools: string[];
  route: z.infer<typeof RouterResultSchema>;
  reasonGroup: string | null;
  startedAt: number;
};

type ConsultationMonitoringLogRow = {
  created_at: string | null;
  user_question: string | null;
  assistant_reply: string | null;
  intent: string | null;
  focus_label: string | null;
  prefecture: string | null;
  reason_group: string | null;
  review_notes: string | null;
  rag_doc_count: number | null;
  status: string | null;
};

function normalizePromptText(value: string | null | undefined, maxLength: number): string {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function scoreMonitoringLog(
  row: ConsultationMonitoringLogRow,
  input: {
    intent: ChatIntent;
    focusLabel: string | null;
    prefecture: string | null;
    reasonGroup: string | null;
    latestUserMessage: string;
  }
): number {
  let score = 0;
  if (row.intent === input.intent) score += 4;
  if (input.focusLabel && row.focus_label === input.focusLabel) score += 3;
  if (input.prefecture && row.prefecture === input.prefecture) score += 2;
  if (input.reasonGroup && row.reason_group === input.reasonGroup) score += 2;
  if (row.status === 'success') score += 1;

  const rowQuestion = row.user_question ?? '';
  for (const keyword of ['不登校', '進学', '受験', '朝', '体調', '通学', 'オンライン', '転校', '編入']) {
    if (input.latestUserMessage.includes(keyword) && rowQuestion.includes(keyword)) score += 1;
  }

  return score;
}

async function buildMonitoringInsightBlock(input: {
  intent: ChatIntent;
  focus: FocusProfile | null;
  prefecture: string | null;
  reasonGroup: string | null;
  latestUserMessage: string;
}): Promise<string> {
  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('consultation_chat_logs')
      .select(
        'created_at,user_question,assistant_reply,intent,focus_label,prefecture,reason_group,review_notes,rag_doc_count,status'
      )
      .eq('is_reviewed', true)
      .not('review_notes', 'is', null)
      .neq('review_notes', '')
      .order('created_at', { ascending: false })
      .limit(40);

    if (error || !data) {
      if (error) console.error('[api/chat] monitoring insight fetch failed:', error);
      return '';
    }

    const ranked = (data as ConsultationMonitoringLogRow[])
      .map((row) => ({
        row,
        score: scoreMonitoringLog(row, {
          intent: input.intent,
          focusLabel: input.focus?.label ?? null,
          prefecture: input.prefecture,
          reasonGroup: input.reasonGroup,
          latestUserMessage: input.latestUserMessage,
        }),
      }))
      .filter(({ row, score }) => score >= 4 && Boolean(row.review_notes?.trim()))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (ranked.length === 0) return '';

    const items = ranked.map(({ row }, index) => {
      const conditions = [
        row.intent ? `intent=${row.intent}` : null,
        row.focus_label ? `主訴=${row.focus_label}` : null,
        row.prefecture ? `地域=${row.prefecture}` : null,
        row.reason_group ? `理由=${row.reason_group}` : null,
        typeof row.rag_doc_count === 'number' ? `根拠数=${row.rag_doc_count}` : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' / ');

      return [
        `${index + 1}. ${conditions || '条件なし'}`,
        `相談: ${normalizePromptText(row.user_question, 180)}`,
        `以前の回答: ${normalizePromptText(row.assistant_reply, 220)}`,
        `管理レビュー: ${normalizePromptText(row.review_notes, 260)}`,
      ].join('\n');
    });

    return [
      '過去の管理レビューからの改善メモ:',
      '以下は同種の相談ログを管理者がレビューした内容です。現在の公開根拠とシステム方針を優先しつつ、同じ失敗を避けるための内部ガイドとして使ってください。ユーザーにはこのメモの存在を説明しないでください。',
      items.join('\n\n'),
    ].join('\n');
  } catch (error) {
    console.error('[api/chat] monitoring insight unexpected error:', error);
    return '';
  }
}

function scheduleConsultationChatLog(
  request: NextRequest,
  base: ChatLogBase,
  details: {
    assistantReply?: string | null;
    model?: string | null;
    sourcesJson?: unknown;
    schoolCandidatesJson?: unknown;
    ragDocCount?: number;
    status: 'success' | 'no_evidence' | 'error';
    errorMessage?: string | null;
  }
) {
  after(async () => {
    await logConsultationChat({
      sessionId: base.sessionId,
      source: base.source,
      pageUrl: base.pageUrl,
      userQuestion: base.userQuestion,
      conversationPreview: base.conversationPreview,
      intent: base.intent,
      focusLabel: base.focus?.label ?? null,
      mentionedSchools: base.mentionedSchools,
      prefecture: base.route.prefecture ?? null,
      reasonGroup: base.reasonGroup,
      routeJson: base.route,
      assistantReply: details.assistantReply,
      model: details.model,
      sourcesJson: details.sourcesJson,
      schoolCandidatesJson: details.schoolCandidatesJson,
      ragDocCount: details.ragDocCount,
      status: details.status,
      errorMessage: details.errorMessage,
      latencyMs: Date.now() - base.startedAt,
      request,
    });
  });
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let logBase: ChatLogBase | null = null;

  try {
    const body = await request.json();
    const parsed = ChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'リクエスト形式が不正です', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const messages = parsed.data.messages;
    const latestUserMessage =
      [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
    if (!latestUserMessage) {
      return NextResponse.json({ error: 'ユーザーメッセージが必要です' }, { status: 400 });
    }
    const searchBasisMessage = getSearchBasisMessage(messages, latestUserMessage);
    const conciseRequest = isConciseRequest(latestUserMessage);

    const conversationText = messages
      .slice(-8)
      .map((message) => `${message.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${message.content}`)
      .join('\n');

    const intent = detectChatIntent(searchBasisMessage);
    const mentionedSchools = detectMentionedSchoolNames(conversationText);
    const focus = detectFocusProfile(searchBasisMessage);
    const area = detectAreaProfile(searchBasisMessage);
    const broadRegion = detectBroadRegionProfile(searchBasisMessage);
    const routeRaw = await routeQuery(conversationText, searchBasisMessage);
    const route = area && !routeRaw.prefecture ? { ...routeRaw, prefecture: area.prefecture } : routeRaw;

    const reasonGroup = route.reason_group ?? inferReasonGroupFromText(searchBasisMessage);
    logBase = {
      sessionId: parsed.data.session_id,
      source: parsed.data.source,
      pageUrl: parsed.data.page_url,
      userQuestion: latestUserMessage,
      conversationPreview: conversationText,
      intent,
      focus,
      mentionedSchools,
      route,
      reasonGroup,
      startedAt,
    };
    const [docsRaw, mentionedSchoolDocs, focusDocs, areaSchools] = await Promise.all([
      searchRagDocuments(route.query, {
        prefecture: route.prefecture ?? null,
        reasonGroup,
        matchCount: area ? 32 : 24,
      }),
      fetchRagDocumentsBySchoolNames(mentionedSchools, 4),
      focus
        ? fetchRagDocumentsByKeywords(focus.keywords, {
            prefecture: route.prefecture ?? null,
            limit: isLowAttendancePreference(searchBasisMessage) ? 28 : 18,
          })
        : Promise.resolve([]),
      area
        ? fetchActiveSchoolsByCampusArea({
            prefecture: area.prefecture,
            cities: area.cities,
            limit: 24,
          })
        : Promise.resolve([]),
    ]);
    const areaSchoolDocs =
      areaSchools.length > 0
        ? await fetchRagDocumentsBySchoolIds(
            areaSchools.map((school) => school.id),
            3
          )
        : [];
    const docs = mergeRagRows(
      mergeRagRows(
        mergeRagRows(mentionedSchoolDocs, areaSchoolDocs),
        rerankRowsForFocus(focusDocs, focus)
      ),
      rerankRowsForFocus(rerankForGuardianConsultation(docsRaw, reasonGroup), focus)
    ).slice(0, mentionedSchools.length > 0 ? 16 : area ? 18 : route.prefecture ? 14 : 10);
    const monitoringInsightBlock = await buildMonitoringInsightBlock({
      intent,
      focus,
      prefecture: route.prefecture ?? null,
      reasonGroup,
      latestUserMessage: searchBasisMessage,
    });

    if (docs.length === 0) {
      const noEvidenceReply =
        '関連する公開口コミがまだ少ないため、現時点では具体校の提案が難しい状況です。' +
        'よければ地域（例: 東京都）や通学頻度（週1-2 / オンライン中心）を教えてください。' +
        '条件を絞って再提案します。';
      const noEvidenceModel = chooseGenerationModel(route.difficulty);
      scheduleConsultationChatLog(request, logBase, {
        status: 'no_evidence',
        assistantReply: noEvidenceReply,
        model: noEvidenceModel,
        sourcesJson: [],
        schoolCandidatesJson: [],
        ragDocCount: 0,
      });
      return NextResponse.json({
        reply: noEvidenceReply,
        sources: [],
        model: noEvidenceModel,
      });
    }

    const evidenceBySchool = new Map<string, number>();
    for (const doc of docs) {
      if (!doc.school_name) continue;
      evidenceBySchool.set(doc.school_name, (evidenceBySchool.get(doc.school_name) ?? 0) + 1);
    }
    const schoolHints = [...evidenceBySchool.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([school, count]) => `${school} (${count}件の関連根拠)`)
      .join(' / ');
    const areaHints =
      area && areaSchools.length > 0
        ? areaSchools
            .slice(0, 12)
            .map((school) => {
              const locations = school.campusLocations
                .map((location) => {
                  const stationText =
                    location.nearestStations.length > 0
                      ? `・${location.nearestStations.slice(0, 2).join('／')}`
                      : '';
                  return `${location.city}${stationText}`;
                })
                .join('、');
              return `${school.name}（${locations}）`;
            })
            .join(' / ')
        : 'なし';

    const model = chooseGenerationModel(route.difficulty);
    const openai = getChatOpenAIClient();
    const focusInstruction = focus
      ? `今回の主訴は「${focus.label}」です。${focus.instruction} 各候補校の説明では、主訴に直接関係する口コミ根拠を最低1つは明記してください。主訴に直接関係する口コミ根拠が薄い学校は、候補にしないか「根拠は弱め」と明記してください。`
      : 'ユーザーの主訴を読み取り、候補校の説明では口コミ上の具体的な良かった点・注意点を必ず添えてください。';
    const areaInstruction = area
      ? `ユーザーは「${area.label}」周辺を意図しています。学校候補は、所在地・キャンパスがこの周辺市区にある学校を最優先してください。口コミ根拠が薄い場合でも、所在地根拠と確認事項を分けて説明してください。`
      : '';
    const broadRegionInstruction = broadRegion
      ? `ユーザーは「${broadRegion.label}」を意図しています。単一都道府県に絞り込まず、${broadRegion.prefectures.join('・')}の学校・キャンパスを関東候補として扱ってください。`
      : '';
    const responsePolicy =
      conciseRequest
        ? 'ユーザーは短い回答を求めています。Markdown見出しは使わず、結論1文、候補または要点を3つまで、最後に確認質問1つだけで300字以内にしてください。'
        : intent === 'procedure_explanation'
        ? 'この質問は学校候補の推薦ではなく、制度・手続きの説明です。学校名や候補校見出しを出さないでください。必ず次のMarkdown見出し構成で回答してください: ## 結論 / ## 退学後の入学と転校扱いの違い / ## 先に確認すること / ## 学校へ問い合わせる時の聞き方。'
        : intent === 'style_comparison'
          ? 'この質問は学校候補の推薦ではなく、オンライン中心と通学型など学び方の比較相談です。学校候補・おすすめ校・参考候補を出してはいけません。本文中でも学校名を挙げず、「公開口コミでは」「保護者口コミでは」のように根拠種別として説明してください。本人の不安・登校頻度・友人関係への希望に寄り添って、どちらを選ぶべきかの考え方を説明してください。必ず次のMarkdown見出し構成で回答してください: ## 結論 / ## オンライン中心が合いやすい場合 / ## 通学型・ハイブリッドが合いやすい場合 / ## 見学時に確認したいこと。'
        : intent === 'general_advice'
          ? 'この質問は一般的な学校選び相談です。ユーザーが明示的に候補校を求めていない場合、実名校を無理に出さないでください。必要なら条件整理と確認ポイントを中心に回答してください。必ず次のMarkdown見出し構成で回答してください: ## 考え方 / ## 選び方のポイント / ## 確認ポイント。'
          : mentionedSchools.length >= 2
            ? `ユーザーは ${mentionedSchools.join('、')} で迷っています。新しい学校候補を勝手に追加せず、まず言及された学校同士を比較してください。根拠が薄い学校がある場合は「今回の口コミ根拠は少なめ」と明記しつつ、分かる範囲で比較してください。必ず次のMarkdown見出し構成で回答してください: ## 比較の結論 / ## 学校ごとの向き不向き / ## 選ぶ時の確認ポイント。学校ごとの見出しは ### で実名校を書いてください。`
            : broadRegion
              ? `ユーザーは ${broadRegion.label} を指定しています。候補校は関東圏の検索結果・所在地根拠を優先してください。候補校は原則3校、根拠が少ない場合でも最低2校まで比較し、1校しか確かな根拠がない場合だけその理由を明記してください。候補校は最大3校です。「その他の候補」「補足候補」として4校目以降の学校名を出さないでください。候補校の###見出しには、候補校リスト内の実名校だけを書いてください。必ず次のMarkdown見出し構成で回答してください: ## ${broadRegion.label}で候補になりそうな通信制高校 / ## 選んだ理由 / ## 確認ポイント。学校候補の各校名は ### 見出しにしてください。`
          : route.prefecture
            ? `ユーザーは ${area?.label ?? route.prefecture} を指定しています。候補校は必ず地域内の検索結果・所在地根拠を最優先してください。地域内の候補を原則3校、根拠が少ない場合でも最低2校まで比較し、1校しか確かな根拠がない場合だけその理由を明記してください。候補校は最大3校です。「その他の候補」「補足候補」として4校目以降の学校名を出さないでください。候補校の###見出しには、候補校リスト内の実名校だけを書いてください。必ず次のMarkdown見出し構成で回答してください: ## ${area?.label ?? route.prefecture}で候補になりそうな通信制高校 / ## 選んだ理由 / ## 確認ポイント。学校候補の各校名は ### 見出しにしてください。`
            : '地域指定がない推薦質問です。通学圏での断定は避けつつ、今回の主訴に関する口コミ根拠が強い学校を「参考候補」として2〜3校示してください。冒頭で「地域未指定のため、通えるかは別途確認が必要ですが、口コミ上の根拠が強い参考候補として挙げます。都道府県を教えてもらえれば地域内候補に絞れます」と明記してください。候補校は最大3校です。「その他の候補」「補足候補」として4校目以降の学校名を出さないでください。候補校の###見出しには、候補校リスト内の実名校だけを書いてください。必ず次のMarkdown見出し構成で回答してください: ## 口コミ根拠が強い参考候補 / ## 選んだ理由 / ## 地域指定後に確認したいこと。学校候補の各校名は ### 見出しにしてください。';

    const completionMessages = [
      {
        role: 'system' as const,
        content:
          'あなたは「通信制高校えらび相談AI」です。' +
          '通信制高校選びに悩む保護者に対し、公開口コミと公開情報だけを根拠に回答します。' +
          '不登校や学校生活への不安は主要な背景として扱いますが、回答の主軸は学校選び・比較条件・次の確認事項に置いてください。' +
          'ユーザーが学校候補を明示的に求めていない場合、学校候補・おすすめ校・参考候補を出してはいけません。まず質問に直接答えてください。' +
          '地域指定がある場合、学校候補はその地域の学校を最優先し、根拠にない都外校を候補として出さないでください。' +
          '都外校や全国型オンライン校に触れる場合は、地域内候補が不足する時の補足扱いにしてください。' +
          '地域指定がない場合でも、質問に答えず地域だけを聞き返すのは避けてください。全国型・広域型・オンライン中心の参考候補や選び方で、分かる範囲の回答をしてください。' +
          '大学受験・進学が主訴の場合は、指定校推薦の枠だけでなく、一般受験対策、総合型選抜対策、模試、進路面談、外部予備校連携、学習計画の伴走を比較してください。' +
          '勉強の遅れ・学習不安が主訴の場合は、大学受験実績よりも、基礎からの学び直し、レポート提出の伴走、個別フォロー、少人数、登校頻度の柔軟さを優先して比較してください。' +
          '朝起きられない・午前の登校が難しい相談では、登校頻度の少なさだけでなく、午後登校、オンライン代替、振替スクーリング、体調への配慮、生活リズムの伴走を確認軸にしてください。' +
          focusInstruction +
          areaInstruction +
          broadRegionInstruction +
          responsePolicy +
          '断定・過剰保証は避け、医療診断や法律助言はしません。' +
          (conciseRequest
            ? '回答は300字以内にしてください。'
            : '回答は簡潔に、600〜900字程度を目安にしてください。') +
          '根拠に使ったdoc参照を文中に [doc_n] 形式で付けてください。',
      },
      {
        role: 'user' as const,
        content:
          `会話履歴:\n${conversationText}\n\n` +
          (searchBasisMessage !== latestUserMessage
            ? `回答対象にする元の相談:\n${searchBasisMessage}\n\n`
            : '') +
            `質問タイプ:\n${intent}\n` +
            `今回の主訴:\n${focus ? focus.label : '明確な主訴なし'}\n` +
            `地域解釈:\n${
              area
                ? `${area.label}（${area.prefecture}）`
                : broadRegion
                  ? `${broadRegion.label}（${broadRegion.prefectures.join(' / ')}）`
                  : route.prefecture ?? 'なし'
            }\n` +
            `ユーザーが言及した学校:\n${mentionedSchools.length > 0 ? mentionedSchools.join(' / ') : 'なし'}\n` +
          `検索ルーター結果:\n${JSON.stringify(route, null, 2)}\n` +
          `関連学校ヒント:\n${schoolHints || 'なし'}\n\n` +
          `所在地から拾った地域候補:\n${areaHints}\n\n` +
            (monitoringInsightBlock ? `${monitoringInsightBlock}\n\n` : '') +
            (intent === 'school_recommendation'
              ? `候補校リスト（###見出しに使える実名校はこの中だけ）:\n${buildCandidateSchoolBlock(
                  docs,
                  { focus, nationwideReferenceOnly: !route.prefecture && !broadRegion }
                )}\n\n`
              : '') +
          `参照可能な根拠:\n${buildContextBlock(docs)}\n\n` +
          `最新ユーザー質問:\n${latestUserMessage}`,
      },
    ];

    const wantsStream = request.headers.get('accept')?.includes('application/x-ndjson') ?? false;
    const completionOptions = {
      messages: completionMessages,
      max_completion_tokens: 5000,
    };

    if (wantsStream) {
      const encoder = new TextEncoder();
      return new Response(
        new ReadableStream({
          async start(controller) {
            let usedModel = model;
            let replyRaw = '';

            try {
              let stream;
              try {
                stream = await openai.chat.completions.create({
                  model: usedModel,
                  ...completionOptions,
                  stream: true,
                });
              } catch (error) {
                if (usedModel === CHAT_MODEL_MAIN || !isModelUnavailableError(error)) throw error;
                usedModel = CHAT_MODEL_MAIN;
                stream = await openai.chat.completions.create({
                  model: usedModel,
                  ...completionOptions,
                  stream: true,
                });
              }

              for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content ?? '';
                if (!delta) continue;
                replyRaw += delta;
                controller.enqueue(
                  encoder.encode(`${JSON.stringify({ type: 'delta', content: delta })}\n`)
                );
              }

              const payload = buildChatPayload(replyRaw, docs, usedModel, intent);
              controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'done', ...payload })}\n`));
              if (logBase) {
                scheduleConsultationChatLog(request, logBase, {
                  status: 'success',
                  assistantReply: payload.reply,
                  model: usedModel,
                  sourcesJson: payload.sources,
                  schoolCandidatesJson: payload.schoolCandidates,
                  ragDocCount: docs.length,
                });
              }
            } catch (error) {
              console.error('[api/chat] stream error:', error);
              if (logBase) {
                scheduleConsultationChatLog(request, logBase, {
                  status: 'error',
                  errorMessage: error instanceof Error ? error.message : 'stream error',
                  ragDocCount: docs.length,
                });
              }
              controller.enqueue(
                encoder.encode(
                  `${JSON.stringify({
                    type: 'error',
                    error: 'チャット生成中にエラーが発生しました',
                  })}\n`
                )
              );
            } finally {
              controller.close();
            }
          },
        }),
        {
          headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
          },
        }
      );
    }

    let usedModel = model;
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: usedModel,
        ...completionOptions,
      });
    } catch (error) {
      if (usedModel === CHAT_MODEL_MAIN || !isModelUnavailableError(error)) throw error;
      usedModel = CHAT_MODEL_MAIN;
      completion = await openai.chat.completions.create({
        model: usedModel,
        ...completionOptions,
      });
    }

    const replyRaw =
      completion.choices[0]?.message?.content?.trim() ??
      'うまく回答を生成できませんでした。もう一度質問を送ってください。';

    const payload = buildChatPayload(replyRaw, docs, usedModel, intent);
    if (logBase) {
      scheduleConsultationChatLog(request, logBase, {
        status: 'success',
        assistantReply: payload.reply,
        model: usedModel,
        sourcesJson: payload.sources,
        schoolCandidatesJson: payload.schoolCandidates,
        ragDocCount: docs.length,
      });
    }
    return NextResponse.json(payload);
  } catch (error) {
    console.error('[api/chat] error:', error);
    if (logBase) {
      scheduleConsultationChatLog(request, logBase, {
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'unknown error',
      });
    }
    return NextResponse.json(
      { error: 'チャット生成中にエラーが発生しました' },
      { status: 500 }
    );
  }
}
