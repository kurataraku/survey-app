import type { SchoolInstitutionType } from '@/lib/types/schools';

export type RegionalSchoolTier = 'a' | 'b' | 'c';

export const CITY_REGIONAL_CARD_LIMIT = 20;
export const CITY_FINDER_STATION_LIMIT = 6;
export const OTHER_STATION_FILTER_ID = 'station-other';

export const PREFECTURE_REGIONAL_CARD_LIMIT = 12;
export const PREFECTURE_FINDER_AREA_LIMIT = 8;
export const OTHER_AREA_FILTER_ID = 'area-other';
/** この校数以下の県では、絞り込んでも候補がほとんど変わらないため絞り込み欄を出さない */
export const PREFECTURE_FINDER_MAX_HIDDEN_SCHOOLS = 5;
/** この校数を超える県では、一覧を読み飛ばすページ内リンクを置く */
export const PREFECTURE_LIST_SKIP_LINK_MIN_SCHOOLS = 15;

export type FinderAreaOption = {
  id: string;
  label: string;
  schoolCount: number;
  typeCounts: Partial<Record<SchoolInstitutionType, number>>;
};

export function shouldShowPrefectureFinder(totalSchools: number): boolean {
  return totalSchools > PREFECTURE_FINDER_MAX_HIDDEN_SCHOOLS;
}

/**
 * 都道府県LPの市区町村の絞り込みID。上位の市区町村に当たればそのID、
 * 上位以外の市区町村にもキャンパスがあれば「その他の地域」も付ける。県内にキャンパスがなければ空配列。
 */
export function assignAreaFilterIds(
  municipalities: string[],
  areas: ReadonlyArray<{ id: string; label: string }>,
  otherId: string = OTHER_AREA_FILTER_ID
): string[] {
  const ids = areas.filter((area) => municipalities.includes(area.label)).map((area) => area.id);
  const labels = new Set(areas.map((area) => area.label));
  if (municipalities.some((municipality) => !labels.has(municipality))) ids.push(otherId);
  return ids;
}

/** 絞り込みボタンの件数。1校が複数の地域に当たる場合はそれぞれに数え、0校の選択肢は出さない */
export function buildFinderAreaOptions(
  rows: ReadonlyArray<{ areaFilterIds: string[]; institutionType: SchoolInstitutionType | null }>,
  areas: ReadonlyArray<{ id: string; label: string }>
): FinderAreaOption[] {
  return areas
    .map((area) => {
      const areaRows = rows.filter((row) => row.areaFilterIds.includes(area.id));
      return {
        ...area,
        schoolCount: areaRows.length,
        typeCounts: Object.fromEntries(
          SCHOOL_TYPE_FILTERS.map((filter) => [
            filter.key,
            areaRows.filter((row) => row.institutionType === filter.key).length,
          ])
        ) as Partial<Record<SchoolInstitutionType, number>>,
      };
    })
    .filter((area) => area.schoolCount > 0);
}

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
  school: { areaFilterIds: string[]; institutionType: SchoolInstitutionType | null },
  areaId: string,
  schoolType: SchoolInstitutionType | ''
): boolean {
  const areaMatches = !areaId || school.areaFilterIds.includes(areaId);
  const typeMatches = !schoolType || school.institutionType === schoolType;
  return areaMatches && typeMatches;
}

const LOCATION_WARD_LIMIT = 2;

/** 「中村区・中区（名古屋駅・栄駅）」の形の通える場所。区も駅も不明なら fallback を返す */
export function formatRegionalLocation(
  wards: string[],
  stations: string[],
  fallback: string
): string {
  const wardLabel =
    wards.slice(0, LOCATION_WARD_LIMIT).join('・') + (wards.length > LOCATION_WARD_LIMIT ? 'ほか' : '');
  const stationLabel = stations.join('・');
  if (wardLabel && stationLabel) return `${wardLabel}（${stationLabel}）`;
  return wardLabel || stationLabel || fallback;
}

/**
 * 都道府県LPの一覧の「通える場所」。県内キャンパスの登録がない学校は、
 * 県内に通える場所がないと断定せず「キャンパス情報なし」とだけ書く。
 */
export function formatPrefectureLocation(
  school: { localCities: string[]; localStations: string[]; localCampusCount: number },
  prefecture: string
): string {
  if (school.localCampusCount === 0) return 'キャンパス情報なし';
  return formatRegionalLocation(
    school.localCities,
    school.localStations,
    `${prefecture}内のキャンパス${school.localCampusCount}か所`
  );
}

export const NATIONAL_DIFF_MIN_ANSWERS = 3;

/**
 * 全国平均との差（小数1桁）。表示と同じく小数1桁に丸めた値どうしで引き、同じ点数の学校は同じ差になるようにする。
 * 回答が少ない学校は差が偶然に左右されるため null
 */
export function nationalAverageDiff(
  value: number | null,
  nationalAverage: number | null,
  answerCount: number
): number | null {
  if (value == null || nationalAverage == null || answerCount < NATIONAL_DIFF_MIN_ANSWERS) {
    return null;
  }
  const tenths = (v: number) => Math.round(Number(v.toFixed(1)) * 10);
  const diffTenths = tenths(value) - tenths(nationalAverage);
  return diffTenths === 0 ? 0 : diffTenths / 10;
}

/** Finder が絞り込み・並び替えに使う属性。行データを Client Component へ渡さずに済ませる */
export function regionalSchoolDataAttributes(
  school: RegionalSortableSchool & {
    areaFilterIds: string[];
    institutionType: SchoolInstitutionType | null;
  }
): Record<`data-${string}`, string | boolean> {
  return {
    'data-regional-school': true,
    'data-area-filters': school.areaFilterIds.join(' '),
    'data-school-type': school.institutionType ?? '',
    'data-default-order': String(school.defaultOrder),
    'data-rating': school.rating == null ? '' : String(school.rating),
    'data-review-count': String(school.reviewCount),
    'data-name': school.name,
  };
}
