import type { SchoolInstitutionType } from '@/lib/types/schools';

export type RegionalSchoolTier = 'a' | 'b' | 'c';

export const CITY_REGIONAL_CARD_LIMIT = 20;
export const CITY_FINDER_STATION_LIMIT = 6;

export const PREFECTURE_REGIONAL_CARD_LIMIT = 12;
export const PREFECTURE_FINDER_AREA_LIMIT = 8;
/** スマホでボタンとして並べる地域の上限。残りは一覧（ダイアログ）から選ぶ */
export const FINDER_MOBILE_AREA_LIMIT = 4;
/** この校数以下の県では、絞り込んでも候補がほとんど変わらないため絞り込み欄を出さない */
export const PREFECTURE_FINDER_MAX_HIDDEN_SCHOOLS = 5;
/** この校数を超える県では、一覧を読み飛ばすページ内リンクを置く */
export const PREFECTURE_LIST_SKIP_LINK_MIN_SCHOOLS = 15;

export type FinderAreaOption = {
  id: string;
  label: string;
  /**
   * 一覧の外（ボタン・選択中の表示）で使う名前。区は親の市を含めた「大阪市北区」、
   * 政令指定都市の市全体は「大阪市」（一覧の中では label の「大阪市全体」）。label で足りる場合は省略
   */
  fullLabel?: string;
  schoolCount: number;
  /** 0校の種類は持たない */
  typeCounts: Partial<Record<SchoolInstitutionType, number>>;
};

export type FinderAreaGroup = {
  /** 見出し。まとまりが1つだけなら null */
  label: string | null;
  options: FinderAreaOption[];
};

export type FinderAreas = {
  /** 一覧（ダイアログ）に並べるすべての地域 */
  groups: FinderAreaGroup[];
  /** ボタンとして並べる地域（校数の多い順） */
  featuredIds: string[];
};

export type FinderAreasResult = {
  areas: FinderAreas;
  /** 入力の行と同じ順の、各校の絞り込みID */
  areaFilterIds: string[][];
};

export function shouldShowPrefectureFinder(totalSchools: number): boolean {
  return totalSchools > PREFECTURE_FINDER_MAX_HIDDEN_SCHOOLS;
}

type FinderRow = { institutionType: SchoolInstitutionType | null };

function addIndex(map: Map<string, Set<number>>, key: string, index: number) {
  const indexes = map.get(key) ?? new Set<number>();
  indexes.add(index);
  map.set(key, indexes);
}

function sortByCount(map: Map<string, Set<number>>): Array<[string, Set<number>]> {
  return [...map.entries()].sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0], 'ja'));
}

function toOption(
  id: string,
  label: string,
  indexes: Set<number>,
  rows: ReadonlyArray<FinderRow>,
  fullLabel?: string
): FinderAreaOption {
  const typeCounts: Partial<Record<SchoolInstitutionType, number>> = {};
  for (const index of indexes) {
    const type = rows[index].institutionType;
    if (type) typeCounts[type] = (typeCounts[type] ?? 0) + 1;
  }
  return { id, label, ...(fullLabel ? { fullLabel } : {}), schoolCount: indexes.size, typeCounts };
}

function assignIds(entries: Array<[string, Set<number>]>, options: FinderAreaOption[], filterIds: string[][]) {
  entries.forEach(([, indexes], position) => {
    for (const index of indexes) filterIds[index].push(options[position].id);
  });
}

/**
 * 都道府県LPの市区町村の絞り込み。県内にキャンパスがある市区町村をすべて選べるようにし、
 * 政令指定都市は市全体に加えて区でも選べるようにする。1校が複数の地域に当たる場合はそれぞれに数える。
 */
