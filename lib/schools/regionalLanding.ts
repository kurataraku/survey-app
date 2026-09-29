export type RegionalSchoolTier = 'a' | 'b' | 'c';

export type RegionalReviewFilterKey =
  | 'low-frequency'
  | 'transfer'
  | 'mental-relationship'
  | 'parent';

export const CITY_REGIONAL_CARD_LIMIT = 12;

export const REGIONAL_REVIEW_FILTERS: ReadonlyArray<{
  key: RegionalReviewFilterKey;
  label: string;
}> = [
  { key: 'low-frequency', label: '少ない通学日数' },
  { key: 'transfer', label: '転入の体験' },
  { key: 'mental-relationship', label: '心の不調・人間関係' },
  { key: 'parent', label: '保護者の声' },
];

type FinderReviewStat = {
  attendanceFrequencies: Record<string, number>;
  enrollmentTypes: Record<string, number>;
  reasonGroups?: Record<string, number>;
  respondentRoles?: Record<string, number>;
};

const LOW_FREQUENCY_VALUES = ['週1〜2', '月1〜数回', 'ほぼオンライン/自宅'];

/** 地域口コミの集計から、Finderで使う短いフラグだけを作る。 */
export function buildRegionalReviewFilterKeys(
  stat: FinderReviewStat | null | undefined
): RegionalReviewFilterKey[] {
  if (!stat) return [];
  const keys: RegionalReviewFilterKey[] = [];
  if (LOW_FREQUENCY_VALUES.some((value) => (stat.attendanceFrequencies[value] ?? 0) > 0)) {
    keys.push('low-frequency');
  }
  if ((stat.enrollmentTypes['転入学（他校から転校）'] ?? 0) > 0) {
    keys.push('transfer');
  }
  if ((stat.reasonGroups?.mental_relationship ?? 0) > 0) {
    keys.push('mental-relationship');
  }
  if ((stat.respondentRoles?.保護者 ?? 0) > 0) {
    keys.push('parent');
  }
  return keys;
}

export function matchesRegionalSchoolFilters(
  school: { stationFilterIds: string[]; reviewFilterKeys: RegionalReviewFilterKey[] },
  stationId: string,
  reviewFilter: RegionalReviewFilterKey | ''
): boolean {
  const stationMatches = !stationId || school.stationFilterIds.includes(stationId);
  const reviewMatches = !reviewFilter || school.reviewFilterKeys.includes(reviewFilter);
  return stationMatches && reviewMatches;
}
