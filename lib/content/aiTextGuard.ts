/**
 * AI生成テキストの表示ガード。
 *
 * 生成失敗メッセージや引用番号などの生成用記号が公開画面へ出ないよう、表示直前に検査・除去する。
 * DB側の修正が完了するまでの防波堤であり、検出したデータは scripts/audit-ai-text-artifacts.ts で修正対象として抽出する。
 */

/** 生成失敗・拒否応答を示す文字列。いずれかを含む本文は表示しない */
const FAILURE_PATTERNS: RegExp[] = [
  /申し訳(ありません|ございません)/,
  /(情報|データ)が(見つかりません|確認できません)でした/,
  /お答えできません/,
  /回答(を)?(差し控え|できません)/,
  /(生成|取得)に失敗/,
  /エラーが発生しました/,
  /I (cannot|can't|am unable to)\b/i,
  /as an (AI|artificial intelligence)/i,
  /I'?m sorry/i,
];

/** 引用番号 [1] [1,2] 【1】 など、生成プロンプト由来の参照記号 */
const CITATION_PATTERN = /[［\[【]\s*\d+(\s*[,、]\s*\d+)*\s*[］\]】]/g;

/** プレーンテキスト欄に残ったMarkdown記号 */
const MARKDOWN_NOISE_PATTERNS: RegExp[] = [/\*\*/g, /^#{1,6}\s*/gm];

/** 生成失敗文を含むか */
export function hasGenerationFailureText(text: string | null | undefined): boolean {
  if (!text) return false;
  return FAILURE_PATTERNS.some((pattern) => pattern.test(text));
}

/** 引用番号（[1] など）を含むか。Markdown本文でも表示してはいけない記号 */
export function hasCitationMarkers(text: string | null | undefined): boolean {
  if (!text) return false;
  CITATION_PATTERN.lastIndex = 0;
  return CITATION_PATTERN.test(text);
}

/**
 * プレーンテキスト欄に不適切な記号を含むか。
 * Markdownとして描画する本文（AI要約）では見出しや強調は正常なので、この判定は使わない。
 */
export function hasGenerationArtifacts(text: string | null | undefined): boolean {
  if (!text) return false;
  if (hasCitationMarkers(text)) return true;
  return MARKDOWN_NOISE_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

/** 引用番号だけを除去する（Markdown構造を保ったまま使う場合に利用） */
export function stripCitationMarkers(text: string): string {
  return text
    .replace(CITATION_PATTERN, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([。、）])/g, '$1')
    .trim();
}

/**
 * プレーンテキスト欄の表示用本文を返す。
 * 生成失敗文を含む場合は null を返して非表示にし、引用番号やMarkdown記号は除去して本文を活かす。
 */
export function sanitizeAiText(text: string | null | undefined): string | null {
  if (!text) return null;
  if (hasGenerationFailureText(text)) return null;

  let cleaned = stripCitationMarkers(text);
  for (const pattern of MARKDOWN_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ').trim();

  return cleaned.length > 0 ? cleaned : null;
}
