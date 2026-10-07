import { cache } from 'react';
import { getSchoolsDataset } from '@/lib/schools/getSchoolsDataset';
import type { SearchSchool } from '@/lib/schools/searchSchools';
import {
  computePrefectureLocationInsights,
  type PrefectureLocationInsights,
} from '@/lib/schools/getPrefectureLocationInsights';
import {
  getPrefectureAttendanceFrequencyLinks,
  type PrefectureAttendanceLink,
} from '@/lib/schools/prefecture-landing-attendance';
import {
  PREFECTURE_LANDING_HIGHLIGHT_LIMIT,
  PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING,
} from '@/lib/schools/prefecture-landing-constants';
import {
  getCampusNearestStations,
  getStandingCampusLocationsInPrefecture,
} from '@/lib/schools/campusLocations';
import { normalizeAreaName, toDisplayStationName } from '@/lib/regions/area-normalize';
import { buildTuitionTableCell } from '@/lib/tuition/format';
import {
  fetchRegionalReviewExcerpts,
  type RegionalReviewExcerpt,
} from '@/lib/schools/regionalReviewExcerpts';
import {
  findRegionalReviewStat,
  summarizeRegionalReviews,
  type RegionalReviewStat,
  type RegionalReviewSummary,
} from '@/lib/schools/regionalReviews';
import type { PrefectureLandingCopyStats } from '@/lib/prefectures/prefecture-landing-copy';
import type { SchoolInstitutionType } from '@/lib/types/schools';
import { buildAdmissionBadges, type AdmissionBadge } from '@/lib/schools/admissionProfiles';
import { getCityLandingPath, getCityLandingsForPrefecture } from '@/lib/regions/city-landing';
import { getCityLandingData } from '@/lib/schools/getCityLandingData';
import {
  assignAreaFilterIds,
  buildFinderAreaOptions,
  OTHER_AREA_FILTER_ID,
  PREFECTURE_FINDER_AREA_LIMIT,
  PREFECTURE_REGIONAL_CARD_LIMIT,
  SCHOOL_TYPE_FILTERS,
  type FinderAreaOption,
} from '@/lib/schools/regionalLanding';
import { selectRegionalHighlights } from '@/lib/schools/schoolHighlights';

/** 一覧の1校分。口コミ本文はカードに載せる学校（featured）だけが持つ */
export type PrefectureSchoolRow = {
  id: string;
  name: string;
  slug: string | null;
  institutionType: SchoolInstitutionType | null;
  /** 本校所在地（DBの prefecture） */
  headquartersPrefecture: string;
  /** 本校がこの都道府県にあるか */
  hasLocalHeadquarters: boolean;
  /** この都道府県内のキャンパス拠点数 */
  localCampusCount: number;
  localCities: string[];
  localStations: string[];
  /** 学校全体の公開口コミ件数（全国の回答を含む） */
  reviewCount: number;
  /** この都道府県のキャンパスに通ったと回答した口コミ件数 */
  localReviewCount: number;
  /** この都道府県の回答だけで算出した総合満足度 */
  localOverallAvg: number | null;
  overallAvg: number | null;
  supportAvg: number | null;
  tuitionAvg: number | null;
  /** 公開済みの初年度納入金の目安。金額が公開されていない学校は null */
  tuition: ReturnType<typeof buildTuitionTableCell>;
  /** 公式情報で確認済み（12か月以内）の募集区域・スクーリング会場。未確認なら空配列 */
  admissionBadges: AdmissionBadge[];
  /** 管理画面の特徴・推しポイント（場所に関する項目を除いて最大3件） */
  highlights: string[];
  /** 学校全体の先生・職員の対応の満足度と回答件数 */
  staffAvg: number | null;
  staffRatingCount: number;
  /** 県内キャンパスの市区町村（政令指定都市は親市単位）。絞り込みに使う */
  localMunicipalities: string[];
  /** 一覧の標準の並び順（県内の口コミが多い順、次に学校全体の口コミが多い順） */
  defaultOrder: number;
  areaFilterIds: string[];
  /** カードに載せる県内キャンパスの代表口コミ。カードに載せない学校は null */
  excerpt: RegionalReviewExcerpt | null;
};

export type PrefectureRegionalCounts = {
  /** 掲載校数（県内本校または県内キャンパスで関連付いた学校） */
  totalSchools: number;
  /** 本校がこの都道府県にある学校数 */
  localHeadquartersCount: number;
  /** この都道府県にキャンパスがある学校数 */
  localCampusSchoolCount: number;
  /** この都道府県内のキャンパス拠点数（学校数とは別に数える） */
  localCampusLocationCount: number;
  /** 県内拠点が未登録で、対応都道府県としてのみ関連付いている学校数 */
  withoutLocalLocationCount: number;
  publicCount: number;
  privateCount: number;
  supportCount: number;
  /** 募集区域・スクーリング会場を公式情報で確認済み（12か月以内）の学校数 */
  admissionVerifiedCount: number;
};

