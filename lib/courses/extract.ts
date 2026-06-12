// コース一覧のAI抽出パイプライン
//
// 方針（学費抽出 lib/tuition/extract.ts と同じ概念）:
// - AIに名称を創作させない。公式ページ本文に明記されているコース名のみ転記する
// - 抽出されたコース名が本文に実在するかをコード側で照合する（ハルシネーション防止ガード）
// - 結果は必ず draft として保存する（自動公開しない）。published には触れない
// - 公式URLとそのサイト内リンクのみ辿る

import OpenAI from 'openai';
import type { CourseListingInput, CourseSourceUrl } from '@/lib/types/courses';
import { sanitizeCourseListingInput } from '@/lib/courses/sanitize';
import { htmlToText } from '@/lib/tuition/extract';

const FETCH_TIMEOUT_MS = 20000;
const MAX_PAGE_TEXT_CHARS = 12000;
const MAX_TOTAL_TEXT_CHARS = 28000;
const MAX_CANDIDATE_PAGES = 3;
const USER_AGENT =
  'Mozilla/5.0 (compatible; TsushinKuchikomiBot/1.0; +https://example.com/tsushin-kuchikomi)';

/** コースページ候補リンクのキーワード（リンクテキスト・href の両方を見る） */
const COURSE_LINK_KEYWORDS = [
  'コース',
  '学科',
  '専攻',
  '学習スタイル',
  '通学スタイル',
  'カリキュラム',
  '募集要項',
  '入学案内',
  'course',
  'curriculum',
  'style',
];

export interface CourseExtractionOptions {
  schoolName: string;
  /** 公式サイトURL（起点） */
  officialUrl: string | null;
  /** コースページの直接指定（再実行用） */
  coursePageUrl?: string | null;
}

export interface CourseExtractionResult {
  /** draft として保存できる形の入力値（照合ガード適用済み） */
  input: CourseListingInput;
  /** 取得に成功したページURL */
  fetchedUrls: string[];
  /** コース情報が見つかったか */
  foundCourses: boolean;
  /** 警告（照合ガードで落とした名称・ページ未発見など） */
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

/** 公式トップページのHTMLからコース関連リンクをスコア順に抽出する */
export function findCourseLinks(html: string, baseUrl: string): string[] {
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
    if (resolved.hostname !== base.hostname) continue;

    const target = `${resolved.href}`;
    if (seen.has(target)) continue;

    const haystack = `${label} ${decodeURIComponent(resolved.pathname).toLowerCase()}`;
    let score = 0;
    for (const keyword of COURSE_LINK_KEYWORDS) {
      if (haystack.includes(keyword)) score += keyword === 'コース' || keyword === '学科' ? 3 : 1;
    }
    if (score > 0) {
      seen.add(target);
      links.push({ url: target, score });
    }
  }

  return links.sort((a, b) => b.score - a.score).map((l) => l.url);
}

// --- 名称照合ガード ---

/** 空白を除去した比較用テキスト */
function normalizeForNameCheck(text: string): string {
  return text.replace(/[\s\u3000]+/g, '');
}

/** コース名が本文に実在するかを照合する（空白無視の部分一致） */
export function courseNameExistsInText(name: string, normalizedText: string): boolean {
  const normalizedName = normalizeForNameCheck(name);
  if (!normalizedName) return false;
  return normalizedText.includes(normalizedName);
}

// --- OpenAI 抽出 ---

function createExtractionPrompt(schoolName: string, pages: FetchedPage[]): string {
  const pagesText = pages
    .map((p, i) => `【ページ${i + 1}】URL: ${p.url}\n${p.text}`)
    .join('\n\n---\n\n');

  return `あなたは通信制高校のコース情報を公式資料から正確に転記する担当者です。以下は「${schoolName}」の公式サイトのページ本文です。本文に明記されているコース名のみを抽出してください。

★絶対ルール（厳守）★:
1. 本文に明記されているコース名のみを抽出する。推測・補完・言い換え・要約は絶対にしない（名称は原文どおり転記する）
2. 通学頻度（例: 週5日）は本文にコースと紐づけて明記されている場合のみ attendance に入れる。不明なら null
3. コースではないもの（学校行事・部活動・進学実績・キャンペーン名など）は含めない
4. 同じコースの表記ゆれ（例: 全角/半角）は1件にまとめ、本文での表記を優先する
5. 抽出した名称の根拠となる本文の原文を evidence_excerpts にそのまま引用する（要約・言い換え禁止）
6. 注意点・不明点は notes に記録する

【ページ本文】
${pagesText}

出力はJSONのみ（コードブロック禁止）:
{
  "found_courses": true | false,
  "courses": [
    { "name": "コース名（原文どおり）", "attendance": "通学頻度（本文に明記がある場合のみ）" | null, "note": "本文に明記された補足" | null }
  ],
  "notes": "注意点・不明点（内部メモ用）" | null,
  "evidence_excerpts": [
    { "url": "コース名が書かれていたページのURL", "excerpt": "コース名を含む本文の原文引用（200字以内）" }
  ]
}`;
}

