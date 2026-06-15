// 学費目安のAI抽出パイプライン
//
// 方針（重要）:
// - AIに金額を推測させない。公式ページ/PDFの本文に明記されている金額のみ抽出する
// - 抽出された金額が本文に実在するかをコード側で照合する（ハルシネーション防止ガード）
// - 結果は必ず draft として保存する（自動公開しない）。published には触れない
// - Google検索結果ページはスクレイピングしない（公式URLとそのサイト内リンクのみ辿る)

import OpenAI from 'openai';
import type { TuitionEstimateInput, TuitionSourceUrl } from '@/lib/types/tuition';
import { sanitizeTuitionInput } from '@/lib/tuition/sanitize';

const FETCH_TIMEOUT_MS = 20000;
const MAX_PAGE_TEXT_CHARS = 12000;
const MAX_TOTAL_TEXT_CHARS = 28000;
const MAX_CANDIDATE_PAGES = 3;
const USER_AGENT =
  'Mozilla/5.0 (compatible; TsushinKuchikomiBot/1.0; +https://example.com/tsushin-kuchikomi)';

/** 学費ページ候補リンクのキーワード（リンクテキスト・href の両方を見る） */
const TUITION_LINK_KEYWORDS = [
  '学費',
  '費用',
  '学納金',
  '納入金',
  '授業料',
  '募集要項',
  '入学案内',
  '入学金',
  'tuition',
  'fee',
  'price',
  'admission',
];

export interface TuitionExtractionOptions {
  schoolName: string;
  /** 公式サイトURL（起点） */
  officialUrl: string | null;
  /** 学費ページの直接指定（学費ページ未発見時の再実行用） */
  tuitionPageUrl?: string | null;
}

export interface TuitionExtractionResult {
  /** draft として保存できる形の入力値（照合ガード適用済み） */
  input: TuitionEstimateInput;
  /** 取得に成功したページURL */
  fetchedUrls: string[];
  /** 学費情報が見つかったか */
  foundTuitionInfo: boolean;
  /** 警告（照合ガードで落とした金額・学費ページ未発見など） */
  warnings: string[];
  tokensUsed: { prompt: number; completion: number; total: number };
}

interface FetchedPage {
  url: string;
  text: string;
  isPdf: boolean;
}

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY が環境変数に設定されていません');
  }
  return new OpenAI({ apiKey });
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/pdf,*/*' },
      redirect: 'follow',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** HTMLからスクリプト・スタイルを除去してテキスト化する */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|td|th|h[1-6]|table|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#?\w+;/g, ' ')
    .replace(/[ \t\u3000]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

async function pdfToText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return (result.text || '').replace(/[ \t\u3000]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function fetchPage(url: string): Promise<FetchedPage | null> {
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    const isPdf = contentType.includes('pdf') || /\.pdf(\?|#|$)/i.test(url);
    if (isPdf) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const text = await pdfToText(buffer);
      if (!text) return null;
      return { url, text: text.slice(0, MAX_PAGE_TEXT_CHARS), isPdf: true };
    }
    const html = await response.text();
    const text = htmlToText(html);
    if (!text) return null;
    return { url, text: text.slice(0, MAX_PAGE_TEXT_CHARS), isPdf: false };
  } catch {
    return null;
  }
}

/** 公式トップページのHTMLから学費関連リンクをスコア順に抽出する */
export function findTuitionLinks(html: string, baseUrl: string): string[] {
  const links: Array<{ url: string; score: number }> = [];
  const seen = new Set<string>();
  const anchorRegex = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

  while ((match = anchorRegex.exec(html)) !== null) {
    const href = match[1].trim();
    const label = htmlToText(match[2]).toLowerCase();
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      continue;
    }
    let resolved: URL;
    try {
      resolved = new URL(href, base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(resolved.protocol)) continue;
    // 公式サイト外（外部メディア・Google等）は辿らない
    if (resolved.hostname !== base.hostname) continue;

    const target = `${resolved.href}`;
    if (seen.has(target)) continue;

    const haystack = `${label} ${decodeURIComponent(resolved.pathname).toLowerCase()}`;
    let score = 0;
    for (const keyword of TUITION_LINK_KEYWORDS) {
      if (haystack.includes(keyword)) score += keyword === '学費' || keyword === '学納金' ? 3 : 1;
    }
    if (score > 0) {
      seen.add(target);
      links.push({ url: target, score });
    }
  }

  return links.sort((a, b) => b.score - a.score).map((l) => l.url);
}

// --- 金額照合ガード ---

/** 全角数字→半角、カンマ除去した本文を作る */
function normalizeTextForAmountCheck(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[,，]/g, '');
}

