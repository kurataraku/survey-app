import type { SchoolInstitutionType } from '@/lib/types/schools';

export type RegionalSchoolTier = 'a' | 'b' | 'c';

export const CITY_REGIONAL_CARD_LIMIT = 12;
export const CITY_FINDER_STATION_LIMIT = 6;
export const OTHER_STATION_FILTER_ID = 'station-other';

export const SCHOOL_TYPE_FILTERS: ReadonlyArray<{
  key: SchoolInstitutionType;
  label: string;
}> = [
  { key: 'public', label: '公立の通信制高校' },
  { key: 'private', label: '私立の通信制高校' },
  { key: 'support', label: 'サポート校（通信制高校と併用）' },
];

export type RegionalSortKey =
  | 'default'
  | 'rating-desc'
  | 'rating-asc'
  | 'reviews-desc'
  | 'reviews-asc';

export const REGIONAL_SORT_OPTIONS: ReadonlyArray<{ key: RegionalSortKey; label: string }> = [
  { key: 'default', label: '標準' },
  { key: 'rating-desc', label: '総合満足度が高い順' },
  { key: 'rating-asc', label: '総合満足度が低い順' },
  { key: 'reviews-desc', label: '口コミが多い順' },
  { key: 'reviews-asc', label: '口コミが少ない順' },
];

/** 満足度順で順位を付ける最小の口コミ件数。未満の学校は順位付けせず後ろにまとめる */
export const RATING_SORT_MIN_REVIEWS = 3;

export type RegionalSortableSchool = {
  name: string;
  defaultOrder: number;
  /** 学校全体の総合満足度 */
  rating: number | null;
  /** 学校全体の口コミ件数 */
  reviewCount: number;
};

function ratingGroup(school: RegionalSortableSchool): number {
  if (school.rating == null || school.reviewCount === 0) return 2;
  return school.reviewCount >= RATING_SORT_MIN_REVIEWS ? 0 : 1;
}

export function compareRegionalSchools(
  a: RegionalSortableSchool,
  b: RegionalSortableSchool,
  sort: RegionalSortKey
): number {
  const byName = a.name.localeCompare(b.name, 'ja');
  switch (sort) {
    case 'rating-desc':
    case 'rating-asc': {
      const group = ratingGroup(a) - ratingGroup(b);
      if (group !== 0) return group;
      const direction = sort === 'rating-desc' ? -1 : 1;
      const rating = ((a.rating ?? 0) - (b.rating ?? 0)) * direction;
      return rating || b.reviewCount - a.reviewCount || byName;
    }
    case 'reviews-desc':
      return b.reviewCount - a.reviewCount || byName;
    case 'reviews-asc':
      return a.reviewCount - b.reviewCount || byName;
    default:
      return a.defaultOrder - b.defaultOrder;
  }
}

export function matchesRegionalSchoolFilters(
  school: { stationFilterIds: string[]; institutionType: SchoolInstitutionType | null },
  stationId: string,
  schoolType: SchoolInstitutionType | ''
): boolean {
  const stationMatches = !stationId || school.stationFilterIds.includes(stationId);
  const typeMatches = !schoolType || school.institutionType === schoolType;
  return stationMatches && typeMatches;
}

/** Finder が絞り込み・並び替えに使う属性。行データを Client Component へ渡さずに済ませる */
export function regionalSchoolDataAttributes(
  school: RegionalSortableSchool & {
    stationFilterIds: string[];
    institutionType: SchoolInstitutionType | null;
  }
): Record<`data-${string}`, string | boolean> {
  return {
    'data-regional-school': true,
    'data-station-filters': school.stationFilterIds.join(' '),
    'data-school-type': school.institutionType ?? '',
    'data-default-order': String(school.defaultOrder),
    'data-rating': school.rating == null ? '' : String(school.rating),
    'data-review-count': String(school.reviewCount),
    'data-name': school.name,
  };
}
