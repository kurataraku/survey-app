import { cache } from 'react';
import { getSchoolsDataset } from '@/lib/schools/getSchoolsDataset';
import type { SearchSchool } from '@/lib/schools/searchSchools';
import {
  getCampusNearestStations,
  getStandingCampusLocationsInPrefecture,
} from '@/lib/schools/campusLocations';
import {
  normalizeAreaName,
  stripRailOperatorPrefix,
  toDisplayStationName,
} from '@/lib/regions/area-normalize';
import {
  computePrefectureLocationInsights,
  TOP_STATION_LIMIT,
  type PrefectureStationInsight,
} from '@/lib/schools/getPrefectureLocationInsights';
import { findRegionalReviewStat } from '@/lib/schools/regionalReviews';
import { buildAdmissionBadges, type AdmissionBadge } from '@/lib/schools/admissionProfiles';
import { buildTuitionTableCell } from '@/lib/tuition/format';
import {
  fetchRegionalReviewExcerpts,
  type RegionalReviewExcerpt,
} from '@/lib/schools/regionalReviewExcerpts';
import {
  buildCityFinderAreas,
  CITY_REGIONAL_CARD_LIMIT,
  SCHOOL_TYPE_FILTERS,
  type FinderAreas,
  type RegionalSchoolTier,
} from '@/lib/schools/regionalLanding';
import {
  buildRegionalThemeLists,
  type RegionalThemeList,
} from '@/lib/schools/regionalThemeLists';
import { selectRegionalHighlights } from '@/lib/schools/schoolHighlights';
import type { CityLandingConfig } from '@/lib/regions/city-landing';
import type { SchoolInstitutionType } from '@/lib/types/schools';

export type CitySchoolRow = {
  id: string;
  name: string;
  slug: string | null;
  institutionType: SchoolInstitutionType | null;
  headquartersPrefecture: string;
  /** 市内の常設拠点数 */
  campusCount: number;
  wards: string[];
  /** 表示用（最大2駅） */
  stations: string[];
  /** 絞り込み用（市内の全キャンパスの最寄り駅） */
  allStations: string[];
  /** 回答で市区町村まで申告された、この市のキャンパスの口コミ件数 */
  cityReviewCount: number;
  /** 県内キャンパスの口コミ件数（市内とは限らない。市の口コミとしては数えない） */
  prefectureReviewCount: number;
  reviewCount: number;
  overallAvg: number | null;
  /** 学校全体のサポート満足度・学費満足度と回答件数（テーマ別リスト用） */
  supportAvg: number | null;
  supportRatingCount: number;
  tuitionAvg: number | null;
  tuitionRatingCount: number;
  attendanceFrequencies: Record<string, number>;
  /** 管理画面の特徴・推しポイント（場所に関する項目を除いて最大3件） */
  highlights: string[];
  regionalOverallAvg: number | null;
  /** 学校全体の先生・職員の対応の満足度と回答件数 */
  staffAvg: number | null;
  staffRatingCount: number;
  /** 公開済みの初年度納入金の目安。金額が公開されていない学校は null */
  tuition: ReturnType<typeof buildTuitionTableCell>;
  admissionBadges: AdmissionBadge[];
  /** A=代表口コミカード、B=口コミ付き行、C=基本情報行 */
  tier: RegionalSchoolTier;
  /** 標準の並び順（県内の口コミが多い順） */
  defaultOrder: number;
  areaFilterIds: string[];
  excerpt: RegionalReviewExcerpt | null;
  listExcerpt: string | null;
};

export type CityWardInsight = {
  name: string;
  schoolCount: number;
  schools: Array<{ id: string; name: string; slug: string | null; stations: string[] }>;
};

export type CityLandingData = {
  config: CityLandingConfig;
  prefecture: string;
  municipality: string;
  rows: CitySchoolRow[];
  counts: {
    totalSchools: number;
    campusLocationCount: number;
    publicCount: number;
    privateCount: number;
    supportCount: number;
    admissionVerifiedCount: number;
  };
  wards: CityWardInsight[];
  topStations: PrefectureStationInsight[];
  finderAreas: FinderAreas;
  schoolTypeOptions: Array<{
    key: SchoolInstitutionType;
    label: string;
    schoolCount: number;
  }>;
  /** 学校全体の口コミから作るテーマ別リスト（該当校が少ないテーマは含まない） */
  themeLists: RegionalThemeList[];
  /** 県内キャンパスに通った人の口コミ抜粋（市内とは限らない） */
  reviewExcerpts: RegionalReviewExcerpt[];
  cityReviewCount: number;
  prefectureReviewCount: number;
  prefectureReviewSchoolCount: number;
  /** 掲載校の学校全体の総合満足度を口コミ件数で加重平均した値 */
  averageOverallSatisfaction: number | null;
  totalReviewCount: number;
  itemListSchools: { id: string; name: string; slug: string | null }[];
};

