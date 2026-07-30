/**
 * 実質的な中身がない学校ページの判定。
 * GSC の「ソフト404」「クロール済み - インデックス未登録」を減らすため、
 * 学校詳細ページの noindex 判定と sitemap 除外で同じ基準を共有する。
 */

/** intro 単体で「中身あり」とみなす最小文字数（seo-coverage の薄さ判定と揃えている） */
export const MIN_INTRO_CHARS_FOR_INDEX = 120;

export interface ThinSchoolPageInput {
  reviewCount: number;
  intro?: string | null;
  /** 公開済みAI要約・SEO本文・FAQ・口コミ傾向のいずれかがあるか */
  hasPublishedAiContent?: boolean;
  hasTuitionEstimate?: boolean;
  hasCourseListing?: boolean;
}

/**
 * 口コミ・紹介文・AI生成本文・学費・コースのいずれも無い学校ページは、
 * 検索結果に出しても価値がないため noindex 対象とする。
 * highlights（短いタグ）は本文量にならないため判定材料に含めない。
 */
export function isThinSchoolPage(input: ThinSchoolPageInput): boolean {
  if (input.reviewCount > 0) return false;
  if ((input.intro ?? '').trim().length >= MIN_INTRO_CHARS_FOR_INDEX) return false;
  if (input.hasPublishedAiContent) return false;
  if (input.hasTuitionEstimate) return false;
  if (input.hasCourseListing) return false;
  return true;
}