/**
 * 金額が本文に実在するかを照合する。
 * 「350000」「35万」「35.5万」のいずれかの表記が本文にあれば実在とみなす。
 */
export function amountExistsInText(amount: number, normalizedText: string): boolean {
  if (normalizedText.includes(String(amount))) return true;
  if (amount >= 10000) {
    const man = amount / 10000;
    if (Number.isInteger(man) && normalizedText.includes(`${man}万`)) return true;
    const manFixed = Math.round(man * 10) / 10;
    if (!Number.isInteger(manFixed) && normalizedText.includes(`${manFixed}万`)) return true;
    // 「3万5000円」のような混在表記
    if (Number.isInteger(man / 1) && amount % 10000 !== 0) {
      const manPart = Math.floor(amount / 10000);
      const rest = amount % 10000;
      if (normalizedText.includes(`${manPart}万${rest}`)) return true;
    }
  }
  return false;
}

/** 照合に失敗した金額を null に落とす。落とした項目は warnings に記録 */
function applyAmountGuard(
  input: TuitionEstimateInput,
  sourceText: string,
  warnings: string[]
): TuitionEstimateInput {
  const normalized = normalizeTextForAmountCheck(sourceText);

  const guard = (value: number | null, label: string): number | null => {
    if (value == null) return null;
    if (amountExistsInText(value, normalized)) return value;
    warnings.push(`${label}=${value}円 が出典本文に見つからなかったため破棄しました`);
    return null;
  };

  return {
    ...input,
    first_year_min: guard(input.first_year_min, 'first_year_min'),
    first_year_max: guard(input.first_year_max, 'first_year_max'),
    annual_min: guard(input.annual_min, 'annual_min'),
    annual_max: guard(input.annual_max, 'annual_max'),
    monthly_min: guard(input.monthly_min, 'monthly_min'),
    monthly_max: guard(input.monthly_max, 'monthly_max'),
    plans: input.plans.map((plan, i) => ({
      ...plan,
      first_year_min: guard(plan.first_year_min ?? null, `plans[${i}].first_year_min`),
      first_year_max: guard(plan.first_year_max ?? null, `plans[${i}].first_year_max`),
      annual_min: guard(plan.annual_min ?? null, `plans[${i}].annual_min`),
      annual_max: guard(plan.annual_max ?? null, `plans[${i}].annual_max`),
      monthly_min: guard(plan.monthly_min ?? null, `plans[${i}].monthly_min`),
      monthly_max: guard(plan.monthly_max ?? null, `plans[${i}].monthly_max`),
    })),
    breakdown:
      input.breakdown
        ?.map((item, i) => ({
          ...item,
          amount_min: guard(item.amount_min ?? null, `breakdown[${i}].amount_min`),
          amount_max: guard(item.amount_max ?? null, `breakdown[${i}].amount_max`),
        }))
        .filter((item) => item.amount_min != null || item.amount_max != null) ?? null,
  };
}

// --- OpenAI 抽出 ---

