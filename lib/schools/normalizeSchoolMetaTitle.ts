const META_TITLE_MAX = 60;

/**
 * 検索結果でCTRを意識した学校ページの title を返す。
 * AI meta があればそれを優先し、長すぎる場合は主要キーワードを残して短縮する。
 */
export function normalizeSchoolMetaTitle(
  schoolName: string,
  metaTitle: string | null | undefined,
  reviewCount: number
): string {
  const raw = metaTitle?.trim();
  if (raw) {
    if (raw.length <= META_TITLE_MAX) return raw;
    if (raw.includes('口コミ') || raw.includes('評判')) {
      return raw.slice(0, META_TITLE_MAX - 1).trimEnd() + '…';
    }
  }

  if (reviewCount > 0) {
    return `${schoolName}の口コミ・評判｜学費・スクーリングも解説`;
  }

  return `${schoolName}の口コミ・評判・学校情報｜通信制課程の特徴と注意点`;
}
