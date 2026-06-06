/** ISO文字列を JST の YYYY-MM-DD に変換 */
export function toJstDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
}

/** 配布記録の表示下限日（JST）。この日より前は QUO配布管理に出さない */
export function getGrantDisplayCutoffDate(campaignStartsAt: string | null | undefined): string | null {
  if (!campaignStartsAt) return null;
  return toJstDateKey(campaignStartsAt);
}

export function isGrantVisibleOnDisplay(
  grantCreatedAt: string,
  cutoffDateJst: string
): boolean {
  return toJstDateKey(grantCreatedAt) >= cutoffDateJst;
}
