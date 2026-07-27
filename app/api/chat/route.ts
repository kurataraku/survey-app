import { after, NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logConsultationChat } from '@/lib/consultation-chat/log';
import {
  CHAT_MODEL_HARD,
  CHAT_MODEL_MAIN,
  CHAT_MODEL_ROUTER,
  CHAT_REASONING_EFFORT,
  CHAT_SERVICE_TIER,
  chooseGenerationModel,
  getChatOpenAIClient,
} from '@/lib/chat/config';
import {
  fetchActiveSchoolsByCampusArea,
  fetchActiveSchoolsByLocationTerms,
  fetchActiveSchoolsByPrefectures,
  embedQueryText,
  fetchRagDocumentsBySchoolNames,
  fetchRagDocumentsBySchoolIds,
  fetchRagDocumentsByKeywords,
  interleaveRagDocsBySchoolOrder,
  rankLocationSchoolMatches,
  inferReasonGroupFromText,
  rerankForGuardianConsultation,
  searchRagDocumentsWithEmbedding,
} from '@/lib/rag/retrieval';
import type { RagMatchRow } from '@/lib/rag/types';
import type { CampusAreaSchoolMatch } from '@/lib/rag/retrieval';
import { appPath } from '@/lib/base-path';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { extractDictionaryLocationTerms } from '@/lib/locations/location-dictionary';
import { resolveSchoolNamesInText } from '@/lib/schools/school-name-resolver';
import { callPerplexityForSummary } from '@/lib/perplexity/client';

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

const CommuteAreaEstimateSchema = z.object({
  origin_label: z.string().max(120).optional(),
  terms: z.array(z.string().min(1).max(80)).max(24).default([]),
  note: z.string().max(300).optional(),
});

type ChatIntent =
  | 'school_recommendation'
  | 'school_fact'
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
type InstitutionType = 'public' | 'private' | 'support';
type SchoolInstitutionInfo = {
  type: InstitutionType | null;
  label: string | null;
};
type CommuteAreaEstimate = z.infer<typeof CommuteAreaEstimateSchema>;

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
  '武蔵野市',
  '三鷹市',
];

const OSAKA_NANIWA_NEARBY_CITIES = [
  '大阪市浪速区',
  '大阪市中央区',
  '大阪市天王寺区',
  '大阪市阿倍野区',
  '大阪市西区',
  '大阪市北区',
  '大阪市淀川区',
];

const NOBORITO_NEARBY_CITIES = [
  '川崎市多摩区',
  '川崎市麻生区',
  '川崎市高津区',
  '狛江市',
  '世田谷区',
  '調布市',
  '町田市',
  '横浜市青葉区',
];

const KAWAGOE_NEARBY_CITIES = [
  '川越市',
  '所沢市',
  '飯能市',
  '狭山市',
  '入間市',
  'ふじみ野市',
  '富士見市',
  '坂戸市',
  '鶴ヶ島市',
  'さいたま市大宮区',
  'さいたま市南区',
];

const TABATA_NEARBY_CITIES = [
  '北区',
  '荒川区',
  '豊島区',
  '文京区',
  '台東区',
  '新宿区',
  '千代田区',
];

function truncate(text: string, maxLength = 360): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function estimateDifficultyFromText(text: string): 'low' | 'high' {
  const hardKeywords = ['比較', 'どっち', 'どちら', '複数', '候補', '優先順位', '迷って', '不安'];
  const hit = hardKeywords.some((word) => text.includes(word));
  const constraintSignals = [
    Boolean(detectPrefecture(text) || detectAreaProfile(text) || extractLocationTerms(text).length > 0),
    /週\s*[0-9０-９一二三四五六七]|オンライン|対面|通学|登校/u.test(text),
    /不登校|学習|勉強|レポート|家では.*学習|全く学習/u.test(text),
    /イラスト|デザイン|マンガ|漫画|アニメ|Vtuber|VTuber|ＶＴｕｂｅｒ|動画|配信|栄養|調理/u.test(text),
    /中3|中学|娘|息子|保護者/u.test(text),
  ].filter(Boolean).length;
  if (constraintSignals >= 3) return 'high';
  if (hit || text.length > 140) return 'high';
  return 'low';
}

function isLowAttendancePreference(text: string): boolean {
  return (
    /年[に\s]*(?:1|2|3|１|２|３|一|二|三)[,，、〜~・\-－]*(?:2|3|２|３|二|三)?回.*(?:通学|登校|スクーリング)/u.test(text) ||
    /(?:通学|登校|スクーリング).{0,12}年[に\s]*(?:1|2|3|１|２|３|一|二|三)[,，、〜~・\-－]*(?:2|3|２|３|二|三)?回/u.test(text) ||
    /集中スクーリング|年数回|年に数回|年数日の登校|合宿型スクーリング/u.test(text) ||
    /通いたくない|通学したくない|登校したくない|通わずに|通わない/u.test(text)
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
    /在住|付近|近辺|周辺|から通学|駅から|駅付近|週\s*[0-9０-９一二三四五六七]|年[に\s]*(?:1|2|3|１|２|３|一|二|三).*通学|通学.*(?:希望|できる|少な)|についてどう|は.*(?:どう|強い|合う|向いて)/u.test(trimmed) ||
    Boolean(detectPrefecture(trimmed) || detectAreaProfile(trimmed) || extractLocationTerms(trimmed).length > 0)
  );
}