function localLocationsInCity(school: SearchSchool, config: CityLandingConfig) {
  return getStandingCampusLocationsInPrefecture(school.campus_locations, config.prefecture)
    .map((location) => ({ location, area: normalizeAreaName(location.city) }))
    .filter(({ area }) => area?.municipality === config.municipality);
}

function stationNames(locations: ReturnType<typeof localLocationsInCity>): string[] {
  return [
    ...new Set(
      locations
        .flatMap(({ location }) => getCampusNearestStations(location))
        .map((station) => toDisplayStationName(station))
        .filter((station): station is string => Boolean(station))
    ),
  ];
}

function toRow(school: SearchSchool, config: CityLandingConfig): CitySchoolRow {
  const locations = localLocationsInCity(school, config);
  const wards = [
    ...new Set(locations.map(({ area }) => area?.ward).filter((ward): ward is string => Boolean(ward))),
  ];
  const regional = findRegionalReviewStat(school.regional_reviews, config.prefecture);
  const city = regional?.municipalities?.[config.municipality] ?? null;
  const allStations = stationNames(locations);

  return {
    id: school.id,
    name: school.name,
    slug: school.slug,
    institutionType: school.institution_type,
    headquartersPrefecture: school.prefecture,
    campusCount: locations.length,
    wards,
    stations: allStations.slice(0, 2),
    allStations,
    cityReviewCount: city?.reviewCount ?? 0,
    prefectureReviewCount: regional?.reviewCount ?? 0,
    reviewCount: school.review_count,
    overallAvg: school.overall_avg,
    supportAvg: school.support_avg,
    supportRatingCount: school.support_rating_count,
    tuitionAvg: school.tuition_avg,
    tuitionRatingCount: school.tuition_rating_count,
    attendanceFrequencies: school.attendance_frequencies,
    highlights: selectRegionalHighlights(school.highlights),
    regionalOverallAvg: regional?.overallAvg ?? null,
    staffAvg: school.staff_avg,
    staffRatingCount: school.staff_rating_count,
    tuition: buildTuitionTableCell(school.tuition_estimate),
    admissionBadges: buildAdmissionBadges(school.admission_profile, config.prefecture),
    tier: school.review_count > 0 ? 'b' : 'c',
    defaultOrder: 0,
    areaFilterIds: [],
    excerpt: null,
    listExcerpt: school.latest_good_comment,
  };
}

/** 区が確認できた拠点だけで区ごとの学校一覧を作る（区が不明な拠点は比較表でのみ扱う） */
function buildWards(schools: SearchSchool[], config: CityLandingConfig): CityWardInsight[] {
  const wardMap = new Map<string, Map<string, { school: SearchSchool; locations: ReturnType<typeof localLocationsInCity> }>>();
  for (const school of schools) {
    for (const entry of localLocationsInCity(school, config)) {
      const ward = entry.area?.ward;
      if (!ward) continue;
      const bySchool = wardMap.get(ward) ?? new Map();
      const current = bySchool.get(school.id) ?? { school, locations: [] };
      current.locations.push(entry);
      bySchool.set(school.id, current);
      wardMap.set(ward, bySchool);
    }
  }
  return [...wardMap.entries()]
    .map(([name, bySchool]) => ({
      name,
      schoolCount: bySchool.size,
      schools: [...bySchool.values()]
        .sort((a, b) => b.school.review_count - a.school.review_count || a.school.name.localeCompare(b.school.name, 'ja'))
        .map(({ school, locations }) => ({
          id: school.id,
          name: school.name,
          slug: school.slug,
          stations: stationNames(locations).slice(0, 1),
        })),
    }))
    .sort((a, b) => b.schoolCount - a.schoolCount || a.name.localeCompare(b.name, 'ja'));
}

function weightedOverall(rows: CitySchoolRow[]): number | null {
  let sum = 0;
  let count = 0;
  for (const row of rows) {
    if (row.overallAvg != null && row.reviewCount > 0) {
      sum += row.overallAvg * row.reviewCount;
      count += row.reviewCount;
    }
  }
  return count > 0 ? parseFloat((sum / count).toFixed(1)) : null;
}