function createExtractionPrompt(schoolName: string, pages: FetchedPage[]): string {
  const pagesText = pages
    .map((p, i) => `【ページ${i + 1}】URL: ${p.url}\n${p.text}`)
    .join('\n\n---\n\n');

  return `あなたは通信制高校の学費情報を公式資料から正確に転記する担当者です。以下は「${schoolName}」の公式サイトのページ本文です。本文に明記されている学費情報のみを抽出してください。

★絶対ルール（厳守）★:
1. 本文に明記されている金額のみを抽出する。推測・補完・相場からの類推は絶対にしない
2. 本文に金額の記載がない項目は必ず null にする（0 にしない）
3. 金額の単位は円（例: 35万円 → 350000）
4. first_year_min / first_year_max は「初年度納入金」（入学後1年目に学校へ納める費用の合計・就学支援金適用前）のみを入れる。公式の「1年次」「初年度納入額」「入学時納入金合計」等に準拠する
5. 複数コースがある場合、サマリー first_year は全コースの初年度納入金の最小〜最大レンジとする。コース別は plans に分ける
6. annual_min/max, monthly_min/max は常に null（使用しない）
7. 就学支援金の適用前/適用後が本文で明確に区別されている場合のみ support_fund を before/after にする。不明なら unknown。支援金適用後の金額を first_year に入れない
8. 単位制（1単位あたり〇円）のみで初年度納入総額が書かれていない場合、総額を計算で作らず null にする。その旨を notes に書く
9. 抽出した金額の根拠となる本文の原文を evidence_excerpts にそのまま引用する（要約・言い換え禁止）
10. 条件が不明な点・注意点は notes に記録する

【ページ本文】
${pagesText}

出力はJSONのみ（コードブロック禁止）:
{
  "found_tuition_info": true | false,
  "first_year_min": number | null,
  "first_year_max": number | null,
  "annual_min": number | null,
  "annual_max": number | null,
  "monthly_min": number | null,
  "monthly_max": number | null,
  "plans": [
    {
      "course_name": "コース名" | null,
      "attendance": "通学頻度（例: 週5日）" | null,
      "first_year_min": number | null,
      "first_year_max": number | null,
      "annual_min": number | null,
      "annual_max": number | null,
      "monthly_min": number | null,
      "monthly_max": number | null,
      "support_fund": "before" | "after" | "unknown",
      "note": "条件の補足" | null
    }
  ],
  "breakdown": [
    { "item": "入学金", "amount_min": number | null, "amount_max": number | null, "note": null }
  ],
  "support_fund_note": "就学支援金に関する本文記載の要点" | null,
  "notes": "条件不明点・注意点（内部メモ用）" | null,
  "evidence_excerpts": [
    { "url": "金額が書かれていたページのURL", "excerpt": "金額を含む本文の原文引用（200字以内）" }
  ]
}`;
}

interface ExtractionResponse {
  found_tuition_info?: boolean;
  first_year_min?: unknown;
  first_year_max?: unknown;
  annual_min?: unknown;
  annual_max?: unknown;
  monthly_min?: unknown;
  monthly_max?: unknown;
  plans?: unknown;
  breakdown?: unknown;
  support_fund_note?: unknown;
  notes?: unknown;
  evidence_excerpts?: Array<{ url?: string; excerpt?: string }>;
}

/**
 * 公式サイトから学費情報を抽出して draft 用の入力値を返す。
 * DBへの保存は呼び出し側（APIルート）で行う。
 */
function normalizeUrlForCompare(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.protocol}//${u.hostname.toLowerCase()}${path}`;
  } catch {
    return url.trim().replace(/\/+$/, '') || url.trim();
  }
}