function isRegionalFollowUpText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 40) return false;
  if (/高校|高等学校|高等学院|学校|学院|学園|N高|S高/u.test(trimmed)) return false;
  if (detectMentionedSchoolNames(trimmed).length > 0) return false;

  const hasLocation = Boolean(
    detectPrefecture(trimmed) ||
      detectAreaProfile(trimmed) ||
      detectBroadRegionProfile(trimmed) ||
      extractLocationTerms(trimmed).length > 0
  );
  if (!hasLocation) return false;

  const contentWords = trimmed
    .replace(/[、。,.，・\s　]/g, '')
    .replace(/(?:です|でお願いします|で|から|在住|周辺|近辺|付近|近く|あたり|辺り|通学|通える|行ける|希望)$/u, '');

  return contentWords.length <= 12;
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
  if (/浪速区|なんば|難波|JR難波|日本橋|天王寺|大阪市内|大阪市中心/u.test(text)) {
    return {
      label: '浪速区・なんば周辺',
      prefecture: '大阪府',
      cities: OSAKA_NANIWA_NEARBY_CITIES,
      keywords: ['浪速区', 'なんば', '難波', '天王寺', '大阪市内', 'キャンパス', '校舎'],
    };
  }
  if (/登戸|向ヶ丘遊園|川崎市多摩区|多摩区|生田|狛江/u.test(text)) {
    return {
      label: '登戸・川崎市多摩区周辺',
      prefecture: '神奈川県',
      cities: NOBORITO_NEARBY_CITIES,
      keywords: ['登戸', '川崎市多摩区', '向ヶ丘遊園', '狛江', '世田谷', '町田', 'キャンパス', '校舎'],
    };
  }
  if (/川越|本川越|霞ヶ関|鶴ヶ島|坂戸|ふじみ野|所沢|飯能|狭山|入間/u.test(text)) {
    return {
      label: '川越・所沢・飯能周辺',
      prefecture: '埼玉県',
      cities: KAWAGOE_NEARBY_CITIES,
      keywords: [
        '川越',
        '本川越',
        '所沢',
        '飯能',
        '狭山',
        '入間',
        'ふじみ野',
        '坂戸',
        'キャンパス',
        '校舎',
      ],
    };
  }
  if (/田端|西日暮里|日暮里|駒込|巣鴨|王子|赤羽|池袋から|山手線.*北/u.test(text)) {
    return {
      label: '田端駅から30分圏',
      prefecture: '東京都',
      cities: TABATA_NEARBY_CITIES,
      keywords: ['田端', '西日暮里', '日暮里', '駒込', '巣鴨', '池袋', '上野', '秋葉原', 'キャンパス', '校舎'],
    };
  }
  if (/立川|国立|昭島|日野|国分寺|府中|吉祥寺|武蔵野|三鷹/u.test(text)) {
    return {
      label: /吉祥寺|府中/u.test(text) ? '立川・府中・吉祥寺周辺' : '立川市近辺',
      prefecture: '東京都',
      cities: TACHIKAWA_NEARBY_CITIES,
      keywords: ['立川', '国立', '国分寺', '昭島', '日野', '府中', '吉祥寺', '武蔵野', '三鷹', '多摩', 'キャンパス', '校舎'],
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

function extractLocationTerms(text: string): string[] {
  const terms = new Set<string>();
  const normalized = text.replace(/[ 　]/g, '');
  const locationMatches = normalized.match(/[一-龥ぁ-んァ-ヶA-Za-z0-9]+?(?:市|区|町|村|駅)/gu) ?? [];
  for (const raw of locationMatches) {
    const term = raw
      .replace(/(?:から|より|付近|近辺|周辺|以内|通える|行きやすい|学校|高校|通信制)$/u, '')
      .trim();
    if (term.length >= 2 && !/学校|高校|投稿|登校|通学|日帰り|スクーリング/u.test(term)) {
      terms.add(term);
    }
  }

  const genericPlaceMatches =
    normalized.match(/[一-龥ぁ-んァ-ヶA-Za-z0-9ー・]+?(?:付近|近辺|周辺|近く|から通学|から通える|在住|起点)/gu) ?? [];
  for (const raw of genericPlaceMatches) {
    const term = raw
      .replace(/(?:付近|近辺|周辺|近く|から通学|から通える|在住|起点)$/u, '')
      .replace(/^(?:阪急|JR|京王|小田急|東急|西武|東武|京急|京成|名鉄|近鉄|南海|阪神|地下鉄|東京メトロ)/u, '')
      .trim();
    if (
      term.length >= 2 &&
      !/学校|高校|通信制|相談|回答|ユーザー|本人|子ども|子供|息子|娘|男子|女子|現在|希望|不登校|発達障害|ASD|ADHD|通学|登校|スクーリング/u.test(term)
    ) {
      terms.add(term);
    }
  }

  const stationLikeMatches = normalized.match(/[一-龥ぁ-んァ-ヶA-Za-z0-9]+(?:駅前|駅近)/gu) ?? [];
  for (const raw of stationLikeMatches) {
    const term = raw.replace(/駅前|駅近/u, '駅');
    if (term.length >= 2) terms.add(term);
  }

  for (const match of extractDictionaryLocationTerms(text, { max: 8 })) {
    terms.add(match.term);
    if (match.station) terms.add(match.station);
    if (match.city) terms.add(match.city);
  }

  if (terms.size === 0) {
    for (const segment of text.split(/\n|追加条件[:：]/u)) {
      const candidate = normalizeLocationInput(segment);
      if (
        candidate.length >= 2 &&
        candidate.length <= 16 &&
        /[一-龥ぁ-んァ-ヶ]/u.test(candidate) &&
        !/学校|高校|通信制|相談|回答|ユーザー|本人|子ども|子供|息子|娘|男子|女子|現在|希望|不登校|発達障害|ASD|ADHD|通学|登校|スクーリング|おおぞら|クラーク|星槎|トライ|第一学院|N高|S高/u.test(
          candidate
        )
      ) {
        terms.add(candidate);
      }
    }
  }

  return [...terms].slice(0, 8);
}

function normalizeLocationInput(text: string): string {
  return text
    .replace(/[ 　]/g, '')
    .replace(/[「」『』（）()]/g, '')
    .replace(/^(?:阪急|JR|京王|小田急|東急|西武|東武|京急|京成|名鉄|近鉄|南海|阪神|地下鉄|東京メトロ|都営|大阪メトロ)/u, '')
    .trim();
}

function isLikelyLocationOnlyText(text: string, locationTerms: string[]): boolean {
  const normalized = normalizeLocationInput(text);
  if (!normalized || normalized.length > 24) return false;
  return locationTerms.some((term) => {
    const normalizedTerm = normalizeLocationInput(term);
    if (!normalizedTerm) return false;
    return (
      normalized === normalizedTerm ||
      normalized === `${normalizedTerm}駅` ||
      `${normalized}駅` === normalizedTerm
    );
  });
}

function mergeCampusSchoolMatches(...groups: CampusAreaSchoolMatch[][]): CampusAreaSchoolMatch[] {
  const merged = new Map<string, CampusAreaSchoolMatch>();
  for (const group of groups) {
    for (const school of group) {
      if (!merged.has(school.id)) merged.set(school.id, school);
    }
  }
  return [...merged.values()];
}

function buildCommuteTermsWithoutLlm(
  locationTerms: string[],
  area: AreaProfile | null,
  broadRegion: BroadRegionProfile | null
): CommuteAreaEstimate {
  const terms = new Set(locationTerms.map((term) => term.trim()).filter(Boolean));
  if (area) {
    for (const city of area.cities) terms.add(city);
    for (const keyword of area.keywords) terms.add(keyword);
  }
  if (broadRegion) {
    for (const prefecture of broadRegion.prefectures) terms.add(prefecture);
  }
  const merged = [...terms].slice(0, 24);
  return {
    origin_label: locationTerms.join('・') || area?.label || broadRegion?.label,
    terms: merged,
    note: area
      ? '定義済み地域プロファイルと抽出地名を使用'
      : broadRegion
        ? '広域プロファイルと抽出地名を使用'
        : '抽出地名のみを使用',
  };
}

function shouldUseCommuteLlm(
  locationTerms: string[],
  area: AreaProfile | null,
  broadRegion: BroadRegionProfile | null,
  intent: ChatIntent
): boolean {
  if (intent === 'school_fact') return false;
  if (locationTerms.length === 0) return false;
  if (area || broadRegion) return false;
  if (process.env.CHAT_ENABLE_COMMUTE_LLM === 'false') return false;
  return true;
}

function shouldFetchMonitoringInsight(intent: ChatIntent, conciseRequest: boolean): boolean {
  void intent;
  void conciseRequest;
  return process.env.CHAT_ENABLE_MONITORING_INSIGHT !== 'false';
}

function resolveRagMatchCount(
  intent: ChatIntent,
  area: AreaProfile | null,
  broadRegion: BroadRegionProfile | null,
  hasCommuteTerms: boolean
): number {
  if (intent === 'school_fact') return 12;
  if (area || broadRegion || hasCommuteTerms) return 32;
  return 20;
}

async function estimateCommuteAreaTerms(input: {
  locationTerms: string[];
  prefecture?: string | null;
  conversationText: string;
}): Promise<CommuteAreaEstimate> {
  const baseTerms = [...new Set(input.locationTerms.map((term) => term.trim()).filter(Boolean))];
  if (baseTerms.length === 0) return { terms: [] };

  const fallback: CommuteAreaEstimate = {
    origin_label: baseTerms.join('・'),
    terms: baseTerms,
    note: '出発地として抽出した地名・駅名のみを使用',
  };

  try {
    const openai = getChatOpenAIClient();
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL_ROUTER,
      service_tier: CHAT_SERVICE_TIER,
      // キーワード展開だけの軽いタスクのため推論は最小限にして前処理を速くする
      reasoning_effort: 'minimal',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'あなたは日本の通学圏を推定する検索補助AIです。' +
            '厳密な経路検索ではなく、学校キャンパス候補を探すための駅名・市区町村名キーワードだけをJSONで返します。' +
            '鉄道・バスで概ね30分〜60分程度で通学候補になりやすい主要駅・乗換駅・近隣市区町村を推定してください。30分未満の近い候補も除外しないでください。' +
            '学校名、説明文、所要時間、断定表現は返してはいけません。' +
            '出力キーは origin_label, terms, note のみ。terms は最大18件、駅名は「駅」付き、市区町村は正式に近い表記にしてください。',
        },
        {
          role: 'user',
          content:
            `抽出済み出発地: ${baseTerms.join(' / ')}\n` +
            `都道府県ヒント: ${input.prefecture ?? '不明'}\n` +
            `会話:\n${input.conversationText}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return fallback;
    const parsed = CommuteAreaEstimateSchema.parse(JSON.parse(raw));
    const mergedTerms = [...new Set([...baseTerms, ...parsed.terms].map((term) => term.trim()).filter(Boolean))];
    return {
      origin_label: parsed.origin_label || fallback.origin_label,
      terms: mergedTerms.slice(0, 24),
      note: parsed.note || 'LLMで概ね30分〜60分程度の検索語を推定',
    };
  } catch (error) {
    console.error('[api/chat] commute area estimation failed:', error);
    return fallback;
  }
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
    [/星槎/u, '星槎国際高等学校'],
    [/おおぞら|屋久島おおぞら|KTC/u, 'おおぞら高等学院'],
  ];
  const names: string[] = [];
  for (const [pattern, schoolName] of aliases) {
    if (pattern.test(text) && !names.includes(schoolName)) names.push(schoolName);
  }
  return names;
}

type FocusProfileDef = {
  /** 主訴の検出と、文中の初出位置の特定に使う正規表現 */
  detect: RegExp;
  /** detect正規表現より複雑な判定が必要な場合の述語（省略時はdetect.testを使う） */
  matches?: (text: string) => boolean;
  profile: FocusProfile;
};

const FOCUS_PROFILE_DEFS: FocusProfileDef[] = [
  {
    detect: /発達障害|ASD|ADHD|自閉|注意欠如|多動|グレーゾーン|特性|伴走|個別配慮|合理的配慮/i,
    profile: {
      keywords: [
        '発達障害',
        'ASD',
        'ADHD',
        '特性',
        '伴走',
        '個別配慮',
        '合理的配慮',
        '面談',
        '少人数',
        'カウンセラー',
        'ソーシャルワーカー',
      ],
      label: '発達特性・個別伴走',
      regex: /発達障害|ASD|ADHD|自閉|注意欠如|多動|グレーゾーン|特性|伴走|個別配慮|合理的配慮|面談|少人数|カウンセラー|ソーシャルワーカー/iu,
      instruction:
        '発達特性・個別伴走が主訴です。候補校は、発達障害やASD/ADHDへの明示的な理解、個別面談、少人数、担任・カウンセラー・SSWの伴走、レポート提出の声かけ、静かな環境、オンライン代替や振替対応に関する根拠がある学校を優先してください。本人の性別・居住地・通学可能時間など前の発話で出た制約を落とさないでください。',
    },
  },
  {
    detect: /年数回|年に数回|年[に\s]*(?:1|2|3|１|２|３|一|二|三)[,，、〜~・\-－]*(?:2|3|２|３|二|三)?回|集中スクーリング|合宿型スクーリング|オンライン|自宅学習|通学.*少な/u,
    matches: (text) => isLowAttendancePreference(text),
    profile: {
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
    },
  },
  {
    detect: /日帰り.*スクーリング|スクーリング.*日帰り|宿泊なし|宿泊不要|通い.*スクーリング/u,
    profile: {
      keywords: [
        '日帰りスクーリング',
        '宿泊なし',
        '宿泊不要',
        '通学スクーリング',
        'スクーリング',
        '振替',
        'オンライン代替',
      ],
      label: '日帰りスクーリング',
      regex: /日帰り|宿泊なし|宿泊不要|通学スクーリング|スクーリング|振替|オンライン代替/u,
      instruction:
        '日帰りスクーリングが主訴です。候補校は、宿泊を伴わない通学型スクーリング、日帰りで通えるキャンパス、振替・オンライン代替に関する根拠がある学校を優先してください。',
    },
  },
  {
    detect: /イラスト|デザイン|マンガ|漫画|アニメ|美術|クリエイティブ|絵を|絵が|絵の|Vtuber|VTuber|ＶＴｕｂｅｒ|動画|配信/u,
    profile: {
      keywords: [
        'イラスト',
        'デザイン',
        'マンガ',
        '漫画',
        'アニメ',
        '美術',
        'クリエイティブ',
        'ポートフォリオ',
        '専門コース',
        '動画',
        '配信',
        'VTuber',
      ],
      label: 'イラスト・デザイン',
      regex: /イラスト|デザイン|マンガ|漫画|アニメ|美術|クリエイティブ|ポートフォリオ|専門コース|Vtuber|VTuber|ＶＴｕｂｅｒ|動画|配信/u,
      instruction:
        'イラスト・デザインが主訴です。候補校は、マンガ・イラスト・デザイン・アニメ・美術・動画制作系コース、作品制作、ポートフォリオ指導、専門講師に関する根拠がある学校を優先してください。',
    },
  },
  {
    detect: /スポーツ|部活|バスケ|サッカー|野球|テニス|バレー|バドミントン|陸上|水泳|ダンス|武道|柔道|剣道|卓球|体育コース|クラブチーム|遠征|朝練/u,
    profile: {
      keywords: [
        'スポーツ',
        '部活',
        '部活動',
        '大会',
        'クラブ',
        '体育',
        '練習',
        '遠征',
        'トレーニング',
        'アスリート',
      ],
      label: 'スポーツ・部活動',
      regex: /スポーツ|部活|大会|クラブ|体育|練習|遠征|トレーニング|アスリート|両立/u,
      instruction:
        'スポーツ・部活動との両立が主訴です。候補校は、部活動の充実、大会出場、スポーツコース・体育コース、練習や遠征と学業の両立、通学日程の柔軟さに関する口コミ根拠がある学校を優先してください。部活の有無や大会出場の可否は学校・キャンパスごとに差が大きいため、根拠がない学校は「根拠は弱め」と明記し、説明会や見学での確認を促してください。',
    },
  },
  {
    detect: /学校生活.{0,15}楽し|楽し.{0,10}学校生活|(?:友達|友人).{0,12}(?:欲しい|ほしい|作りたい|つくりたい|できる)|文化祭|体育祭|修学旅行|青春|行事.{0,10}(?:楽し|充実|参加)/u,
    profile: {
      keywords: [
        '学校生活',
        '友達',
        '友人',
        '行事',
        '文化祭',
        '体育祭',
        'イベント',
        '修学旅行',
        '居場所',
        '楽しい',
        '交流',
      ],
      label: '学校生活・友人関係を楽しみたい',
      regex: /学校生活|友達|友人|行事|文化祭|体育祭|イベント|修学旅行|居場所|楽し|交流|青春/u,
      instruction:
        '学校生活をもう一度楽しみたい・友人が欲しいという前向きな気持ちが主訴です。候補校は、行事やイベントの充実、友人づくりのきっかけ、生徒同士の交流、居場所づくり、通学時の楽しい雰囲気に関する口コミ根拠がある学校を優先してください。友人関係を築きにくいという口コミがある学校は、その旨を注意点として正直に伝えてください。',
    },
  },
  {
    detect: /ネットコース|オンライン.*安|(?<!不)安[いくさ]|学費.*安|費用.*安|低価格|格安|学費.*納得|お金.{0,8}(?:ない|なく|厳し|余裕|かけられ)|金銭的|経済的に|(?:費用|学費|お金).{0,6}(?:抑え|かけたくない)/u,
    profile: {
      keywords: [
        'ネットコース',
        'オンライン',
        '自宅学習',
        '学費',
        '安い',
        '費用',
        'お金',
        '納得感',
        '授業料',
        '通学少ない',
      ],
      label: 'ネットコース・学費重視',
      regex: /ネットコース|オンライン|自宅学習|学費|安い|費用|お金|納得感|授業料|通学少な/u,
      instruction:
        'ネットコース・学費重視が主訴です。候補校は、オンライン中心で通学負担が少ないこと、学費の安さ・納得感・追加費用の少なさに関する口コミや学費情報がある学校を優先してください。',
    },
  },
  {
    detect: /ギャル|ヤンキー|派手|落ち着い|静か|穏やか|校風|雰囲気/u,
    profile: {
      keywords: [
        '落ち着いた',
        '静か',
        '穏やか',
        '少人数',
        '雰囲気',
        '校風',
        '服装',
        '派手',
        'にぎやか',
        'マイペース',
      ],
      label: '落ち着いた雰囲気',
      regex: /落ち着|静か|穏やか|少人数|雰囲気|校風|服装|派手|にぎやか|マイペース|ギャル|ヤンキー/u,
      instruction:
        '落ち着いた雰囲気が主訴です。候補校は、雰囲気評価が高い、少人数、落ち着いている、派手さ・にぎやかさが強すぎないことに関する口コミ根拠がある学校を優先してください。「ギャル」「ヤンキー」のような表現は決めつけず、服装規定・校風・在校生の雰囲気として丁寧に言い換えてください。',
    },
  },
  {
    detect: /就職|就活|キャリア|求人|職業|資格|専門職|インターン/u,
    profile: {
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
    },
  },
  {
    detect: /大学|受験|進学|指定校|推薦|総合型|AO|模試|予備校|進路/u,
    profile: {
      keywords: ['大学', '受験', '進学', '指定校', '推薦', '総合型', '模試', '予備校', '進路'],
      label: '大学受験・進学',
      regex: /大学|受験|進学|指定校|推薦|総合型|AO|模試|予備校|進路|面接練習|志望理由|合格/u,
      instruction:
        '大学受験・進学が主訴です。候補校は、進路相談・大学合格・受験時間の確保・指定校推薦・面接練習・模試・予備校連携など、進学に直接関係する口コミ根拠がある学校を優先してください。',
    },
  },
  {
    detect: /朝|起きられ|起きれ|午前|午後|睡眠|起立性|体調|低血圧/u,
    profile: {
      keywords: ['朝', '起きられ', '午前', '午後', '睡眠', '起立性', '体調', 'オンライン', '振替'],
      label: '朝起きられない・体調面',
      regex: /朝|起きられ|起きれ|午前|午後|睡眠|起立性|体調|低血圧|オンライン|自宅|振替|スクーリング/u,
      instruction:
        '朝起きられない・体調面が主訴です。候補校は、登校時間の柔軟性、オンライン代替、振替スクーリング、体調への配慮、生活リズムの伴走に関する口コミ根拠がある学校を優先してください。',
    },
  },
  {
    detect: /勉強|学習|遅れ|遅れて|追いつ|基礎|レポート|単位/u,
    profile: {
      keywords: ['勉強', '学習', '遅れ', '基礎', 'レポート', '単位', '補習', '個別', '添削'],
      label: '学習遅れ・学び直し',
      regex: /勉強|学習|遅れ|追いつ|基礎|レポート|単位|補習|個別|添削|伴走/u,
      instruction:
        '学習遅れ・学び直しが主訴です。候補校は、基礎からの学び直し、レポート提出支援、個別フォロー、補習、添削に関する口コミ根拠がある学校を優先してください。',
    },
  },
  {
    detect: /不登校|学校に行け|登校でき|人間関係|不安/u,
    profile: {
      keywords: ['不登校', '登校', '人間関係', '不安', '先生', '面談', '少人数', '居場所'],
      label: '不登校・人間関係',
      regex: /不登校|登校|人間関係|不安|先生|面談|少人数|居場所|友人|寄り添/u,
      instruction:
        '不登校・人間関係が主訴です。候補校は、少人数、先生の寄り添い、面談、登校再開、居場所づくりに関する口コミ根拠がある学校を優先してください。',
    },
  },
];

const MAX_FOCUS_PROFILES = 3;

/**
 * 主訴プロファイルを全件照合し、相談文で先に述べられた（初出位置が早い）順に最大3件返す。
 * 位置が同じ場合は定義順（従来の優先順位）を維持する。
 */
function detectFocusProfiles(text: string): FocusProfile[] {
  const found: Array<{ position: number; order: number; profile: FocusProfile }> = [];
  FOCUS_PROFILE_DEFS.forEach((def, order) => {
    const matched = def.matches ? def.matches(text) : def.detect.test(text);
    if (!matched) return;
    const position = text.search(def.detect);
    found.push({
      position: position >= 0 ? position : Number.MAX_SAFE_INTEGER,
      order,
      profile: def.profile,
    });
  });
  found.sort((a, b) => a.position - b.position || a.order - b.order);
  return found.slice(0, MAX_FOCUS_PROFILES).map((item) => item.profile);
}

/**
 * 主訴ごとに検索枠（クォータ）を分けてキーワード検索する。
 * 合成キーワード1回だと口コミ量が多い主訴が枠を占有し、2番目以降の主訴の根拠が
 * 文脈に入らないことがあるため、優先度順に枠を割り当てて必ず数件ずつ確保する。
 */
async function fetchFocusDocsWithQuotas(
  profiles: FocusProfile[],
  options: { prefecture: string | null; lowAttendance: boolean }
): Promise<RagMatchRow[]> {
  if (profiles.length === 0) return [];
  const quotas = profiles.length === 1 ? [18] : profiles.length === 2 ? [10, 8] : [8, 6, 4];
  const lists = await Promise.all(
    profiles.map((profile, index) => {
      // 低頻度通学の口コミは表現ゆれが大きいため従来どおり広めに取る
      const bonus =
        options.lowAttendance && profile.label === '年数回・低頻度通学' ? 10 : 0;
      return fetchRagDocumentsByKeywords(profile.keywords, {
        prefecture: options.prefecture,
        limit: (quotas[index] ?? 4) + bonus,
      });
    })
  );
  return lists.reduce<RagMatchRow[]>((merged, list) => mergeRagRows(merged, list), []);
}

/**
 * 最終的にLLMへ渡す口コミを選ぶ際、各主訴に対応する口コミを優先度順に
 * 最低数件ずつ確保してから、残り枠を通常の並び順で埋める。
 */
function selectDocsWithFocusCoverage(
  rows: RagMatchRow[],
  profiles: FocusProfile[],
  maxDocs: number
): RagMatchRow[] {
  if (profiles.length <= 1 || rows.length <= maxDocs) return rows.slice(0, maxDocs);
  const reservedPerProfile = [4, 3, 2];
  const selected: RagMatchRow[] = [];
  const selectedIds = new Set<string>();
  profiles.forEach((profile, index) => {
    let need = reservedPerProfile[index] ?? 2;
    for (const row of rows) {
      if (need === 0) break;
      if (selectedIds.has(row.id)) continue;
      if (focusHitCount(`${row.title}\n${row.content}`, profile.regex) === 0) continue;
      selected.push(row);
      selectedIds.add(row.id);
      need -= 1;
    }
  });
  for (const row of rows) {
    if (selected.length >= maxDocs) break;
    if (selectedIds.has(row.id)) continue;
    selected.push(row);
    selectedIds.add(row.id);
  }
  return selected.slice(0, maxDocs);
}

/**
 * 複数主訴をRAG検索・rerank用に1つの合成プロファイルへまとめる。
 * キーワードは最優先主訴を全件、2番目以降は先頭6件までを採用する。
 */
function combineFocusProfiles(profiles: FocusProfile[]): FocusProfile | null {
  if (profiles.length === 0) return null;
  if (profiles.length === 1) return profiles[0];
  const keywords = [
    ...new Set(
      profiles.flatMap((profile, index) =>
        index === 0 ? profile.keywords : profile.keywords.slice(0, 6)
      )
    ),
  ].slice(0, 24);
  return {
    keywords,
    label: profiles.map((profile) => profile.label).join(' / '),
    regex: new RegExp(profiles.map((profile) => profile.regex.source).join('|'), 'iu'),
    instruction: profiles.map((profile) => profile.instruction).join(' '),
  };
}

function buildAdditionalConstraintInstruction(text: string): string {
  const constraints: string[] = [];
  if (/不登校|学校に行け|登校でき/u.test(text)) {
    constraints.push(
      '不登校背景があります。候補校は、登校再開を急がせず、少人数・面談・担任やカウンセラーの伴走・居場所づくりの根拠を確認軸にしてください。'
    );
  }
  if (/週\s*(?:5|５|五)|週５|週5/u.test(text) && /難しい|無理|避けたい|厳しい/u.test(text)) {
    constraints.push(
      '週5登校は難しい条件です。週1〜3程度、半日・午後・個別登校、振替、オンライン併用など、登校頻度を調整できる可能性を優先してください。'
    );
  }
  if (/オンラインのみ|オンラインだけ|完全オンライン/u.test(text) && /避けたい|嫌|不安|希望しない/u.test(text)) {
    constraints.push(
      'オンラインのみは避けたい条件です。完全オンライン校だけで完結させず、対面授業・キャンパス登校・スクーリング・行事の有無を候補説明に入れてください。'
    );
  }
  if (/家では.*(?:全く|まったく).*学習|全く学習|まったく学習|勉強していない|学習していない/u.test(text)) {
    constraints.push(
      '家庭学習が進んでいない条件です。専門コースの魅力だけでなく、基礎学習、レポート提出、学習計画を学校側がどこまで伴走するかを必ず比較してください。'
    );
  }
  if (/イラスト|デザイン|マンガ|漫画|アニメ|Vtuber|VTuber|ＶＴｕｂｅｒ|動画|配信|栄養|調理/u.test(text)) {
    constraints.push(
      '興味分野があります。イラスト・動画・配信・栄養/調理などは「登校のきっかけ」になり得ますが、高卒資格取得に必要な一般科目の支援と両立できるかを重視してください。'
    );
  }

  if (constraints.length === 0) return '';
  return `追加で落としてはいけない制約: ${constraints.join(' ')}`;
}

function isSchoolFactQuestion(text: string, mentionedSchoolNames: string[]): boolean {
  if (mentionedSchoolNames.length !== 1) return false;
  return /(?:ある|ない|どこ|所在地|住所|電話|窓口|キャンパス|校舎|拠点|置いて|置い|学習センター|に通える|から通える)/u.test(
    text
  );
}

function detectChatIntent(text: string): ChatIntent {
  const area = detectAreaProfile(text);
  const broadRegion = detectBroadRegionProfile(text);
  const locationTerms = extractLocationTerms(text);
  const mentionedSchoolNames = detectMentionedSchoolNames(text);
  const asksHowToChooseOnly =
    /選び方.*知りたい|選ぶ.*ポイント|考え方.*知りたい|流れ.*知りたい|就職率|卒業後.*割合/u.test(
      text
    ) && !/おすすめ|お勧め|候補|探|どこ|通える|合う.*学校|学校.*教えて/u.test(text);
  const hasConcreteSelectionCriteria =
    Boolean(detectPrefecture(text) || area || broadRegion) &&
    /週\s*[0-9０-９]|週[一二三四五六七]|\d[-〜~]\d通学|通学|登校|行きやすい|近い|評定|友達|発達|サポート|進学|受験|就職|就活|不登校|安心|イラスト|デザイン|日帰り|スクーリング|ネット|安い|雰囲気|落ち着/u.test(
      text
    );
  const lowAttendanceSchoolRequest =
    isLowAttendancePreference(text) && /高校|学校|探|いい|希望|おすすめ|お勧め/u.test(text);
  const criteriaSchoolRequest =
    /(?:通信制高校|通信制の高校|高校|学校|ところ|コース)/u.test(text) &&
    /強い|力がある|サポート|交流|同年代|就職|就活|キャリア|進学|受験|不登校|スポーツ|勉強|学習|通学|登校|行きやすい|近い|家から出|合う|向いて|イラスト|デザイン|マンガ|ネット|安い|学費|日帰り|スクーリング|ギャル|ヤンキー|落ち着|雰囲気/u.test(
      text
    );
  const featureSchoolRequest =
    /日帰り.*スクーリング|スクーリング.*日帰り|宿泊なし|イラストを学びたい|デザイン.*学びたい|マンガ.*学びたい|ネットコース.*安い|学費.*安い|ギャル.*少ない|ヤンキー.*少ない|落ち着いた.*高校/u.test(
      text
    );
  const singleSchoolEvaluation =
    mentionedSchoolNames.length > 0 &&
    /どう|考え|強い|評判|口コミ|合う|向いて|有効|比較|知りたい|教えて/u.test(text);
  if (isSchoolFactQuestion(text, mentionedSchoolNames)) return 'school_fact';
  if (asksHowToChooseOnly && mentionedSchoolNames.length === 0) return 'general_advice';
  const locationExpansionRequest =
    /含める|広げ|範囲|でなくても|でも良い|でもいい|近辺も|周辺も/u.test(text) &&
    locationTerms.length > 0;
  const locationOnlySchoolRequest =
    Boolean(area || broadRegion || locationTerms.length > 0) &&
    (/付近|近辺|周辺|近く|から通学|通える|行ける|在住|駅|市|区|町|村/u.test(text) ||
      isLikelyLocationOnlyText(text, locationTerms));
  const wantsSchools =
    /おすすめ|お勧め|薦め|すすめ|候補|学校.*(教えて|探し|探して|知りたい)|高校.*(教えて|探し|探して|知りたい)|探しています|探してます|どこ|通える|行きやすい|近い学校|合う.*学校|いい高校|いい学校/u.test(
      text
    ) ||
    mentionedSchoolNames.length >= 2 ||
    singleSchoolEvaluation ||
    lowAttendanceSchoolRequest ||
    criteriaSchoolRequest ||
    featureSchoolRequest ||
    locationExpansionRequest ||
    locationOnlySchoolRequest ||
    hasConcreteSelectionCriteria;
  const procedureTerms =
    /退学|転校|転入|編入|新入学|在籍|単位|卒業時期|留年|手続き|書類|成績証明|在学証明|入学時期|受付期間/;
  if (procedureTerms.test(text) && !wantsSchools) return 'procedure_explanation';
  const comparesLearningStyle =
    /オンライン中心|オンライン.*通学|通学型|登校型|通学.*オンライン|毎日通う|どちらがいい|どっちがいい/.test(
      text
    );
  const hasLocationSignal = Boolean(detectPrefecture(text) || area || broadRegion || locationTerms.length > 0);
  if (comparesLearningStyle && !wantsSchools && !hasLocationSignal) return 'style_comparison';
  if (wantsSchools) return 'school_recommendation';
  return 'general_advice';
}

function detectPrefecture(text: string): string | null {
  const area = detectAreaProfile(text);
  if (area) return area.prefecture;

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

  const aliases: Array<[string, string]> = [
    ['都内', '東京都'],
    ...prefectures.map((prefecture) => [
      prefecture.replace(/(?:都|道|府|県)$/u, ''),
      prefecture,
    ] as [string, string]),
  ];
  for (const [keyword, prefecture] of aliases) {
    if (keyword && text.includes(keyword)) return prefecture;
  }
  return null;
}

function buildSearchQuery(latestUserMessage: string): string {
  const fragments = [latestUserMessage];
  const area = detectAreaProfile(latestUserMessage);
  const broadRegion = detectBroadRegionProfile(latestUserMessage);
  const locationTerms = extractLocationTerms(latestUserMessage);
  if (area) {
    fragments.push(
      `${area.label} ${area.prefecture} ${area.keywords.join(' ')} ${area.cities.slice(0, 12).join(' ')} 通信制高校 キャンパス 校舎`
    );
  }
  if (locationTerms.length > 0) {
    fragments.push(`${locationTerms.join(' ')} 通信制高校 キャンパス 校舎 最寄り駅 通いやすい`);
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
  if (/日帰り.*スクーリング|スクーリング.*日帰り|宿泊なし|宿泊不要/.test(latestUserMessage)) {
    fragments.push(
      '日帰りスクーリング 宿泊なし 宿泊不要 通学スクーリング 振替スクーリング オンライン代替 登校日数'
    );
  }
  if (/イラスト|デザイン|マンガ|漫画|アニメ|美術|クリエイティブ|絵を|絵が|絵の|Vtuber|VTuber|ＶＴｕｂｅｒ|動画|配信/.test(latestUserMessage)) {
    fragments.push(
      'イラスト デザイン マンガ 漫画 アニメ 美術 クリエイティブ 動画 配信 VTuber 専門コース ポートフォリオ 作品制作'
    );
  }
  if (/栄養|調理|食育|フード|料理|製菓|カフェ/.test(latestUserMessage)) {
    fragments.push('栄養 調理 食育 フード 料理 製菓 カフェ 専門コース 体験授業');
  }
  if (/ネットコース|オンライン.*安|(?<!不)安[いくさ]|学費.*安|費用.*安|低価格|格安|学費.*納得|お金.{0,8}(?:ない|なく|厳し|余裕|かけられ)|金銭的|経済的に|(?:費用|学費|お金).{0,6}(?:抑え|かけたくない)/u.test(latestUserMessage)) {
    fragments.push(
      'ネットコース オンライン 自宅学習 学費 安い 費用 納得感 授業料 通学少ない'
    );
  }
  if (/ギャル|ヤンキー|派手|落ち着い|静か|穏やか|校風|雰囲気/.test(latestUserMessage)) {
    fragments.push(
      '落ち着いた 静か 穏やか 少人数 雰囲気 校風 服装 派手 にぎやか マイペース 在校生'
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
      service_tier: CHAT_SERVICE_TIER,
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
  options: {
    focus?: FocusProfile | null;
    focusProfiles?: FocusProfile[];
    nationwideReferenceOnly?: boolean;
    schoolInstitutionInfo?: Map<string, SchoolInstitutionInfo>;
    locationSchools?: CampusAreaSchoolMatch[];
  } = {}
): string {
  const grouped = new Map<
    string,
    {
      schoolName: string;
      prefectures: Set<string>;
      refs: number[];
      score: number;
      focusHits: number;
      coveredFocusIndexes: Set<number>;
      isLocationMatch: boolean;
      focusSnippets: string[];
      snippets: string[];
    }
  >();

  const focusProfiles = options.focusProfiles ?? [];

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
        coveredFocusIndexes: new Set<number>(),
        isLocationMatch: false,
        focusSnippets: [],
        snippets: [],
      };

    if (doc.prefecture) current.prefectures.add(doc.prefecture);
    current.refs.push(index + 1);
    const targetText = `${doc.title}\n${doc.content}`;
    const hits = focusHitCount(targetText, options.focus?.regex);
    current.focusHits += hits;
    current.score += (doc.score ?? doc.similarity ?? 0) + hits * 0.35;
    focusProfiles.forEach((profile, profileIndex) => {
      if (focusHitCount(targetText, profile.regex) > 0) {
        current.coveredFocusIndexes.add(profileIndex);
      }
    });
    if (hits > 0 && current.focusSnippets.length < 3) {
      current.focusSnippets.push(extractRelevantSnippet(doc.content, options.focus?.regex));
    }
    if (current.snippets.length < 2) current.snippets.push(extractRelevantSnippet(doc.content));
    grouped.set(doc.school_name, current);
  });

  // 複数主訴の場合、多くの主訴に根拠を持つ学校を優先する（優先度の高い主訴ほど重み大）
  if (focusProfiles.length > 1) {
    for (const candidate of grouped.values()) {
      for (const profileIndex of candidate.coveredFocusIndexes) {
        candidate.score += (focusProfiles.length - profileIndex) * 0.3;
      }
    }
  }

  if (options.locationSchools?.length) {
    for (const school of options.locationSchools) {
      const locationSnippet = `キャンパス所在地: ${school.campusLocations
        .map((location) => {
          const stationText =
            location.nearestStations.length > 0
              ? `（${location.nearestStations.slice(0, 2).join('／')}）`
              : '';
          return `${location.prefecture}${location.city}${stationText}`;
        })
        .join('、')}`;
      const existing = grouped.get(school.name);
      if (existing) {
        existing.isLocationMatch = true;
        existing.score += 0.5;
        for (const location of school.campusLocations) {
          if (location.prefecture) existing.prefectures.add(location.prefecture);
        }
        existing.snippets = [locationSnippet, ...existing.snippets].slice(0, 3);
        grouped.set(school.name, existing);
        continue;
      }
      grouped.set(school.name, {
        schoolName: school.name,
        prefectures: new Set(
          school.campusLocations.map((location) => location.prefecture).filter(Boolean)
        ),
        refs: [],
        score: 0.45,
        focusHits: 0,
        coveredFocusIndexes: new Set<number>(),
        isLocationMatch: true,
        focusSnippets: [],
        snippets: [locationSnippet],
      });
    }
  }

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
      return candidate.focusHits > 0 || candidate.isLocationMatch;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (candidates.length === 0) return '実名校候補なし';

  return candidates
    .map((candidate, index) => {
      const prefectures = [...candidate.prefectures].join(', ') || '都道府県不明';
      const institutionLabel = options.schoolInstitutionInfo?.get(candidate.schoolName)?.label ?? null;
      const profileText = [prefectures, institutionLabel].filter(Boolean).join(' / ');
      const refs = candidate.refs
        .slice(0, 4)
        .map((ref) => `[doc_${ref}]`)
        .join(' ');
      const snippets =
        candidate.focusSnippets.length > 0
          ? candidate.focusSnippets.join(' / ')
          : candidate.snippets.join(' / ');
      const refsText = refs ? ` refs: ${refs}` : '';
      const evidenceLabel = options.focus
        ? candidate.focusHits > 0
          ? `${options.focus.label}に関する口コミ根拠`
          : '所在地根拠（主訴の口コミ根拠は要確認）'
        : '根拠要約';
      return `${index + 1}. ${candidate.schoolName}（${profileText}）${refsText}\n   ${evidenceLabel}: ${snippets}`;
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

// 同一校×同一種別でほぼ同じ本文のチャンクを除去し、プロンプトの無駄なトークンを減らす
// （情報量は変わらないため回答品質には影響しない）
function dedupeSimilarRagRows(rows: RagMatchRow[]): RagMatchRow[] {
  const seen = new Set<string>();
  const out: RagMatchRow[] = [];
  for (const row of rows) {
    const contentKey = row.content.replace(/[\s　]+/gu, '').slice(0, 120);
    const key = `${row.school_name ?? ''}|${row.source_type}|${contentKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function normalizeInstitutionType(value: unknown): InstitutionType | null {
  if (value === 'public' || value === 'private' || value === 'support') return value;
  return null;
}

function getInstitutionTypeLabel(type: InstitutionType | null): string | null {
  if (type === 'public') return '公立通信制';
  if (type === 'private') return '私立通信制';
  if (type === 'support') return 'サポート校';
  return null;
}

async function fetchSchoolInstitutionInfo(
  docs: RagMatchRow[]
): Promise<Map<string, SchoolInstitutionInfo>> {
  const infoBySchool = new Map<string, SchoolInstitutionInfo>();

  for (const doc of docs) {
    if (!doc.school_name) continue;
    const metadataType = normalizeInstitutionType(doc.metadata?.institution_type);
    if (metadataType && !infoBySchool.has(doc.school_name)) {
      infoBySchool.set(doc.school_name, {
        type: metadataType,
        label: getInstitutionTypeLabel(metadataType),
      });
    }
  }

  const schoolIds = [...new Set(docs.map((doc) => doc.school_id).filter((id): id is string => Boolean(id)))];
  if (schoolIds.length === 0) return infoBySchool;

  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('schools')
      .select('id,name,institution_type')
      .in('id', schoolIds);

    if (error || !data) {
      if (error) console.error('[api/chat] school institution fetch failed:', error);
      return infoBySchool;
    }

    for (const row of data as Array<{ id: string; name: string; institution_type: string | null }>) {
      const type = normalizeInstitutionType(row.institution_type);
      infoBySchool.set(row.name, {
        type,
        label: getInstitutionTypeLabel(type),
      });
    }
  } catch (error) {
    console.error('[api/chat] school institution unexpected error:', error);
  }

  return infoBySchool;
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
  schoolLinks: Map<string, string>,
  schoolInstitutionInfo: Map<string, SchoolInstitutionInfo>
): Array<{ name: string; url: string; institutionType: InstitutionType | null }> {
  const resolveSchool = (
    rawName: string
  ): { name: string; url: string; institutionType: InstitutionType | null } | null => {
    const normalized = rawName
      .replace(/^\d+[.)]\s*/, '')
      .replace(/[（(].*$/, '')
      .trim();
    const directUrl = schoolLinks.get(normalized);
    if (directUrl) {
      return {
        name: normalized,
        url: directUrl,
        institutionType: schoolInstitutionInfo.get(normalized)?.type ?? null,
      };
    }

    const matchedName = [...schoolLinks.keys()].find(
      (schoolName) => normalized.includes(schoolName) || schoolName.includes(normalized)
    );
    if (!matchedName) return null;
    const url = schoolLinks.get(matchedName);
    return url
      ? {
          name: matchedName,
          url,
          institutionType: schoolInstitutionInfo.get(matchedName)?.type ?? null,
        }
      : null;
  };

  const headingMatches = [...reply.matchAll(/^###\s+(?:\[([^\]]+)\]\([^)]+\)|(.+?))\s*$/gm)];
  const fromHeadings: Array<{ name: string; url: string; institutionType: InstitutionType | null }> = [];

  for (const match of headingMatches) {
    const rawName = (match[1] ?? match[2] ?? '').trim();
    const resolved = resolveSchool(rawName);
    if (!resolved || fromHeadings.some((school) => school.name === resolved.name)) continue;
    fromHeadings.push(resolved);
    if (fromHeadings.length >= 4) return fromHeadings;
  }

  const names = [...schoolLinks.keys()].sort((a, b) => b.length - a.length);
  const picked: Array<{ name: string; url: string; institutionType: InstitutionType | null }> = [];

  for (const name of names) {
    if (!reply.includes(name)) continue;
    const url = schoolLinks.get(name);
    if (!url) continue;
    picked.push({
      name,
      url,
      institutionType: schoolInstitutionInfo.get(name)?.type ?? null,
    });
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

function sanitizePublicReplyText(text: string): string {
  return text
    .replace(/学校マスター/g, '当サイトの学校情報')
    .replace(/学校DB|DB/g, '当サイトの学校情報')
    .replace(/RAG/g, '参照情報')
    .replace(/campus_locations/g, 'キャンパス所在地')
    .replace(/プロンプト/g, '回答方針')
    .replace(/登録されています。はい、あります/g, '確認できます')
    .replace(/登録されています。はい、/g, '確認できます。')
    .replace(/はい、あります（当サイトの学校情報上は/g, '当サイトの学校情報では')
    .replace(/はい、あります（/g, '確認できます（')
    .replace(/正確な番地・電話を公式で確認してお出ししてよいですか[？?]?/g, '番地や電話番号は公式サイトで確認してください。')
    .replace(/公式で確認してお出ししてよいですか[？?]?/g, '公式サイトで確認してください。')
    .replace(/確認してお出しします/g, '公式サイトで確認してください');
}

type ChatCompletionMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

type ChatCompletionOptions = {
  messages: ChatCompletionMessage[];
  max_completion_tokens: number;
  reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high';
  service_tier?: 'priority' | 'default';
};

function isLikelyIncompleteReply(reply: string, intent: ChatIntent): boolean {
  const trimmed = reply.trim();
  if (!trimmed) return true;
  if (intent === 'school_recommendation' && trimmed.length < 220) return true;
  if (intent !== 'school_recommendation' && trimmed.length < 80) return true;
  if (intent === 'school_recommendation' && !/##\s/u.test(trimmed)) return true;
  if (/[、,「『（(]$/u.test(trimmed)) return true;
  if (!/[。.!?！？）)]$/u.test(trimmed) && !trimmed.includes('\n')) return true;
  return false;
}

function buildRepairCompletionOptions(
  options: ChatCompletionOptions,
  partialReply: string,
  intent: ChatIntent
): ChatCompletionOptions {
  const repairInstruction =
    intent === 'school_recommendation'
      ? '前回の回答が途中で途切れています。会話履歴・地域・候補校リスト・参照根拠を使い、指定されたMarkdown見出し構成で最初から完全な回答を書き直してください。途中で終わらせず、候補校ごとに所在地根拠・良かった点・注意点を必ず含めてください。'
      : '前回の回答が途中で途切れています。会話履歴と参照根拠を使い、指定された形式で最初から完全な回答を書き直してください。';
  return {
    ...options,
    max_completion_tokens: Math.max(options.max_completion_tokens, 7000),
    messages: [
      ...options.messages,
      {
        role: 'assistant',
        content: partialReply || '（回答生成が途中で終了しました）',
      },
      {
        role: 'user',
        content: repairInstruction,
      },
    ],
  };
}

async function createCompletionTextWithFallback(
  openai: ReturnType<typeof getChatOpenAIClient>,
  preferredModel: string,
  options: ChatCompletionOptions
): Promise<{ replyRaw: string; usedModel: string; finishReason: string | null }> {
  let usedModel = preferredModel;
  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: usedModel,
      ...options,
    });
  } catch (error) {
    if (usedModel === CHAT_MODEL_MAIN || !isModelUnavailableError(error)) throw error;
    usedModel = CHAT_MODEL_MAIN;
    completion = await openai.chat.completions.create({
      model: usedModel,
      ...options,
    });
  }

  return {
    replyRaw:
      completion.choices[0]?.message?.content?.trim() ??
      'うまく回答を生成できませんでした。もう一度質問を送ってください。',
    usedModel,
    finishReason: completion.choices[0]?.finish_reason ?? null,
  };
}

async function repairIncompleteReplyIfNeeded(input: {
  openai: ReturnType<typeof getChatOpenAIClient>;
  replyRaw: string;
  usedModel: string;
  finishReason: string | null;
  completionOptions: ChatCompletionOptions;
  intent: ChatIntent;
}): Promise<{ replyRaw: string; usedModel: string }> {
  if (input.finishReason !== 'length' && !isLikelyIncompleteReply(input.replyRaw, input.intent)) {
    return { replyRaw: input.replyRaw, usedModel: input.usedModel };
  }

  const repairModel = input.usedModel === CHAT_MODEL_MAIN ? CHAT_MODEL_HARD : input.usedModel;
  const repaired = await createCompletionTextWithFallback(
    input.openai,
    repairModel,
    buildRepairCompletionOptions(input.completionOptions, input.replyRaw, input.intent)
  );

  if (isLikelyIncompleteReply(repaired.replyRaw, input.intent)) {
    throw new Error('回答生成が途中で終了しました');
  }

  return { replyRaw: repaired.replyRaw, usedModel: repaired.usedModel };
}

function isModelUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybeError = error as { code?: unknown; status?: unknown };
  return maybeError.code === 'model_not_found' || maybeError.status === 404;
}

function getSourceTypeLabel(sourceType: string): string {
  const labels: Record<string, string> = {
    review: '口コミ',
    school: '基本情報',
    school_summary: 'AI要約',
    tuition: '学費',
    course: 'コース',
    faq: 'FAQ',
    seo_section: '学校情報',
    article: '記事',
  };
  return labels[sourceType] ?? sourceType;
}

function normalizeSchoolSourceKey(name: string | null | undefined): string | null {
  if (!name?.trim()) return null;
  return name.replace(/\s+/g, '').trim();
}

function buildConsolidatedSourceTitle(
  schoolName: string | null,
  sourceTypes: string[],
  fallbackTitle: string
): string {
  const uniqueLabels = [...new Set(sourceTypes.map(getSourceTypeLabel))];
  if (schoolName) {
    return uniqueLabels.length > 0 ? `${schoolName}（${uniqueLabels.join('・')}）` : schoolName;
  }
  return fallbackTitle;
}

function pickBestSourceUrl(rows: RagMatchRow[], schoolLinks: Map<string, string>): string | null {
  for (const row of rows) {
    if (row.school_name) {
      const linked = schoolLinks.get(row.school_name);
      if (linked) return linked;
    }
  }
  for (const row of rows) {
    if (row.source_url?.includes('/schools/')) return row.source_url;
  }
  for (const row of rows) {
    if (row.source_url) return row.source_url;
  }
  return null;
}

function consolidateChatSources(
  citationRows: CitationRow[],
  schoolLinks: Map<string, string>
): Array<{
  ref: string;
  index: number;
  indexes: number[];
  id: string;
  sourceType: string;
  title: string;
  schoolName: string | null;
  url: string | null;
}> {
  const groups = new Map<string, CitationRow[]>();

  for (const citation of citationRows) {
    const schoolKey = normalizeSchoolSourceKey(citation.row.school_name);
    const groupKey = schoolKey ?? `doc:${citation.row.id}`;
    const list = groups.get(groupKey) ?? [];
    list.push(citation);
    groups.set(groupKey, list);
  }

  return [...groups.values()]
    .map((rows) => {
      const sorted = [...rows].sort((a, b) => a.index - b.index);
      const indexes = sorted.map((item) => item.index);
      const first = sorted[0];
      if (!first) return null;

      const ragRows = sorted.map((item) => item.row);
      const sourceTypes = [...new Set(ragRows.map((row) => row.source_type))];
      const schoolName = first.row.school_name;

      return {
        ref: sorted.map((item) => item.ref).join(','),
        index: indexes[0] ?? first.index,
        indexes,
        id: first.row.id,
        sourceType: sourceTypes.length === 1 ? sourceTypes[0]! : 'mixed',
        title: buildConsolidatedSourceTitle(schoolName, sourceTypes, first.row.title),
        schoolName,
        url: pickBestSourceUrl(ragRows, schoolLinks),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.index - b.index);
}

function buildChatPayload(
  replyRaw: string,
  docs: RagMatchRow[],
  model: string,
  intent: ChatIntent,
  schoolInstitutionInfo: Map<string, SchoolInstitutionInfo>
) {
  const schoolLinks = buildSchoolLinkMap(docs);
  const sanitizedReplyRaw = sanitizePublicReplyText(replyRaw);
  const reply = injectSchoolLinks(sanitizedReplyRaw, schoolLinks);
  const citationRows = selectSourceRows(sanitizedReplyRaw, docs);
  const schoolCandidates =
    intent === 'school_recommendation'
      ? extractSchoolCandidates(sanitizedReplyRaw, schoolLinks, schoolInstitutionInfo)
      : [];

  const sources = consolidateChatSources(citationRows, schoolLinks);

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

type SurveyJoinedSchool = {
  name: string | null;
  prefecture: string | null;
  institution_type: string | null;
};

type SurveyAtmosphereRow = {
  school_id: string | null;
  school_name: string | null;
  answers: Record<string, unknown> | null;
  schools: SurveyJoinedSchool | SurveyJoinedSchool[] | null;
};

const REVIEW_NOTES_PRIORITY_SINCE = '2026-07-14T15:00:00.000Z';
const MONITORING_KEYWORDS = [
  '不登校',
  '進学',
  '受験',
  '大学',
  '就職',
  '転校',
  '編入',
  '転入',
  '通学',
  '登校',
  'オンライン',
  'スクーリング',
  '学費',
  '費用',
  '安い',
  'キャンパス',
  '校舎',
  '住所',
  '電話',
  '地域',
  '候補',
  '比較',
  'おすすめ',
  '資料',
  '公式',
  '口コミ',
  '根拠',
  'サポート',
  'メンタル',
  '人間関係',
  '朝',
  '体調',
  'イラスト',
  'デザイン',
];

function normalizePromptText(value: string | null | undefined, maxLength: number): string {
  const normalized = (value ?? '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
}

function isPriorityReviewLog(row: ConsultationMonitoringLogRow): boolean {
  return Boolean(row.created_at && row.created_at >= REVIEW_NOTES_PRIORITY_SINCE);
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
  if (isPriorityReviewLog(row)) score += 2;
  if (row.status === 'success') score += 1;

  const rowQuestion = row.user_question ?? '';
  const rowText = `${rowQuestion}\n${row.assistant_reply ?? ''}\n${row.review_notes ?? ''}`;
  for (const keyword of MONITORING_KEYWORDS) {
    if (input.latestUserMessage.includes(keyword) && rowText.includes(keyword)) score += 1;
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
      .limit(80);

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
      .filter(
        ({ row, score }) =>
          Boolean(row.review_notes?.trim()) && (score >= 4 || (isPriorityReviewLog(row) && score >= 2))
      )
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (b.row.created_at ?? '').localeCompare(a.row.created_at ?? '');
      })
      .slice(0, 6);

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

type SchoolCampusFactRow = {
  name: string;
  campus_locations: unknown;
};

function formatCampusLocationLines(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((location) => {
      if (!location || typeof location !== 'object') return null;
      const record = location as Record<string, unknown>;
      const prefecture = typeof record.prefecture === 'string' ? record.prefecture.trim() : '';
      const city = typeof record.city === 'string' ? record.city.trim() : '';
      if (!prefecture || !city) return null;
      const stations = Array.isArray(record.nearest_stations)
        ? record.nearest_stations
            .filter((station): station is string => typeof station === 'string' && station.trim() !== '')
            .slice(0, 2)
            .join('／')
        : '';
      return stations ? `${prefecture}${city}（${stations}）` : `${prefecture}${city}`;
    })
    .filter((line): line is string => Boolean(line));
}

async function buildWebSchoolInfoFallbackBlock(schoolNames: string[]): Promise<string> {
  if (process.env.CHAT_ENABLE_WEB_FALLBACK === 'false') return '';
  if (!process.env.PERPLEXITY_API_KEY) return '';

  const names = [...new Set(schoolNames.map((name) => name.trim()).filter(Boolean))].slice(0, 2);
  if (names.length === 0) return '';

  const timeoutMs = 9000;
  const results = await Promise.all(
    names.map(async (name) => {
      try {
        const result = await Promise.race([
          callPerplexityForSummary(name),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('web fallback timeout')), timeoutMs)
          ),
        ]);
        const summary = result.summaryText.replace(/\s+/g, ' ').trim();
        if (!summary) return null;
        const citations = result.citations.slice(0, 2).join(' , ');
        return `- ${name}: ${summary}${citations ? `（出典: ${citations}）` : ''}`;
      } catch (error) {
        console.error(`[api/chat] web fallback failed for ${name}:`, error);
        return null;
      }
    })
  );

  const lines = results.filter((line): line is string => Boolean(line));
  if (lines.length === 0) return '';

  return [
    '口コミ未収載校の公開情報（公式サイト等のWeb検索由来。当サイトの口コミではない）:',
    ...lines,
    '→ この学校について回答する時は、「当サイトの口コミはまだ少ない/ない」ことを一言明記したうえで、上の公開情報を根拠に特徴を説明してください。口コミに基づく評価・比較の断定はしないでください。詳細は公式サイトでの確認を促してください。',
  ].join('\n');
}

function campusMatchesLocationTerms(locationText: string, locationTerms: string[]): boolean {
  const normalizedLocation = locationText.replace(/[ 　]/g, '');
  return locationTerms.some((term) => {
    const normalizedTerm = term.replace(/[ 　]/g, '').replace(/駅$/u, '');
    return (
      normalizedLocation.includes(normalizedTerm) ||
      normalizedTerm.includes(normalizedLocation.replace(/[市区町村]/g, ''))
    );
  });
}

async function buildSchoolCampusFactBlock(
  schoolNames: string[],
  locationTerms: string[]
): Promise<string> {
  const names = [...new Set(schoolNames.map((name) => name.trim()).filter(Boolean))];
  if (names.length === 0) return '';

  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('schools')
      .select('name, campus_locations')
      .eq('status', 'active')
      .eq('is_public', true)
      .in('name', names);

    if (error || !data?.length) {
      if (error) console.error('[api/chat] school campus fact fetch failed:', error);
      return '';
    }

    const items = (data as SchoolCampusFactRow[]).map((row) => {
      const campuses = formatCampusLocationLines(row.campus_locations);
      const matched =
        locationTerms.length > 0
          ? campuses.filter((campus) => campusMatchesLocationTerms(campus, locationTerms))
          : campuses;
      const preview = (matched.length > 0 ? matched : campuses).slice(0, 8);
      const matchNote =
        locationTerms.length > 0 && matched.length > 0
          ? `→ 回答では「${locationTerms.join('・')}に通えるキャンパスを確認できます」と自然に表現する`
          : locationTerms.length > 0
            ? `→ 回答では「${locationTerms.join('・')}に該当するキャンパスは今回の参照情報では確認できません」と表現する`
            : '';
      return `- ${row.name}: ${preview.join(' / ') || 'キャンパス所在地未確認'}${matchNote ? ` ${matchNote}` : ''}`;
    });

    return [
      '当サイトで確認しているキャンパス所在地（回答ではこの見出し名は出さない）:',
      '回答では「学校マスター」「DB」「RAG」「登録されています」などの内部用語を使わず、「当サイトの学校情報では」「確認できます」と自然に言い換えてください。',
      'この情報には市区町村・最寄り駅までしか含まれない場合があります。番地までの住所や電話番号がない場合は、「番地や電話番号までは今回の参照情報に含まれていません」と正直に伝え、「確認してお出しします」「公式で確認してよいですか」のように、このチャット内で追加調査できる前提の約束をしないでください。',
      ...items,
    ].join('\n');
  } catch (error) {
    console.error('[api/chat] school campus fact unexpected error:', error);
    return '';
  }
}

function getJoinedSchool(row: SurveyAtmosphereRow): SurveyJoinedSchool | null {
  const school = row.schools;
  if (!school) return null;
  return Array.isArray(school) ? school[0] ?? null : school;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

async function buildConditionInsightBlock(input: {
  focus: FocusProfile | null;
  prefecture: string | null;
}): Promise<string> {
  if (input.focus?.label !== '落ち着いた雰囲気') return '';

  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('survey_responses')
      .select('school_id, school_name, answers, schools(name,prefecture,institution_type)')
      .eq('is_public', true)
      .limit(1200);

    if (error || !data) {
      if (error) console.error('[api/chat] atmosphere insight fetch failed:', error);
      return '';
    }

    const stats = new Map<
      string,
      {
        schoolName: string;
        prefecture: string | null;
        institutionType: InstitutionType | null;
        total: number;
        calm: number;
        lively: number;
        atmosphereRatings: number[];
      }
    >();

    for (const row of data as SurveyAtmosphereRow[]) {
      const school = getJoinedSchool(row);
      const schoolName = school?.name ?? row.school_name;
      if (!schoolName) continue;
      const answers = row.answers ?? {};
      const campusPrefecture =
        typeof answers.campus_prefecture === 'string' ? answers.campus_prefecture : null;
      const prefecture = campusPrefecture ?? school?.prefecture ?? null;
      if (input.prefecture && prefecture !== input.prefecture) continue;

      const atmospheres = getStringArray(answers.student_atmosphere);
      if (atmospheres.length === 0) continue;
      const current =
        stats.get(schoolName) ??
        {
          schoolName,
          prefecture,
          institutionType: normalizeInstitutionType(school?.institution_type),
          total: 0,
          calm: 0,
          lively: 0,
          atmosphereRatings: [],
        };

      current.total += 1;
      if (
        atmospheres.some((value) =>
          ['落ち着いて少人数で過ごす', '一人時間を大事にする', 'まじめで授業/行事に積極的'].includes(value)
        )
      ) {
        current.calm += 1;
      }
      if (
        atmospheres.some((value) =>
          ['にぎやかでルールにしばられずマイペース', 'おしゃれを楽しむ'].includes(value)
        )
      ) {
        current.lively += 1;
      }

      const rawRating = answers.atmosphere_fit_rating;
      const rating =
        typeof rawRating === 'number'
          ? rawRating
          : typeof rawRating === 'string'
            ? Number.parseInt(rawRating, 10)
            : NaN;
      if (Number.isFinite(rating) && rating >= 1 && rating <= 5) {
        current.atmosphereRatings.push(rating);
      }

      stats.set(schoolName, current);
    }

    const ranked = [...stats.values()]
      .filter((item) => item.total >= 2)
      .sort((a, b) => {
        const aCalmRate = a.calm / a.total;
        const bCalmRate = b.calm / b.total;
        const aLivelyRate = a.lively / a.total;
        const bLivelyRate = b.lively / b.total;
        const calmDiff = bCalmRate - aCalmRate;
        if (Math.abs(calmDiff) > 0.001) return calmDiff;
        const livelyDiff = aLivelyRate - bLivelyRate;
        if (Math.abs(livelyDiff) > 0.001) return livelyDiff;
        return b.total - a.total;
      })
      .slice(0, 8);

    if (ranked.length === 0) return '';

    return [
      'アンケート集計からの補助情報（落ち着いた雰囲気）:',
      '「ギャルが少ない」などの表現は、見た目で断定せず、在校生の雰囲気回答として「落ち着いて少人数で過ごす」「一人時間を大事にする」比率が高く、「にぎやかでルールにしばられずマイペース」「おしゃれを楽しむ」比率が低い学校を参考にしてください。',
      ranked
        .map((item, index) => {
          const avg =
            item.atmosphereRatings.length > 0
              ? (
                  item.atmosphereRatings.reduce((sum, rating) => sum + rating, 0) /
                  item.atmosphereRatings.length
                ).toFixed(1)
              : '不明';
          const institution = getInstitutionTypeLabel(item.institutionType);
          return `${index + 1}. ${item.schoolName}（${[item.prefecture, institution].filter(Boolean).join(' / ') || '所在地要確認'}）: 雰囲気回答${item.total}件、落ち着き系${item.calm}件、にぎやか・おしゃれ系${item.lively}件、雰囲気評価平均${avg}`;
        })
        .join('\n'),
    ].join('\n');
  } catch (error) {
    console.error('[api/chat] atmosphere insight unexpected error:', error);
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
    const regionalFollowUp = isRegionalFollowUpText(latestUserMessage);

    const conversationText = messages
      .slice(-8)
      .map((message) => `${message.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${message.content}`)
      .join('\n');

    const intent = detectChatIntent(searchBasisMessage);
    // AI自身が前ターンで推薦した校名を「ユーザーが言及した学校」と誤認すると、
    // 追加条件だけの発話でも前回候補の比較モードに固定されてしまう。
    // 校名の抽出は原則ユーザー発話のみを対象にし、「この中で」「どっちが」など
    // 直前候補への参照表現があるときだけ会話全体（アシスタント発話含む）から拾う。
    const userConversationText = messages
      .slice(-8)
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join('\n');
    const refersToPreviousCandidates =
      /この中|その中|この[23２３]校|その[23２３]校|の中で|どれが|どれに|どっち|どちら|比べ|比較|上記|さっき|先ほど|前の候補/u.test(
        latestUserMessage
      );
    const schoolNameSourceText = refersToPreviousCandidates ? conversationText : userConversationText;
    const schoolNameResolution = await resolveSchoolNamesInText(latestUserMessage, schoolNameSourceText);
    const mentionedSchools = regionalFollowUp
      ? []
      : [
          ...new Set([...schoolNameResolution.resolved, ...detectMentionedSchoolNames(schoolNameSourceText)]),
        ].slice(0, 4);
    const focusList = detectFocusProfiles(searchBasisMessage);
    const focus = focusList[0] ?? null;
    const combinedFocus = combineFocusProfiles(focusList);
    const additionalConstraintInstruction = buildAdditionalConstraintInstruction(searchBasisMessage);
    const area = detectAreaProfile(searchBasisMessage);
    const broadRegion = detectBroadRegionProfile(searchBasisMessage);
    const locationTerms = extractLocationTerms(searchBasisMessage);
    const needsCommuteLlm = shouldUseCommuteLlm(locationTerms, area, broadRegion, intent);
    const speculativeSearchQuery = buildSearchQuery(searchBasisMessage);
    const fetchMonitoringInsight = shouldFetchMonitoringInsight(intent, conciseRequest);
    const insightPrefecture = area?.prefecture ?? detectPrefecture(searchBasisMessage) ?? null;
    const insightReasonGroup = inferReasonGroupFromText(searchBasisMessage);
    const [
      routeRaw,
      commuteAreaEstimate,
      queryEmbedding,
      mentionedSchoolDocs,
      monitoringInsightBlock,
      conditionInsightBlock,
      schoolCampusFactBlock,
    ] = await Promise.all([
      routeQuery(conversationText, searchBasisMessage),
      needsCommuteLlm
        ? estimateCommuteAreaTerms({
            locationTerms,
            prefecture: insightPrefecture,
            conversationText,
          })
        : Promise.resolve(buildCommuteTermsWithoutLlm(locationTerms, area, broadRegion)),
      embedQueryText(speculativeSearchQuery),
      fetchRagDocumentsBySchoolNames(mentionedSchools, 4),
      fetchMonitoringInsight
        ? buildMonitoringInsightBlock({
            intent,
            focus,
            prefecture: insightPrefecture,
            reasonGroup: insightReasonGroup,
            latestUserMessage: searchBasisMessage,
          })
        : Promise.resolve(''),
      buildConditionInsightBlock({
        focus: focusList.find((profile) => profile.label === '落ち着いた雰囲気') ?? null,
        prefecture: insightPrefecture,
      }),
      buildSchoolCampusFactBlock(mentionedSchools, [
        ...locationTerms,
        ...(area?.cities ?? []),
      ]),
    ]);
    const route = area && !routeRaw.prefecture ? { ...routeRaw, prefecture: area.prefecture } : routeRaw;
    const commuteLocationTerms = commuteAreaEstimate.terms;

    const reasonGroup = route.reason_group ?? inferReasonGroupFromText(searchBasisMessage);
    logBase = {
      sessionId: parsed.data.session_id,
      source: parsed.data.source,
      pageUrl: parsed.data.page_url,
      userQuestion: latestUserMessage,
      conversationPreview: conversationText,
      intent,
      focus: combinedFocus,
      mentionedSchools,
      route,
      reasonGroup,
      startedAt,
    };

    const searchQuery = route.query.trim();
    const searchEmbedding =
      searchQuery === speculativeSearchQuery.trim()
        ? queryEmbedding
        : await embedQueryText(searchQuery);
    const ragMatchCount = resolveRagMatchCount(
      intent,
      area,
      broadRegion,
      commuteLocationTerms.length > 0
    );

    const [docsRaw, focusDocs, areaSchools, broadRegionSchools, genericLocationSchools] =
      await Promise.all([
        searchRagDocumentsWithEmbedding(searchQuery, searchEmbedding, {
          prefecture: route.prefecture ?? null,
          reasonGroup,
          matchCount: ragMatchCount,
        }),
        focusList.length > 0 && intent !== 'school_fact'
          ? fetchFocusDocsWithQuotas(focusList, {
              prefecture: route.prefecture ?? null,
              lowAttendance: isLowAttendancePreference(searchBasisMessage),
            })
          : Promise.resolve([]),
        area
          ? fetchActiveSchoolsByCampusArea({
              prefecture: area.prefecture,
              cities: area.cities,
              limit: 24,
            })
          : Promise.resolve([]),
        broadRegion
          ? fetchActiveSchoolsByPrefectures({
              prefectures: broadRegion.prefectures,
              limit: 36,
            })
          : Promise.resolve([]),
        commuteLocationTerms.length > 0
          ? fetchActiveSchoolsByLocationTerms({
              terms: commuteLocationTerms,
              prefecture: route.prefecture ?? area?.prefecture ?? null,
              limit: 24,
            })
          : Promise.resolve([]),
      ]);
    const locationSchools = mergeCampusSchoolMatches(
      genericLocationSchools,
      areaSchools,
      broadRegionSchools
    );
    const rankedLocationSchools = rankLocationSchoolMatches(locationSchools, [
      ...locationTerms,
      ...(area?.cities ?? []),
    ]);
    const preliminaryDocs = mergeRagRows(
      mergeRagRows(mentionedSchoolDocs, rerankRowsForFocus(focusDocs, combinedFocus)),
      rerankRowsForFocus(rerankForGuardianConsultation(docsRaw, reasonGroup), combinedFocus)
    );
    const mentionedSchoolNamesWithDocs = new Set(
      mentionedSchoolDocs.map((doc) => doc.school_name).filter(Boolean)
    );
    const schoolsNeedingWebFallback = [
      ...mentionedSchools.filter((name) => !mentionedSchoolNamesWithDocs.has(name)),
      ...schoolNameResolution.unresolved,
    ];
    const [areaSchoolDocs, schoolInstitutionInfo, webSchoolInfoFallbackBlock] = await Promise.all([
      rankedLocationSchools.length > 0
        ? fetchRagDocumentsBySchoolIds(
            rankedLocationSchools.map((school) => school.id),
            2
          )
        : Promise.resolve([]),
      fetchSchoolInstitutionInfo(preliminaryDocs),
      schoolsNeedingWebFallback.length > 0
        ? buildWebSchoolInfoFallbackBlock(schoolsNeedingWebFallback)
        : Promise.resolve(''),
    ]);
    const balancedAreaDocs =
      rankedLocationSchools.length > 0
        ? interleaveRagDocsBySchoolOrder(
            areaSchoolDocs,
            rankedLocationSchools.map((school) => school.id),
            2,
            Math.min(rankedLocationSchools.length * 2, 22)
          )
        : [];
    const maxDocs =
      mentionedSchools.length > 0
        ? 16
        : rankedLocationSchools.length > 0
          ? 24
          : area || broadRegion || genericLocationSchools.length > 0
            ? 18
            : route.prefecture
              ? 14
              : 10;
    const docs = selectDocsWithFocusCoverage(
      dedupeSimilarRagRows(
        mergeRagRows(
          mergeRagRows(
            mergeRagRows(mentionedSchoolDocs, balancedAreaDocs),
            rerankRowsForFocus(focusDocs, combinedFocus)
          ),
          rerankRowsForFocus(rerankForGuardianConsultation(docsRaw, reasonGroup), combinedFocus)
        )
      ),
      focusList,
      maxDocs
    );

    const finalSchoolInstitutionInfo =
      balancedAreaDocs.length > 0 ? await fetchSchoolInstitutionInfo(docs) : schoolInstitutionInfo;

    if (docs.length === 0 && !webSchoolInfoFallbackBlock) {
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

    const schoolInstitutionInfoForPrompt = finalSchoolInstitutionInfo;

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
      (area || broadRegion || commuteLocationTerms.length > 0) && rankedLocationSchools.length > 0
        ? rankedLocationSchools
            .map((school) => {
              const locations =
                school.campusLocations.length > 0
                  ? school.campusLocations
                      .map((location) => {
                        const stationText =
                          location.nearestStations.length > 0
                            ? `・${location.nearestStations.slice(0, 2).join('／')}`
                            : '';
                        return `${location.prefecture}${location.city}${stationText}`;
                      })
                      .join('、')
                  : school.prefecture ?? '所在地要確認';
              return `${school.name}（${locations}）`;
            })
            .join(' / ')
        : 'なし';

    const model = chooseGenerationModel(route.difficulty);
    const openai = getChatOpenAIClient();
    const focusInstruction =
      focusList.length > 1
        ? `今回の主訴は複数あります。相談文で先に述べられたものほど優先度が高いものとして扱い、すべての主訴に回答内で必ず触れてください。` +
          focusList
            .map(
              (profile, index) =>
                `【主訴${index + 1}${index === 0 ? '（最優先）' : ''}: ${profile.label}】${profile.instruction}`
            )
            .join('') +
          ' 各候補校の説明では、最優先の主訴に直接関係する口コミ根拠を最低1つは明記し、2番目以降の主訴についても口コミ根拠か確認ポイントのどちらかで必ず触れてください。最優先の主訴に関する根拠が薄い学校は、候補にしないか「根拠は弱め」と明記してください。2番目以降の主訴について参照情報に口コミ根拠が見つからない場合は、曖昧にぼかさず「◯◯に関する口コミ根拠は今回見つからなかったため、見学・説明会での確認ポイントとして挙げます」と正直に明示してください。回答本文では「主訴1」「主訴2」「最優先の主訴」のような内部ラベルを使わず、「不登校からの再スタート」「友達づくり」のように内容そのものの言葉で表現してください。'
        : focus
          ? `今回の主訴は「${focus.label}」です。${focus.instruction} 各候補校の説明では、主訴に直接関係する口コミ根拠を最低1つは明記してください。主訴に直接関係する口コミ根拠が薄い学校は、候補にしないか「根拠は弱め」と明記してください。`
          : 'ユーザーの主訴を読み取り、候補校の説明では口コミ上の具体的な良かった点・注意点を必ず添えてください。';
    const areaInstruction = area
      ? `ユーザーは「${area.label}」周辺を意図しています。学校候補は、所在地・キャンパスがこの周辺市区にある学校を最優先してください。口コミ根拠が薄い場合でも、所在地根拠と確認事項を分けて説明してください。全国展開校・サポート校は本部都道府県と実際のキャンパス所在地が異なる場合があるため、「所在地から拾った地域候補」に含まれる拠点がある学校だけを候補にしてください。候補に出す各校では、良かった点・注意点とは別に「所在地根拠: ◯◯市/最寄り駅」も1行で明記してください。所在地根拠が書けない学校は候補にしないでください。`
      : '';
    const genericLocationInstruction =
      !area && locationTerms.length > 0
        ? `ユーザーは「${locationTerms.join('・')}」周辺から通いやすい学校を意図している可能性があります。通学圏推定キーワード（${commuteLocationTerms.join('・') || locationTerms.join('・')}）と所在地から拾った地域候補がある場合は、その候補を優先してください。電車・バスで概ね30分〜60分程度の目安として扱い、30分未満の近い候補も除外せず、実際の所要時間は断定せず、最寄り駅・乗換・徒歩込みで確認するよう促してください。`
        : '';
    const regionalFollowUpInstruction = regionalFollowUp
      ? '最新発話は地域だけの追加条件です。直前に提示した候補校に限定せず、この地域で通える学校を再選定してください。前の会話にある本人条件・主訴・登校希望は維持してください。'
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
        : intent === 'school_fact'
          ? '特定校の所在地・キャンパスの有無についての質問です。当サイトで確認しているキャンパス所在地を口コミなどの都道府県ラベルより優先してください。該当市区のキャンパスがあれば「はい、◯◯にキャンパスがあります。」のように一文で自然に答えてください。「登録されています」「学校マスター」「DB」「RAG」は回答に書かないでください。「はい、あります」と「確認できます」を重ねる不自然な繰り返しも禁止です。ない場合のみ「今回の参照情報では確認できません」と述べ、公式サイトでの確認を促してください。必ず次のMarkdown見出し構成で回答してください: ## 結論 / ## 確認できるキャンパス / ## 確認ポイント。'
        : intent === 'general_advice'
          ? 'この質問は一般的な学校選び相談です。ユーザーが明示的に候補校を求めていない場合、実名校を無理に出さないでください。必要なら条件整理と確認ポイントを中心に回答してください。必ず次のMarkdown見出し構成で回答してください: ## 考え方 / ## 選び方のポイント / ## 確認ポイント。'
          : mentionedSchools.length >= 2
            ? `ユーザーは ${mentionedSchools.join('、')} で迷っています。新しい学校候補を勝手に追加せず、まず言及された学校同士を比較してください。根拠が薄い学校がある場合は「今回の口コミ根拠は少なめ」と明記しつつ、分かる範囲で比較してください。必ず次のMarkdown見出し構成で回答してください: ## 比較の結論 / ## 学校ごとの向き不向き / ## 選ぶ時の確認ポイント。学校ごとの見出しは ### で実名校を書いてください。`
            : broadRegion
              ? `ユーザーは ${broadRegion.label} を指定しています。候補校は関東圏の検索結果・所在地根拠を優先してください。候補校は原則3校、根拠が少ない場合でも最低2校まで比較し、1校しか確かな根拠がない場合だけその理由を明記してください。候補校は最大3校です。「その他の候補」「補足候補」として4校目以降の学校名を出さないでください。候補校の###見出しには、候補校リスト内の実名校だけを書いてください。必ず次のMarkdown見出し構成で回答してください: ## ${broadRegion.label}で候補になりそうな通信制高校 / ## 選んだ理由 / ## 確認ポイント。学校候補の各校名は ### 見出しにしてください。`
            : locationTerms.length > 0
              ? `ユーザーは ${locationTerms.join('・')} 周辺から通いやすい学校を探しています。通学圏推定キーワードと所在地から拾った地域候補、RAG根拠を優先し、電車・バスで概ね30分〜60分程度で通える可能性がある候補校を原則3校、根拠が少ない場合でも最低2校まで比較してください。30分未満の近い候補も除外しないでください。全国展開校・サポート校は口コミの都道府県ラベルとキャンパス所在地が異なる場合があるため、所在地候補を優先してください。所在地根拠が書けない学校は候補にしないでください。所要時間は断定せず、「実際の通学時間は乗換・徒歩込みで確認」と添えてください。候補校は最大3校です。「その他の候補」「補足候補」として4校目以降の学校名を出さないでください。各校の###見出し直下に「所在地根拠:」「良かった点:」「注意点:」を1行ずつ必ず書いてください。「下にまとめます」と書いて実際に書かないことは禁止です。必ず次のMarkdown見出し構成で回答してください: ## ${locationTerms.join('・')}周辺で候補になりそうな通信制高校 / ## 選んだ理由 / ## 確認ポイント。学校候補の各校名は ### 見出しにしてください。`
          : route.prefecture
            ? `ユーザーは ${area?.label ?? route.prefecture} を指定しています。候補校は必ず地域内の検索結果・所在地根拠を最優先してください。地域内の候補を原則3校、根拠が少ない場合でも最低2校まで比較し、1校しか確かな根拠がない場合だけその理由を明記してください。所在地根拠が書けない学校は候補にしないでください。候補校は最大3校です。「その他の候補」「補足候補」として4校目以降の学校名を出さないでください。各校の###見出し直下に「所在地根拠:」「良かった点:」「注意点:」を1行ずつ必ず書いてください。「下にまとめます」と書いて実際に書かないことは禁止です。候補校の###見出しには、候補校リスト内の実名校だけを書いてください。必ず次のMarkdown見出し構成で回答してください: ## ${area?.label ?? route.prefecture}で候補になりそうな通信制高校 / ## 選んだ理由 / ## 確認ポイント。学校候補の各校名は ### 見出しにしてください。`
            : '地域指定がない推薦質問です。通学圏での断定は避けつつ、今回の主訴に関する口コミ根拠が強い学校を「参考候補」として2〜3校示してください。冒頭で「地域未指定のため、通えるかは別途確認が必要ですが、口コミ上の根拠が強い参考候補として挙げます。都道府県を教えてもらえれば地域内候補に絞れます」と明記してください。候補校は最大3校です。「その他の候補」「補足候補」として4校目以降の学校名を出さないでください。候補校の###見出しには、候補校リスト内の実名校だけを書いてください。必ず次のMarkdown見出し構成で回答してください: ## 口コミ根拠が強い参考候補 / ## 選んだ理由 / ## 地域指定後に確認したいこと。学校候補の各校名は ### 見出しにしてください。';

    const completionMessages = [
      {
        role: 'system' as const,
        content:
          'あなたは「通信制高校えらび相談AI」です。' +
          '通信制高校選びに悩む保護者に対し、公開口コミと公開情報だけを根拠に回答します。' +
          '不登校や学校生活への不安は主要な背景として扱いますが、回答の主軸は学校選び・比較条件・次の確認事項に置いてください。' +
          'ユーザー向け回答では「学校マスター」「DB」「RAG」「プロンプト」「内部ガイド」「登録されています」など運営・開発側の用語を使わないでください。必要なら「当サイトの学校情報」「参照情報」「確認できます」と自然に言い換えてください。' +
          '住所・電話番号・窓口など、参照情報にない詳細を「確認してお出しします」「公式で確認してよいですか」のように約束しないでください。分かる範囲（市区町村・最寄り駅など）を出したうえで、番地や電話番号は公式サイトで確認するよう案内してください。' +
          '会話履歴に出ている本人の発達特性（ASD/ADHDなど）、体調、性別、居住地、通学可能時間、登校希望、対面/オンライン希望、進学希望は強い制約として保持してください。ユーザーが後続で地域だけを入力した場合も、前の制約を消さず、その地域から通いやすい候補を具体的に提案してください。' +
          'ユーザーが学校候補を明示的に求めていない場合、学校候補・おすすめ校・参考候補を出してはいけません。まず質問に直接答えてください。' +
          '地域指定がある場合、学校候補はその地域の学校を最優先し、根拠にない都外校を候補として出さないでください。' +
          '都外校や全国型オンライン校に触れる場合は、地域内候補が不足する時の補足扱いにしてください。' +
          '候補校を出す場合、公立通信制・私立通信制・サポート校の区分が分かる学校は、学校名の近くと本文で必ず明記してください。' +
          'サポート校を候補に出す場合は、通信制高校本体への別途在籍が必要になる場合があることを一言添えてください。' +
          '公立通信制と私立通信制が混在する場合は、学費感やサポート体制の傾向差にも簡潔に触れてください。' +
          '地域指定がない場合でも、質問に答えず地域だけを聞き返すのは避けてください。全国型・広域型・オンライン中心の参考候補や選び方で、分かる範囲の回答をしてください。' +
          '大学受験・進学が主訴の場合は、指定校推薦の枠だけでなく、一般受験対策、総合型選抜対策、模試、進路面談、外部予備校連携、学習計画の伴走を比較してください。' +
          '勉強の遅れ・学習不安が主訴の場合は、大学受験実績よりも、基礎からの学び直し、レポート提出の伴走、個別フォロー、少人数、登校頻度の柔軟さを優先して比較してください。' +
          '朝起きられない・午前の登校が難しい相談では、登校頻度の少なさだけでなく、午後登校、オンライン代替、振替スクーリング、体調への配慮、生活リズムの伴走を確認軸にしてください。' +
          focusInstruction +
          additionalConstraintInstruction +
          areaInstruction +
          genericLocationInstruction +
          regionalFollowUpInstruction +
          broadRegionInstruction +
          responsePolicy +
          '「後でまとめます」「下に記載します」「簡潔にまとめます」と書く場合は、必ず同じ回答内にその内容を書いてください。書けない場合はその表現を使わないでください。' +
          '確認ポイントなどの列挙項目は、必ずMarkdownの「- 」で始まる箇条書きにしてください。' +
          '回答の冒頭は「結論:」「まず結論:」のようなラベル形式を避け、「まず結論からお伝えすると、」のような自然で柔らかい文で始めてください。' +
          '保護者に寄り添う丁寧で温かい語り口にしてください。' +
          '断定・過剰保証は避け、医療診断や法律助言はしません。' +
          (conciseRequest
            ? '回答は300字以内にしてください。'
            : '回答は600字程度を目安に、長くても700字までにしてください。') +
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
            `地域だけの追加条件:\n${regionalFollowUp ? 'はい。直前候補に限定せず地域条件で再推薦する' : 'いいえ'}\n` +
            `今回の主訴（相談文で先に述べられた順・優先度順）:\n${
              focusList.length > 0
                ? focusList
                    .map((profile, index) => `優先度${index + 1}: ${profile.label}`)
                    .join(' / ')
                : '明確な主訴なし'
            }\n` +
            `地域解釈:\n${
              area
                ? `${area.label}（${area.prefecture}）`
                : broadRegion
                  ? `${broadRegion.label}（${broadRegion.prefectures.join(' / ')}）`
                  : locationTerms.length > 0
                    ? `${locationTerms.join(' / ')} 周辺`
                    : route.prefecture ?? 'なし'
            }\n` +
            `ユーザーが言及した学校:\n${mentionedSchools.length > 0 ? mentionedSchools.join(' / ') : 'なし'}\n` +
          `検索ルーター結果:\n${JSON.stringify(route, null, 2)}\n` +
          `関連学校ヒント:\n${schoolHints || 'なし'}\n\n` +
          `通学圏推定（経路APIなし・目安）:\n${
            commuteLocationTerms.length > 0
              ? `出発地=${commuteAreaEstimate.origin_label ?? locationTerms.join(' / ')} / 検索語=${commuteLocationTerms.join(' / ')} / 注意=${commuteAreaEstimate.note ?? '所要時間は未検証'}`
              : 'なし'
          }\n\n` +
          `所在地から拾った地域候補:\n${areaHints}\n\n` +
            (schoolCampusFactBlock ? `${schoolCampusFactBlock}\n\n` : '') +
            (webSchoolInfoFallbackBlock ? `${webSchoolInfoFallbackBlock}\n\n` : '') +
            (conditionInsightBlock ? `${conditionInsightBlock}\n\n` : '') +
            (monitoringInsightBlock ? `${monitoringInsightBlock}\n\n` : '') +
            (intent === 'school_recommendation'
              ? `候補校リスト（###見出しに使える実名校は、この候補校リストまたは上の補助情報に出ている学校だけ）:\n${buildCandidateSchoolBlock(
                  docs,
                  {
                    focus: combinedFocus,
                    focusProfiles: focusList,
                    nationwideReferenceOnly: !route.prefecture && !broadRegion,
                    schoolInstitutionInfo: schoolInstitutionInfoForPrompt,
                    locationSchools: rankedLocationSchools,
                  }
                )}\n\n`
              : '') +
          `参照可能な根拠:\n${buildContextBlock(docs)}\n\n` +
          `最新ユーザー質問:\n${latestUserMessage}`,
      },
    ];

    const wantsStream = request.headers.get('accept')?.includes('application/x-ndjson') ?? false;
    const completionOptions: ChatCompletionOptions = {
      messages: completionMessages,
      max_completion_tokens: 7000,
      // gpt-5.4-mini はデフォルト推論なしのため明示する。環境変数 CHAT_OPENAI_REASONING_EFFORT で調整可能
      reasoning_effort: CHAT_REASONING_EFFORT,
      service_tier: CHAT_SERVICE_TIER,
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
              let finishReason: string | null = null;
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
                const choice = chunk.choices[0];
                finishReason = choice?.finish_reason ?? finishReason;
                const delta = choice?.delta?.content ?? '';
                if (!delta) continue;
                replyRaw += delta;
                const publicDelta = sanitizePublicReplyText(delta);
                controller.enqueue(
                  encoder.encode(`${JSON.stringify({ type: 'delta', content: publicDelta })}\n`)
                );
              }

              const repaired = await repairIncompleteReplyIfNeeded({
                openai,
                replyRaw,
                usedModel,
                finishReason,
                completionOptions,
                intent,
              });
              replyRaw = repaired.replyRaw;
              usedModel = repaired.usedModel;

              const payload = buildChatPayload(
                replyRaw,
                docs,
                usedModel,
                intent,
                schoolInstitutionInfoForPrompt
              );
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

    const generated = await createCompletionTextWithFallback(openai, model, completionOptions);
    const repaired = await repairIncompleteReplyIfNeeded({
      openai,
      replyRaw: generated.replyRaw,
      usedModel: generated.usedModel,
      finishReason: generated.finishReason,
      completionOptions,
      intent,
    });
    const replyRaw = repaired.replyRaw;
    const usedModel = repaired.usedModel;

    const payload = buildChatPayload(
      replyRaw,
      docs,
      usedModel,
      intent,
      schoolInstitutionInfoForPrompt
    );
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
