export const REGIONAL_HIGHLIGHT_LIMIT = 3;

/**
 * 所在地・本校・キャンパス名など場所に関する特徴。
 * 地域LPでは別地域のキャンパス名（例: 「東京校と池袋校で通学」）が、その地域で通えるように読めてしまうため表示しない。
 * 場所は地域LP側の「通える場所」で示す。
 */
const LOCATION_HIGHLIGHT =
  /所在|本校|本部|校舎|キャンパス|学習センタ|拠点|駅|徒歩|(?<!登)校と|[都道府県](?:に|の|内)|[市区町](?:に|の|内)/;

export function isLocationHighlight(highlight: string): boolean {
  return LOCATION_HIGHLIGHT.test(highlight);
}

/** 管理画面で並べた順を優先度として、地域LPに出す特徴・推しポイントを選ぶ */
export function selectRegionalHighlights(
  highlights: string[] | null | undefined,
  limit = REGIONAL_HIGHLIGHT_LIMIT
): string[] {
  if (!highlights) return [];
  return highlights
    .map((highlight) => highlight.trim())
    .filter((highlight) => highlight !== '' && !isLocationHighlight(highlight))
    .slice(0, limit);
}
