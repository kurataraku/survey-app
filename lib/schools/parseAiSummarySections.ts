/**
 * 学校AI要約（summary_text）からセクションを抽出する。
 * generateMetadata / ページSSR とクライアント表示で共通利用。
 */

export type ParsedAiSummarySections = {
  /** 「## 概要」ブロック本文、またはレガシー時は最初の ## 手前まで */
  overviewPlain: string;
  fitsBullets: string[];
  notFitsBullets: string[];
  tuitionCommuteBullets: string[];
};

const EMPTY: ParsedAiSummarySections = {
  overviewPlain: '',
  fitsBullets: [],
  notFitsBullets: [],
  tuitionCommuteBullets: [],
};

/** AI要約末尾の免責文を除去 */
export function stripAiSummaryDisclaimer(text: string): string {
  return text.replace(/\n\n※[\s\S]*$/, '').trim();
}

/** レガシー要約Markdownから「## 学費・通学スタイルの注意点」節を除去（次の ## または末尾まで） */
export function stripTuitionCommuteMarkdownSection(markdown: string): string {
  return markdown
    .replace(/(^|\n)##\s*学費・通学スタイルの注意点[^\n]*\n[\s\S]*?(?=\n##\s|$)/g, '$1')
    .replace(/^\n+/, '')
    .trimEnd();
}

function extractAfterHeading(text: string, headingLineRe: RegExp): string {
  const match = text.match(headingLineRe);
  if (!match || match.index === undefined) return '';
  const bodyStart = match.index + match[0].length;
  const rest = text.slice(bodyStart);
  const nextIdx = rest.search(/\n##\s/);
  return (nextIdx === -1 ? rest : rest.slice(0, nextIdx)).trim();
}

function bulletsFromMarkdown(block: string): string[] {
  if (!block) return [];
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-・*]\s/.test(l))
    .map((l) => l.replace(/^[-・*]\s/, '').trim())
    .filter(Boolean);
}

/**
 * 公開済み summary_text から FV・詳細表示用に分割する。
 */
export function parseAiSummarySections(
  raw: string | null | undefined
): ParsedAiSummarySections {
  if (!raw?.trim()) return { ...EMPTY };

  const stripped = stripAiSummaryDisclaimer(raw);

  let overview = extractAfterHeading(stripped, /^##\s*判断材料のリード[^\n]*\n/m);
  if (!overview) {
    overview = extractAfterHeading(stripped, /^##\s*概要[^\n]*\n/m);
  }
  if (!overview) {
    const firstSection = stripped.search(/\n##\s/);
    if (firstSection === -1) {
      overview = stripped;
    } else {
      overview = stripped.slice(0, firstSection).trim();
    }
  }

  const fitsBlock = extractAfterHeading(stripped, /^##\s*この学校が合う人[^\n]*\n/m);
  const notFitsBlock = extractAfterHeading(stripped, /^##\s*この学校が合わない人[^\n]*\n/m);
  const tuitionBlock = extractAfterHeading(
    stripped,
    /^##\s*学費・通学スタイルの注意点[^\n]*\n/m
  );

  return {
    overviewPlain: overview.trim(),
    fitsBullets: bulletsFromMarkdown(fitsBlock),
    notFitsBullets: bulletsFromMarkdown(notFitsBlock),
    tuitionCommuteBullets: bulletsFromMarkdown(tuitionBlock),
  };
}

function takeBullets(bullets: string[], max: number): string[] {
  return bullets.slice(0, max);
}

/** FV用に各配列を最大件数に切る */
export function sliceSummaryForFv(
  parsed: ParsedAiSummarySections,
  maxPerList = 4
): ParsedAiSummarySections {
  return {
    overviewPlain: parsed.overviewPlain,
    fitsBullets: takeBullets(parsed.fitsBullets, maxPerList),
    notFitsBullets: takeBullets(parsed.notFitsBullets, maxPerList),
    tuitionCommuteBullets: takeBullets(parsed.tuitionCommuteBullets, maxPerList),
  };
}