/**
 * 都市LPのデータ。掲載母集団は「市内に常設拠点（試験会場・説明会のみを除く）がある学校」に限る。
 * 県LPと同じ共有データセットから導出し、市の口コミは回答で市区町村まで申告されたものだけを数える。
 */
export const getCityLandingData = cache(async (config: CityLandingConfig): Promise<CityLandingData> => {
  const dataset = await getSchoolsDataset();
  const schools = dataset
    .filter((school) => localLocationsInCity(school, config).length > 0)
    .sort((a, b) => b.review_count - a.review_count || a.name.localeCompare(b.name, 'ja'));

  const baseRows = schools
    .map((school) => toRow(school, config))
    .sort(
      (a, b) =>
        b.cityReviewCount - a.cityReviewCount ||
        b.prefectureReviewCount - a.prefectureReviewCount ||
        b.reviewCount - a.reviewCount ||
        a.name.localeCompare(b.name, 'ja')
    );

  const insights = computePrefectureLocationInsights(schools, config.prefecture, {
    municipality: config.municipality,
    stationLimit: Number.POSITIVE_INFINITY,
  });

  const stationNamesInCity = insights.topStations.map((station) => station.name);
  const finder = buildCityFinderAreas(
    baseRows.map((row) => ({
      institutionType: row.institutionType,
      wards: row.wards,
      // 駅の集計（computePrefectureLocationInsights）と同じく、事業者名付きの駅は接頭辞なしの駅にまとめる
      stations: stationNamesInCity.filter((station) =>
        row.allStations.some((name) => name === station || stripRailOperatorPrefix(name) === station)
      ),
    }))
  );
  const rowsWithStations = baseRows.map((row, index) => ({
    ...row,
    defaultOrder: index,
    areaFilterIds: finder.areaFilterIds[index],
  }));

  const campusLocationsBySchool = new Map(schools.map((school) => [school.id, school.campus_locations]));
  const reviewExcerpts = await fetchRegionalReviewExcerpts({
    schools: rowsWithStations.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      localReviewCount: row.prefectureReviewCount,
      campusLocations: campusLocationsBySchool.get(row.id),
    })),
    prefecture: config.prefecture,
    municipality: config.municipality,
    // カードにするかは一覧の並び順で決めるため、抜粋は候補校すべてについて選んでおく
    limit: rowsWithStations.length,
  });
  const excerptBySchool = new Map(reviewExcerpts.map((excerpt) => [excerpt.schoolId, excerpt]));
  const featuredIds = new Set(
    rowsWithStations
      .filter((row) => row.prefectureReviewCount > 0 && excerptBySchool.has(row.id))
      .slice(0, CITY_REGIONAL_CARD_LIMIT)
      .map((row) => row.id)
  );
  const rows = rowsWithStations.map((row) => ({
    ...row,
    tier: featuredIds.has(row.id) ? ('a' as const) : row.reviewCount > 0 ? ('b' as const) : ('c' as const),
    excerpt: excerptBySchool.get(row.id) ?? null,
  }));

  const schoolTypeOptions = SCHOOL_TYPE_FILTERS.map((filter) => ({
    ...filter,
    schoolCount: rows.filter((row) => row.institutionType === filter.key).length,
  })).filter((option) => option.schoolCount > 0);

  return {
    config,
    prefecture: config.prefecture,
    municipality: config.municipality,
    rows,
    counts: {
      totalSchools: rows.length,
      campusLocationCount: rows.reduce((sum, row) => sum + row.campusCount, 0),
      publicCount: rows.filter((row) => row.institutionType === 'public').length,
      privateCount: rows.filter((row) => row.institutionType === 'private').length,
      supportCount: rows.filter((row) => row.institutionType === 'support').length,
      admissionVerifiedCount: rows.filter((row) => row.admissionBadges.length > 0).length,
    },
    wards: buildWards(schools, config),
    topStations: insights.topStations.slice(0, TOP_STATION_LIMIT),
    finderAreas: finder.areas,
    schoolTypeOptions,
    themeLists: buildRegionalThemeLists(rows),
    reviewExcerpts,
    cityReviewCount: rows.reduce((sum, row) => sum + row.cityReviewCount, 0),
    prefectureReviewCount: rows.reduce((sum, row) => sum + row.prefectureReviewCount, 0),
    prefectureReviewSchoolCount: rows.filter((row) => row.prefectureReviewCount > 0).length,
    averageOverallSatisfaction: weightedOverall(rows),
    totalReviewCount: rows.reduce((sum, row) => sum + row.reviewCount, 0),
    itemListSchools: rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug })),
  };
});