export function buildPrefectureFinderAreas(
  prefecture: string,
  rows: ReadonlyArray<
    FinderRow & {
      localMunicipalities: string[];
      localWards: Array<{ municipality: string; ward: string }>;
    }
  >,
  featuredLimit: number = PREFECTURE_FINDER_AREA_LIMIT
): FinderAreasResult {
  const byMunicipality = new Map<string, Set<number>>();
  const byWard = new Map<string, Map<string, Set<number>>>();
  rows.forEach((row, index) => {
    for (const municipality of row.localMunicipalities) addIndex(byMunicipality, municipality, index);
    for (const { municipality, ward } of row.localWards) {
      const wards = byWard.get(municipality) ?? new Map<string, Set<number>>();
      addIndex(wards, ward, index);
      byWard.set(municipality, wards);
    }
  });

  const filterIds = rows.map(() => [] as string[]);
  const municipalities = sortByCount(byMunicipality);
  const municipalityOptions = municipalities.map(([name, indexes], position) =>
    toOption(`a${position + 1}`, name, indexes, rows)
  );
  assignIds(municipalities, municipalityOptions, filterIds);

  const designatedGroups: FinderAreaGroup[] = [];
  const kindOptions = { ward: [] as FinderAreaOption[], city: [] as FinderAreaOption[], town: [] as FinderAreaOption[] };
  municipalities.forEach(([name], position) => {
    const option = municipalityOptions[position];
    const wards = byWard.get(name);
    if (wards) {
      const wardEntries = sortByCount(wards);
      const wardOptions = wardEntries.map(([ward, indexes], wardPosition) =>
        toOption(`${option.id}-${wardPosition + 1}`, ward, indexes, rows, `${name}${ward}`)
      );
      assignIds(wardEntries, wardOptions, filterIds);
      const wholeCity = { ...option, label: `${name}全体`, fullLabel: name };
      municipalityOptions[position] = wholeCity;
      designatedGroups.push({ label: name, options: [wholeCity, ...wardOptions] });
    } else if (name.endsWith('区')) {
      kindOptions.ward.push(option);
    } else if (name.endsWith('市')) {
      kindOptions.city.push(option);
    } else {
      kindOptions.town.push(option);
    }
  });

  const groups = [
    ...designatedGroups,
    { label: prefecture === '東京都' ? '23区' : '区', options: kindOptions.ward },
    { label: designatedGroups.length > 0 ? 'そのほかの市' : '市', options: kindOptions.city },
    { label: '町・村', options: kindOptions.town },
  ].filter((group) => group.options.length > 0);

  return {
    areas: {
      groups: groups.length === 1 ? [{ ...groups[0], label: null }] : groups,
      featuredIds: municipalityOptions.slice(0, featuredLimit).map((option) => option.id),
    },
    areaFilterIds: filterIds,
  };
}

/** 都市LPの区・最寄り駅の絞り込み。ボタンは校数の多い駅、一覧ではすべての区と駅から選べる */
export function buildCityFinderAreas(
  rows: ReadonlyArray<FinderRow & { wards: string[]; stations: string[] }>,
  featuredLimit: number = CITY_FINDER_STATION_LIMIT
): FinderAreasResult {
  const byWard = new Map<string, Set<number>>();
  const byStation = new Map<string, Set<number>>();
  rows.forEach((row, index) => {
    for (const ward of row.wards) addIndex(byWard, ward, index);
    for (const station of row.stations) addIndex(byStation, station, index);
  });

  const filterIds = rows.map(() => [] as string[]);
  const wards = sortByCount(byWard);
  const wardOptions = wards.map(([name, indexes], position) => toOption(`w${position + 1}`, name, indexes, rows));
  assignIds(wards, wardOptions, filterIds);
  const stations = sortByCount(byStation);
  const stationOptions = stations.map(([name, indexes], position) =>
    toOption(`s${position + 1}`, name, indexes, rows)
  );
  assignIds(stations, stationOptions, filterIds);

  return {
    areas: {
      groups: [
        { label: '区', options: wardOptions },
        { label: '最寄り駅', options: stationOptions },
      ].filter((group) => group.options.length > 0),
      featuredIds: (stationOptions.length >= 2 ? stationOptions : wardOptions)
        .slice(0, featuredLimit)
        .map((option) => option.id),
    },
    areaFilterIds: filterIds,
  };
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
