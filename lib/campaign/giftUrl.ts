/**
 * ギフトURL（QUOカードPay等）の同一性判定。
 * 末尾スラッシュ・クエリ・ハッシュ・ホストの大文字小文字の違いは同じURLとみなす。
 * カードIDは大文字小文字を区別する。
 */
export function normalizeGiftUrl(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return trimmed;
  }
}

/** URL末尾のカードID部分（DB検索の絞り込み用） */
export function giftUrlToken(value: string): string {
  const segments = normalizeGiftUrl(value).split('/');
  return segments[segments.length - 1] ?? '';
}

export function isSameGiftUrl(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeGiftUrl(a) === normalizeGiftUrl(b);
}