export type PrefectureRankingEntry = {
  row: PrefectureSchoolRow;
  /** ランキングの根拠として表示する値 */
  metricLabel: string;
};

export type PrefectureLandingData = {
  prefecture: string;
  rows: PrefectureSchoolRow[];
  counts: PrefectureRegionalCounts;
  schoolsWithReviewsCount: number;
  totalReviewCount: number;
  /** この都道府県のキャンパスに通ったと回答した口コミ件数 */
  localReviewCount: number;
  /** 地域口コミが1件以上ある掲載校数 */
  localReviewSchoolCount: number;
  /** 地域口コミの通学頻度・入学タイミング分布 */
  regionalReviewSummary: RegionalReviewSummary;
  /** 初年度納入金の目安を公開している掲載校（口コミ件数順） */
  tuitionRows: PrefectureSchoolRow[];
  /** 県内キャンパスの代表口コミをカードで紹介する学校（標準の並び順、最大12校） */
  featuredRows: PrefectureSchoolRow[];
  /** カード以外の掲載校（標準の並び順） */
  otherRows: PrefectureSchoolRow[];
  finderAreas: FinderAreaOption[];
  schoolTypeOptions: Array<{ key: SchoolInstitutionType; label: string; schoolCount: number }>;
  averageOverallSatisfaction: number | null;
  averageTuitionSatisfaction: number | null;
  topByLocalReviewCount: PrefectureRankingEntry[];
  topByReviewCount: PrefectureRankingEntry[];
  topByRating: PrefectureRankingEntry[];
  topBySupport: PrefectureRankingEntry[];
  topByTuition: PrefectureRankingEntry[];
  rowsByInstitutionType: Record<SchoolInstitutionType, PrefectureSchoolRow[]>;
  attendanceFrequencyLinks: PrefectureAttendanceLink[];
  locationInsights: PrefectureLocationInsights;
  /** title/description/リード文へ実数を入れるための材料 */
  copyStats: PrefectureLandingCopyStats;
  /** JSON-LD の ItemList 用 */
  itemListSchools: { id: string; name: string; slug: string | null }[];
  /** この都道府県で公開中の都市LP（appPath 前のパス） */
  cityLandings: { municipality: string; path: string }[];
};

function hasLocalCampus(school: SearchSchool, prefecture: string): boolean {
  return getStandingCampusLocationsInPrefecture(school.campus_locations, prefecture).length > 0;
}

function isRelatedToPrefecture(school: SearchSchool, prefecture: string): boolean {
  if (school.prefecture === prefecture) return true;
  if (school.prefectures?.includes(prefecture)) return true;
  return hasLocalCampus(school, prefecture);
}

function toRow(school: SearchSchool, prefecture: string): PrefectureSchoolRow {
  const localLocations = getStandingCampusLocationsInPrefecture(school.campus_locations, prefecture);
  const localAreas = localLocations
    .map((location) => normalizeAreaName(location.city))
    .filter((area): area is NonNullable<typeof area> => area !== null);
  const localCities = [...new Set(localAreas.map((area) => area.city))];
  const localMunicipalities = [...new Set(localAreas.map((area) => area.municipality))];
  const localStations = [
    ...new Set(
      localLocations
        .flatMap((location) => getCampusNearestStations(location))
        .map((station) => toDisplayStationName(station))
        .filter((station): station is string => Boolean(station))
    ),
  ];
  const regional = findRegionalReviewStat(school.regional_reviews, prefecture);

  return {
    id: school.id,
    name: school.name,
    slug: school.slug,
    institutionType: school.institution_type,
    headquartersPrefecture: school.prefecture,
    hasLocalHeadquarters: school.prefecture === prefecture,
    localCampusCount: localLocations.length,
    localCities,
    localStations: localStations.slice(0, 2),
    reviewCount: school.review_count,
    localReviewCount: regional?.reviewCount ?? 0,
    localOverallAvg: regional?.overallAvg ?? null,
    overallAvg: school.overall_avg,
    supportAvg: school.support_avg,
    tuitionAvg: school.tuition_avg,
    tuition: buildTuitionTableCell(school.tuition_estimate),
    admissionBadges: buildAdmissionBadges(school.admission_profile, prefecture),
    highlights: selectRegionalHighlights(school.highlights),
    staffAvg: school.staff_avg,
    staffRatingCount: school.staff_rating_count,
    localMunicipalities,
    defaultOrder: 0,
    areaFilterIds: [],
    excerpt: null,
  };
}

