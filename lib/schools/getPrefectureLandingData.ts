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
import { getCampusNearestStations } from '@/lib/schools/campusLocations';
import { normalizeAreaName, normalizeStationLabel } from '@/lib/regions/area-normalize';
import {
  findRegionalReviewStat,
  summarizeRegionalReviews,
  type RegionalReviewStat,
  type RegionalReviewSummary,
} from '@/lib/schools/regionalReviews';
import type { PrefectureLandingCopyStats } from '@/lib/prefectures/prefecture-landing-copy';
import type { SchoolInstitutionType } from '@/lib/types/schools';

/** 学費情報の確認状態。金額を確認できていない学校を「安い」と誤解させないために区別する */
export type TuitionConfirmationState = 'amounts' | 'varies' | 'contact_required' | 'unconfirmed';

/** 比較表1行分。表示に必要な値だけを持たせ、口コミ本文や学校紹介は学校詳細へ集約する */
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
  tuitionState: TuitionConfirmationState;
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
};

export type PrefectureRankingEntry = {
  row: PrefectureSchoolRow;
  /** ランキングの根拠として表示する値 */
  metricLabel: string;
};

/** 学費の確認状態の内訳。網羅できているように見せないため確認率を明示する */
export type PrefectureTuitionCoverage = {
  amounts: number;
  varies: number;
  contactRequired: number;
  unconfirmed: number;
  /** 何らかの公式確認が取れている学校数（amounts + varies + contactRequired） */
  confirmed: number;
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
  tuitionCoverage: PrefectureTuitionCoverage;
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
};

function hasLocalCampus(school: SearchSchool, prefecture: string): boolean {
  return school.campus_locations?.some((location) => location.prefecture === prefecture) ?? false;
}

function isRelatedToPrefecture(school: SearchSchool, prefecture: string): boolean {
  if (school.prefecture === prefecture) return true;
  if (school.prefectures?.includes(prefecture)) return true;
  return hasLocalCampus(school, prefecture);
}

function resolveTuitionState(school: SearchSchool): TuitionConfirmationState {
  const mode = school.tuition_estimate?.display_mode;
  if (mode === 'amounts' || mode === 'varies' || mode === 'contact_required') return mode;
  return 'unconfirmed';
}

function toRow(school: SearchSchool, prefecture: string): PrefectureSchoolRow {
  const localLocations =
    school.campus_locations?.filter((location) => location.prefecture === prefecture) ?? [];
  const localCities = [
    ...new Set(
      localLocations
        .map((location) => normalizeAreaName(location.city)?.city)
        .filter((city): city is string => Boolean(city))
    ),
  ];
  const localStations = [
    ...new Set(
      localLocations
        .flatMap((location) => getCampusNearestStations(location))
        .map((station) => normalizeStationLabel(station)?.station)
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
    tuitionState: resolveTuitionState(school),
  };
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

    const rows = schools.map((school) => toRow(school, prefecture));

    const localCampusLocationCount = schools.reduce(
      (sum, school) =>
        sum +
        (school.campus_locations?.filter((location) => location.prefecture === prefecture).length ??
          0),
      0
    );

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

    const locationInsights = computePrefectureLocationInsights(schools, prefecture);
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
      .map((row) => ({ row, metricLabel: `${prefecture}の回答${row.localReviewCount}件` }));

    const tuitionCoverage: PrefectureTuitionCoverage = {
      amounts: rows.filter((row) => row.tuitionState === 'amounts').length,
      varies: rows.filter((row) => row.tuitionState === 'varies').length,
      contactRequired: rows.filter((row) => row.tuitionState === 'contact_required').length,
      unconfirmed: rows.filter((row) => row.tuitionState === 'unconfirmed').length,
      confirmed: rows.filter((row) => row.tuitionState !== 'unconfirmed').length,
    };

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
      tuitionCoverage,
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
    };
  }
);
