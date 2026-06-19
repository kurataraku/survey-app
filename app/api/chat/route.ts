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
  fetchRagDocumentsBySchoolNames,
  fetchRagDocumentsByKeywords,
  inferReasonGroupFromText,
  rerankForGuardianConsultation,
  searchRagDocuments,
} from '@/lib/rag/retrieval';
import type { RagMatchRow } from '@/lib/rag/types';
import { appPath } from '@/lib/base-path';

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

function detectMentionedSchoolNames(text: string): string[] {
  const aliases: Array<[RegExp, string]> = [
    [/(^|[、,\s])N高(等学校|校)?/i, 'N高等学校'],
    [/(^|[、,\s])S高(等学校|校)?/i, 'S高等学校'],
    [/クラーク|Clark/i, 'クラーク記念国際高等学校'],
    [/鹿島学園/, '鹿島学園高等学校'],
  ];
  const names: string[] = [];
  for (const [pattern, schoolName] of aliases) {
    if (pattern.test(text) && !names.includes(schoolName)) names.push(schoolName);
  }
  return names;
}

function detectFocusProfile(text: string): FocusProfile | null {
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
  const wantsSchools =
    /おすすめ|お勧め|薦め|すすめ|候補|学校.*(教えて|探し|知りたい)|どこ|通える|合う.*学校/.test(
      text
    ) || detectMentionedSchoolNames(text).length >= 2;
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
  const aliases: Array<[string, string]> = [
    ['東京', '東京都'],
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
  const mentionedSchools = detectMentionedSchoolNames(latestUserMessage);
  if (mentionedSchools.length > 0) {
    fragments.push(`${mentionedSchools.join(' ')} 比較 違い 口コミ 学習スタイル 進路 サポート`);
  }
  if (/大学|受験|進学|指定校|推薦|総合型|AO|模試|予備校|進路/.test(latestUserMessage)) {
    fragments.push(
      '大学受験 進学 指定校推薦 総合型選抜 進路指導 模試 予備校 個別指導 受験対策'
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

    const conversationText = messages
      .slice(-8)
      .map((message) => `${message.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${message.content}`)
      .join('\n');

    const intent = detectChatIntent(latestUserMessage);
    const mentionedSchools = detectMentionedSchoolNames(conversationText);
    const focus = detectFocusProfile(latestUserMessage);
    const route = await routeQuery(conversationText, latestUserMessage);

    const reasonGroup = route.reason_group ?? inferReasonGroupFromText(latestUserMessage);
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
    const [docsRaw, mentionedSchoolDocs, focusDocs] = await Promise.all([
      searchRagDocuments(route.query, {
        prefecture: route.prefecture ?? null,
        reasonGroup,
        matchCount: 24,
      }),
      fetchRagDocumentsBySchoolNames(mentionedSchools, 4),
      focus
        ? fetchRagDocumentsByKeywords(focus.keywords, {
            prefecture: route.prefecture ?? null,
            limit: 18,
          })
        : Promise.resolve([]),
    ]);
    const docs = mergeRagRows(
      mergeRagRows(mentionedSchoolDocs, rerankRowsForFocus(focusDocs, focus)),
      rerankRowsForFocus(rerankForGuardianConsultation(docsRaw, reasonGroup), focus)
    ).slice(0, mentionedSchools.length > 0 ? 16 : route.prefecture ? 10 : 8);

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

    const model = chooseGenerationModel(route.difficulty);
    const openai = getChatOpenAIClient();
    const focusInstruction = focus
      ? `今回の主訴は「${focus.label}」です。${focus.instruction} 各候補校の説明では、主訴に直接関係する口コミ根拠を最低1つは明記してください。主訴に直接関係する口コミ根拠が薄い学校は、候補にしないか「根拠は弱め」と明記してください。`
      : 'ユーザーの主訴を読み取り、候補校の説明では口コミ上の具体的な良かった点・注意点を必ず添えてください。';
    const responsePolicy =
      intent === 'procedure_explanation'
        ? 'この質問は学校候補の推薦ではなく、制度・手続きの説明です。学校名や候補校見出しを出さないでください。必ず次のMarkdown見出し構成で回答してください: ## 結論 / ## 退学後の入学と転校扱いの違い / ## 先に確認すること / ## 学校へ問い合わせる時の聞き方。'
        : intent === 'style_comparison'
          ? 'この質問は学校候補の推薦ではなく、オンライン中心と通学型など学び方の比較相談です。学校候補・おすすめ校・参考候補を出してはいけません。本文中でも学校名を挙げず、「公開口コミでは」「保護者口コミでは」のように根拠種別として説明してください。本人の不安・登校頻度・友人関係への希望に寄り添って、どちらを選ぶべきかの考え方を説明してください。必ず次のMarkdown見出し構成で回答してください: ## 結論 / ## オンライン中心が合いやすい場合 / ## 通学型・ハイブリッドが合いやすい場合 / ## 見学時に確認したいこと。'
        : intent === 'general_advice'
          ? 'この質問は一般的な学校選び相談です。ユーザーが明示的に候補校を求めていない場合、実名校を無理に出さないでください。必要なら条件整理と確認ポイントを中心に回答してください。必ず次のMarkdown見出し構成で回答してください: ## 考え方 / ## 選び方のポイント / ## 確認ポイント。'
          : mentionedSchools.length >= 2
            ? `ユーザーは ${mentionedSchools.join('、')} で迷っています。新しい学校候補を勝手に追加せず、まず言及された学校同士を比較してください。根拠が薄い学校がある場合は「今回の口コミ根拠は少なめ」と明記しつつ、分かる範囲で比較してください。必ず次のMarkdown見出し構成で回答してください: ## 比較の結論 / ## 学校ごとの向き不向き / ## 選ぶ時の確認ポイント。学校ごとの見出しは ### で実名校を書いてください。`
          : route.prefecture
            ? `ユーザーは ${route.prefecture} を指定しています。候補校は必ず ${route.prefecture} の検索結果・根拠を最優先してください。${route.prefecture} の根拠がある候補を2〜3校だけ示し、根拠が不足する場合は無理に都外校を混ぜず「この条件では地域内根拠が少ない」と伝えて確認質問をしてください。候補校は最大3校です。「その他の候補」「補足候補」として4校目以降の学校名を出さないでください。候補校の###見出しには、候補校リスト内の実名校だけを書いてください。必ず次のMarkdown見出し構成で回答してください: ## ${route.prefecture}で候補になりそうな通信制高校 / ## 選んだ理由 / ## 確認ポイント。学校候補の各校名は ### 見出しにしてください。`
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
          responsePolicy +
          '断定・過剰保証は避け、医療診断や法律助言はしません。' +
          '回答は簡潔に、800〜1200字程度を目安にしてください。' +
          '根拠に使ったdoc参照を文中に [doc_n] 形式で付けてください。',
      },
      {
        role: 'user' as const,
        content:
          `会話履歴:\n${conversationText}\n\n` +
            `質問タイプ:\n${intent}\n` +
            `今回の主訴:\n${focus ? focus.label : '明確な主訴なし'}\n` +
            `ユーザーが言及した学校:\n${mentionedSchools.length > 0 ? mentionedSchools.join(' / ') : 'なし'}\n` +
          `検索ルーター結果:\n${JSON.stringify(route, null, 2)}\n` +
          `関連学校ヒント:\n${schoolHints || 'なし'}\n\n` +
            (intent === 'school_recommendation'
              ? `候補校リスト（###見出しに使える実名校はこの中だけ）:\n${buildCandidateSchoolBlock(
                  docs,
                  { focus, nationwideReferenceOnly: !route.prefecture }
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
