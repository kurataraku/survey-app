/**
 * 平日・休日を問わず、JST 9:00〜18:59 を提案補充ウィンドウとする。
 * Cronは毎時17分なので、実質 9:17〜18:17 のtickが対象になる。
 */
export function isWithinSeoLoopReplenishWindow(now = new Date()): boolean {
  const hourText = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    hour: 'numeric',
    hour12: false,
  }).format(now);
  const hour = Number.parseInt(hourText, 10);
  return Number.isFinite(hour) && hour >= 9 && hour < 19;
}