/** 都市LPのカードで使っている口コミ。県LPでは同じ学校に別の口コミがあればそちらを選ぶ */
async function getCityLandingCardReviewIds(prefecture: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const config of getCityLandingsForPrefecture(prefecture)) {
    try {
      const city = await getCityLandingData(config);
      for (const row of city.rows) {
        if (row.tier === 'a' && row.excerpt) ids.add(row.excerpt.id);
      }
    } catch (error) {
      console.error('[getPrefectureLandingData] 都市LPの口コミ取得エラー:', error);
    }
  }
  return ids;
}

function computeWeightedAverage(
  schools: SearchSchool[],
  field: 'overall_avg' | 'tuition_avg'
): number | null {
  let weightedSum = 0;
  let weightedCount = 0;
  for (const school of schools) {
    const rating = school[field];
    if (rating != null && school.review_count > 0) {
      weightedSum += rating * school.review_count;
      weightedCount += school.review_count;
    }
  }
  if (weightedCount === 0) return null;
  return parseFloat((weightedSum / weightedCount).toFixed(2));
}

function buildRanking(
  rows: PrefectureSchoolRow[],
  field: 'overallAvg' | 'supportAvg' | 'tuitionAvg',
  format: (value: number) => string
): PrefectureRankingEntry[] {
  return rows
    .filter((row) => row.reviewCount >= PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING && row[field] != null)
    .sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0) || b.reviewCount - a.reviewCount)
    .slice(0, PREFECTURE_LANDING_HIGHLIGHT_LIMIT)
    .map((row) => ({ row, metricLabel: format(row[field] as number) }));
}

/**
 * 都道府県LPが必要とする全データを、共有データセットから1回の取得で導出する。
 *
 * 掲載母集団は「本校が県内」「県内にキャンパスがある」「対応都道府県に含まれる」のいずれかで関連付いた学校。
 * 掲載校数・ランキング母集団・市区町村・駅の集計をすべて同じ集合から算出し、画面とmetadata、JSON-LDの数値を一致させる。
 */
