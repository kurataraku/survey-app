/** ISO文字列を JST の YYYY-MM-DD に変換 */
export function toJstDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
}

/**
 * キャンペーン開始前（JST 2026-05-18 以前）のデータを管理画面から非表示にする。
 * 2026-05-19 00:00 JST 以降のみ表示する。
 */
export const PRE_CAMPAIGN_CUTOFF_JST = '2026-05-18';

/** 2026-05-19 00:00:00 JST */
export const CAMPAIGN_ADMIN_VISIBLE_FROM_UTC = '2026-05-18T15:00:00.000Z';

export function isVisibleAfterCampaignStart(iso: string): boolean {
  return toJstDateKey(iso) > PRE_CAMPAIGN_CUTOFF_JST;
}
