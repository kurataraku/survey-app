function getFirst(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/**
 * 学校口コミ一覧が「デフォルト表示」（page=1・絞り込みなし・新着順）か。
 * canonical を学校ハブに寄せる判定に使う。
 */
export function isDefaultSchoolReviewsIndex(
  searchParams: Record<string, string | string[] | undefined> | undefined
): boolean {
  if (!searchParams) return true;

  const page = parseInt(getFirst(searchParams.page) || '1', 10);
  if (page !== 1) return false;

  const sort = getFirst(searchParams.sort) || 'newest';
  if (sort !== 'newest') return false;

  if (getFirst(searchParams.role)) return false;
  if (getFirst(searchParams.graduation_path)) return false;
  if (getFirst(searchParams.enrollment_type)) return false;
  if (getFirst(searchParams.attendance_frequency)) return false;
  if (getFirst(searchParams.campus_prefecture)) return false;

  const reasons = getFirst(searchParams.reason_for_choosing);
  if (reasons && reasons.split(',').some((x) => x.trim() !== '')) return false;

  return true;
}