export const getPrefectureLandingData = cache(
  async (prefecture: string): Promise<PrefectureLandingData> => {
    const dataset = await getSchoolsDataset();
    const schools = dataset
      .filter((school) => isRelatedToPrefecture(school, prefecture))
      .sort((a, b) => b.review_count - a.review_count || a.name.localeCompare(b.name, 'ja'));

    const baseRows = schools.map((school) => toRow(school, prefecture));
    const locationInsights = computePrefectureLocationInsights(schools, prefecture);

    const areaDefinitions = locationInsights.topCities
      .slice(0, PREFECTURE_FINDER_AREA_LIMIT)
      .map((city, index) => ({ id: `area-${index + 1}`, label: city.city }));
    const orderById = new Map(
      [...baseRows]
        .sort(
          (a, b) =>
            b.localReviewCount - a.localReviewCount ||
            b.reviewCount - a.reviewCount ||
            a.name.localeCompare(b.name, 'ja')
        )
        .map((row, index) => [row.id, index])
    );

    const campusLocationsBySchool = new Map(schools.map((school) => [school.id, school.campus_locations]));
    const excerpts = await fetchRegionalReviewExcerpts({
      schools: baseRows.map((row) => ({ ...row, campusLocations: campusLocationsBySchool.get(row.id) })),
      prefecture,
      // カードにするかは一覧の並び順で決めるため、抜粋は候補校すべてについて選んでおく
      limit: baseRows.length,
      excludeReviewIds: await getCityLandingCardReviewIds(prefecture),
    });
    const excerptBySchool = new Map(excerpts.map((excerpt) => [excerpt.schoolId, excerpt]));
    const featuredIds = new Set(
      [...baseRows]
        .filter((row) => row.localReviewCount > 0 && excerptBySchool.has(row.id))
        .sort((a, b) => (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0))
        .slice(0, PREFECTURE_REGIONAL_CARD_LIMIT)
        .map((row) => row.id)
    );

    const rows = baseRows.map((row) => ({
      ...row,
      defaultOrder: orderById.get(row.id) ?? 0,
      areaFilterIds: assignAreaFilterIds(row.localMunicipalities, areaDefinitions),
      excerpt: featuredIds.has(row.id) ? excerptBySchool.get(row.id) ?? null : null,
    }));
    const listRows = [...rows].sort((a, b) => a.defaultOrder - b.defaultOrder);

    const localCampusLocationCount = rows.reduce((sum, row) => sum + row.localCampusCount, 0);

    const counts: PrefectureRegionalCounts = {
      totalSchools: rows.length,
      localHeadquartersCount: rows.filter((row) => row.hasLocalHeadquarters).length,
      localCampusSchoolCount: rows.filter((row) => row.localCampusCount > 0).length,
      localCampusLocationCount,
      withoutLocalLocationCount: rows.filter(
        (row) => !row.hasLocalHeadquarters && row.localCampusCount === 0
      ).length,
      publicCount: rows.filter((row) => row.institutionType === 'public').length,
      privateCount: rows.filter((row) => row.institutionType === 'private').length,
      supportCount: rows.filter((row) => row.institutionType === 'support').length,
      admissionVerifiedCount: rows.filter((row) => row.admissionBadges.length > 0).length,
    };

    const rowsByInstitutionType: Record<SchoolInstitutionType, PrefectureSchoolRow[]> = {
      public: rows.filter((row) => row.institutionType === 'public'),
      private: rows.filter((row) => row.institutionType === 'private'),
      support: rows.filter((row) => row.institutionType === 'support'),
    };

    const topByReviewCount = rows
      .filter((row) => row.reviewCount > 0)
      .slice(0, PREFECTURE_LANDING_HIGHLIGHT_LIMIT)
      .map((row) => ({ row, metricLabel: `口コミ${row.reviewCount}件` }));

    const totalReviewCount = rows.reduce((sum, row) => sum + row.reviewCount, 0);
    const localReviewCount = rows.reduce((sum, row) => sum + row.localReviewCount, 0);

    const localStats: RegionalReviewStat[] = schools
      .map((school) => findRegionalReviewStat(school.regional_reviews, prefecture))
      .filter((stat): stat is RegionalReviewStat => stat !== null);
    const regionalReviewSummary = summarizeRegionalReviews(localStats, prefecture);

    const topByLocalReviewCount = [...rows]
      .filter((row) => row.localReviewCount > 0)
      .sort((a, b) => b.localReviewCount - a.localReviewCount || b.reviewCount - a.reviewCount)
      .slice(0, PREFECTURE_LANDING_HIGHLIGHT_LIMIT)
      .map((row) => ({ row, metricLabel: `${prefecture}内の口コミ${row.localReviewCount}件` }));

    const tuitionRows = rows.filter((row) => row.tuition !== null);

    const copyStats: PrefectureLandingCopyStats = {
      totalSchools: counts.totalSchools,
      localCampusLocationCount: counts.localCampusLocationCount,
      publicCount: counts.publicCount,
      supportCount: counts.supportCount,
      totalReviewCount,
      localReviewCount,
      localReviewSchoolCount: regionalReviewSummary.schoolCount,
      cityCount: locationInsights.cityCount,
      topCities: locationInsights.topCities.map((city) => city.city),
      topStations: locationInsights.topStations.map((station) => station.name),
    };

    return {
      prefecture,
      rows,
      counts,
      schoolsWithReviewsCount: rows.filter((row) => row.reviewCount > 0).length,
      totalReviewCount,
      localReviewCount,
      localReviewSchoolCount: regionalReviewSummary.schoolCount,
      regionalReviewSummary,
      tuitionRows,
      featuredRows: listRows.filter((row) => row.excerpt !== null),
      otherRows: listRows.filter((row) => row.excerpt === null),
      finderAreas: buildFinderAreaOptions(rows, [
        ...areaDefinitions,
        { id: OTHER_AREA_FILTER_ID, label: 'その他の地域' },
      ]),
      schoolTypeOptions: SCHOOL_TYPE_FILTERS.map((filter) => ({
        ...filter,
        schoolCount: rows.filter((row) => row.institutionType === filter.key).length,
      })).filter((option) => option.schoolCount > 0),
      averageOverallSatisfaction: computeWeightedAverage(schools, 'overall_avg'),
      averageTuitionSatisfaction: computeWeightedAverage(schools, 'tuition_avg'),
      topByLocalReviewCount,
      topByReviewCount,
      topByRating: buildRanking(rows, 'overallAvg', (value) => `総合${value.toFixed(1)}`),
      topBySupport: buildRanking(rows, 'supportAvg', (value) => `サポート${value.toFixed(1)}`),
      topByTuition: buildRanking(rows, 'tuitionAvg', (value) => `学費満足度${value.toFixed(1)}`),
      rowsByInstitutionType,
      attendanceFrequencyLinks: getPrefectureAttendanceFrequencyLinks(prefecture),
      locationInsights,
      copyStats,
      itemListSchools: schools.map((school) => ({
        id: school.id,
        name: school.name,
        slug: school.slug,
      })),
      cityLandings: getCityLandingsForPrefecture(prefecture).map((config) => ({
        municipality: config.municipality,
        path: getCityLandingPath(config),
      })),
    };
  }
);