interface ExtractionResponse {
  found_courses?: boolean;
  courses?: unknown;
  notes?: unknown;
  evidence_excerpts?: Array<{ url?: string; excerpt?: string }>;
}

function normalizeUrlForCompare(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${u.protocol}//${u.hostname.toLowerCase()}${path}`;
  } catch {
    return url.trim().replace(/\/+$/, '') || url.trim();
  }
}

/**
 * 公式サイトからコース一覧を抽出して draft 用の入力値を返す。
 * DBへの保存は呼び出し側（APIルート）で行う。
 */
export async function extractCoursesFromOfficialSite(
  options: CourseExtractionOptions
): Promise<CourseExtractionResult> {
  const { schoolName, officialUrl } = options;
  let { coursePageUrl } = options;
  const warnings: string[] = [];
  const pages: FetchedPage[] = [];

  if (!coursePageUrl && !officialUrl) {
    throw new Error('公式URLが未登録のため抽出できません');
  }

  // 公式トップと同じURLが「コースページ直接指定」に入っているとリンク探索がスキップされるため無視する
  if (
    coursePageUrl &&
    officialUrl &&
    normalizeUrlForCompare(coursePageUrl) === normalizeUrlForCompare(officialUrl)
  ) {
    warnings.push('コースページURLが公式トップと同じため、サイト内のコース関連リンクを自動探索します');
    coursePageUrl = null;
  }

  if (coursePageUrl) {
    const page = await fetchPage(coursePageUrl);
    if (!page) {
      throw new Error(`指定されたコースページを取得できませんでした: ${coursePageUrl}`);
    }
    pages.push(page);
  } else if (officialUrl) {
    const topResponse = await fetchWithTimeout(officialUrl).catch(() => null);
    if (!topResponse || !topResponse.ok) {
      throw new Error(`公式サイトを取得できませんでした: ${officialUrl}`);
    }
    const topHtml = await topResponse.text();
    const candidateUrls = findCourseLinks(topHtml, topResponse.url || officialUrl);

    if (candidateUrls.length === 0) {
      warnings.push('コースページへのリンクが公式トップから見つかりませんでした（コースページURLを直接指定して再実行できます）');
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
    throw new Error('コース情報の抽出対象ページを取得できませんでした');
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
          'あなたは公式資料の転記担当者です。本文に明記されているコース名のみをJSONで抽出し、推測・言い換えは一切しません。',
      },
      { role: 'user', content: createExtractionPrompt(schoolName, pages) },
    ],
    temperature: 0,
    max_tokens: 2000,
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
    throw new Error('コース抽出結果のJSONパースに失敗しました: ' + raw.slice(0, 200));
  }

  const sourceUrls: CourseSourceUrl[] = pages.map((p) => ({
    url: p.url,
    kind: p.isPdf ? 'admission_pdf' : 'course_page',
    note: null,
  }));

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

  const hasPdf = pages.some((p) => p.isPdf);
  const input = sanitizeCourseListingInput({
    courses: parsed.courses,
    public_note: null,
    source_type: hasPdf ? 'official_pdf' : 'official_site',
    source_urls: sourceUrls,
    source_excerpt: excerpts || null,
    verified_at: null,
    internal_memo: null,
  });

  // 照合ガード: 本文に実在しないコース名は破棄する
  const normalizedText = normalizeForNameCheck(pages.map((p) => p.text).join('\n'));
  input.courses = input.courses.filter((course) => {
    if (courseNameExistsInText(course.name, normalizedText)) return true;
    warnings.push(`コース名「${course.name}」が出典本文に見つからなかったため破棄しました`);
    return false;
  });

  if (input.courses.length === 0 && parsed.found_courses === true) {
    warnings.push('抽出されたコース名がすべて照合ガードで破棄されました');
  }

  if (warnings.length > 0) {
    internalMemoParts.push(`警告:\n- ${warnings.join('\n- ')}`);
  }
  input.internal_memo =
    internalMemoParts.length > 0 ? internalMemoParts.join('\n\n').slice(0, 4000) : null;

  return {
    input,
    fetchedUrls: pages.map((p) => p.url),
    foundCourses: input.courses.length > 0,
    warnings,
    tokensUsed,
  };
}
