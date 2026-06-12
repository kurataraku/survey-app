// コース一覧の表示整形ロジック

import type { PublicCourseListing } from '@/lib/types/courses';

const CARD_MAX_COURSES = 6;

/**
 * カード用の1行サマリー（例: 「週5日コース／週3日コース／オンラインコース ほか」）。
 * 表示できる内容がなければ null（カード側で行ごと非表示にする）。
 */
export function buildCourseCardSummary(listing: PublicCourseListing | null | undefined): string | null {
  if (!listing || listing.courses.length === 0) return null;
  const names = listing.courses.map((c) => c.name).filter(Boolean);
  if (names.length === 0) return null;
  const visible = names.slice(0, CARD_MAX_COURSES).join('／');
  return names.length > CARD_MAX_COURSES ? `${visible} ほか` : visible;
}