export async function extractTuitionFromOfficialSite(
  options: TuitionExtractionOptions
): Promise<TuitionExtractionResult> {
  const { schoolName, officialUrl } = options;
  let { tuitionPageUrl } = options;
  const warnings: string[] = [];
  const pages: FetchedPage[] = [];

  if (!tuitionPageUrl && !officialUrl) {
    throw new Error('公式URLが未登録のため抽出できません');
  }

  // 公式トップと同じURLが「学費ページ直接指定」に入っているとリンク探索がスキップされるため無視する
  if (
    tuitionPageUrl &&
    officialUrl &&
    normalizeUrlForCompare(tuitionPageUrl) === normalizeUrlForCompare(officialUrl)
  ) {
    warnings.push(
      '学費ページURLが公式トップと同じため、サイト内の学費関連リンクを自動探索します'
    );
    tuitionPageUrl = null;
  }

  if (tuitionPageUrl) {
    // 学費ページの直接指定（再実行用）
    const page = await fetchPage(tuitionPageUrl);
    if (!page) {
      throw new Error(`指定された学費ページを取得できませんでした: ${tuitionPageUrl}`);
    }
    pages.push(page);
  } else if (officialUrl) {
    // 公式トップ → 学費関連リンクを辿る
    const topResponse = await fetchWithTimeout(officialUrl).catch(() => null);
    if (!topResponse || !topResponse.ok) {
      throw new Error(`公式サイトを取得できませんでした: ${officialUrl}`);
    }
    const topHtml = await topResponse.text();
    const candidateUrls = findTuitionLinks(topHtml, topResponse.url || officialUrl);

    if (candidateUrls.length === 0) {
      warnings.push('学費ページへのリンクが公式トップから見つかりませんでした（学費ページURLを直接指定して再実行できます）');
      // トップページ自体に学費が書かれている場合もあるためトップを対象にする
      const topText = htmlToText(topHtml);
      if (topText) {
        pages.push({ url: officialUrl, text: topText.slice(0, MAX_PAGE_TEXT_CHARS), isPdf: false });
      }
    } else {
      let totalChars = 0;
      for (const url of candidateUrls.slice(0, MAX_CANDIDATE_PAGES * 2)) {
        if (pages.length >= MAX_CANDIDATE_PAGES || totalChars >= MAX_TOTAL_TEXT_CHARS) break;
        const page = await fetchPage(url);
        if (!page) {
          warnings.push(`取得失敗: ${url}`);
          continue;
        }
        pages.push(page);
        totalChars += page.text.length;
      }
    }
  }

  if (pages.length === 0) {
    throw new Error('学費情報の抽出対象ページを取得できませんでした');
  }

  // OpenAI で抽出
  const client = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4.1';
  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content:
          'あなたは公式資料の転記担当者です。本文に明記されている金額のみをJSONで抽出し、記載のない金額は必ずnullにします。推測は一切しません。',
      },
      { role: 'user', content: createExtractionPrompt(schoolName, pages) },
    ],
    temperature: 0,
    max_tokens: 2500,
    response_format: { type: 'json_object' },
  });

  const tokensUsed = {
    prompt: completion.usage?.prompt_tokens || 0,
    completion: completion.usage?.completion_tokens || 0,
    total: completion.usage?.total_tokens || 0,
  };

  const raw = (completion.choices[0]?.message?.content || '').trim();
  let parsed: ExtractionResponse;
  try {
    parsed = JSON.parse(raw) as ExtractionResponse;
  } catch {
    throw new Error('学費抽出結果のJSONパースに失敗しました: ' + raw.slice(0, 200));
  }

  const foundTuitionInfo = parsed.found_tuition_info === true;

  // 出典URL一覧を構築
  const sourceUrls: TuitionSourceUrl[] = pages.map((p) => ({
    url: p.url,
    kind: p.isPdf ? 'admission_pdf' : 'tuition_page',
    note: null,
  }));

  // 根拠抜粋（監査用）
  const excerpts = Array.isArray(parsed.evidence_excerpts)
    ? parsed.evidence_excerpts
        .filter((e) => typeof e?.excerpt === 'string' && e.excerpt.trim())
        .map((e) => `[${e.url || '不明'}]\n${(e.excerpt || '').trim()}`)
        .join('\n\n')
    : '';

  const internalMemoParts: string[] = [];
  if (typeof parsed.notes === 'string' && parsed.notes.trim()) {
    internalMemoParts.push(`AI抽出メモ: ${parsed.notes.trim()}`);
  }

  // サニタイズ → 照合ガード
  const hasPdf = pages.some((p) => p.isPdf);
  let input = sanitizeTuitionInput({
    display_mode: foundTuitionInfo ? 'amounts' : 'contact_required',
    first_year_min: parsed.first_year_min,
    first_year_max: parsed.first_year_max,
    annual_min: null,
    annual_max: null,
    monthly_min: null,
    monthly_max: null,
    plans: parsed.plans,
    breakdown: parsed.breakdown,
    support_fund_note: parsed.support_fund_note,
    public_note: null,
    source_type: hasPdf ? 'official_pdf' : 'official_site',
    source_urls: sourceUrls,
    source_excerpt: excerpts || null,
    verified_at: null,
    internal_memo: null,
  });

  const allSourceText = pages.map((p) => p.text).join('\n');
  input = applyAmountGuard(input, allSourceText, warnings);

  // ガード後に金額が1つも残らなければ contact_required に落とす
  const hasAnyAmount =
    input.first_year_min != null ||
    input.first_year_max != null ||
    input.plans.some(
      (p) =>
        p.first_year_min != null ||
        p.first_year_max != null
    );
  if (!hasAnyAmount) {
    input.display_mode = 'contact_required';
    if (foundTuitionInfo) {
      warnings.push('抽出金額がすべて照合ガードで破棄されたため「個別確認が必要」扱いにしました');
    }
  }

  if (warnings.length > 0) {
    internalMemoParts.push(`警告:\n- ${warnings.join('\n- ')}`);
  }
  input.internal_memo = internalMemoParts.length > 0 ? internalMemoParts.join('\n\n').slice(0, 4000) : null;

  return {
    input,
    fetchedUrls: pages.map((p) => p.url),
    foundTuitionInfo: hasAnyAmount,
    warnings,
    tokensUsed,
  };
}
