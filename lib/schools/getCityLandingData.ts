import { cache } from 'react';
import { getSchoolsDataset } from '@/lib/schools/getSchoolsDataset';
import type { SearchSchool } from '@/lib/schools/searchSchools';
import {
  getCampusNearestStations,
  getStandingCampusLocationsInPrefecture,
} from '@/lib/schools/campusLocations';
import { normalizeAreaName, normalizeStationLabel } from '@/lib/regions/area-normalize';
import {
  computePrefectureLocationInsights,
  type PrefectureStationInsight,
} from '@/lib/schools/getPrefectureLocationInsights';
import { findRegionalReviewStat } from '@/lib/schools/regionalReviews';
import { buildAdmissionBadges, type AdmissionBadge } from '@/lib/schools/admissionProfiles';
import {
  buildTuitionCardBasisLabel,
  buildTuitionRangeLines,
} from '@/lib/tuition/format';
import { createSupabaseClientWithLargeHeaders } from '@/lib/supabase/large-headers';
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
  stations: string[];
  /** 回答で市区町村まで申告された、この市のキャンパスの口コミ件数 */
  cityReviewCount: number;
  /** 県内キャンパスの口コミ件数（市内とは限らない。市の口コミとしては数えない） */
  prefectureReviewCount: number;
  reviewCount: number;
  overallAvg: number | null;
  /** 公開済みの初年度納入金の目安。金額が公開されていない学校は null */
  tuition: { value: string; basisLabel: string | null } | null;
  admissionBadges: AdmissionBadge[];
};

export type CityWardInsight = {
  name: string;
  schoolCount: number;
  schools: Array<{ id: string; name: string; slug: string | null; stations: string[] }>;
};

/** 県内キャンパスに通った人の口コミ抜粋（市内とは限らない） */
export type CityReviewExcerpt = {
  id: string;
  schoolName: string;
  schoolSlug: string | null;
  overall: number | null;
  attendance: string | null;
  /** 回答者が市区町村まで申告し、それがこの市だった場合のみ true */
  isCityCampus: boolean;
  good: string | null;
  bad: string | null;
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
  reviewExcerpts: CityReviewExcerpt[];
  cityReviewCount: number;
  prefectureReviewCount: number;
  prefectureReviewSchoolCount: number;
  /** 掲載校の学校全体の総合満足度を口コミ件数で加重平均した値 */
  averageOverallSatisfaction: number | null;
  totalReviewCount: number;
  itemListSchools: { id: string; name: string; slug: string | null }[];
};

const REVIEW_EXCERPTS_PER_SCHOOL = 2;
const REVIEW_EXCERPTS_LIMIT = 12;
const GOOD_EXCERPT_LENGTH = 120;
const BAD_EXCERPT_LENGTH = 90;

function localLocationsInCity(school: SearchSchool, config: CityLandingConfig) {
  return getStandingCampusLocationsInPrefecture(school.campus_locations, config.prefecture)
    .map((location) => ({ location, area: normalizeAreaName(location.city) }))
    .filter(({ area }) => area?.municipality === config.municipality);
}

/** 「近鉄名古屋駅」のように事業者名が駅名の一部になる例があるため、JR・地下鉄だけを外す */
const DISPLAY_STATION_PREFIX = /^(JR|名古屋市営地下鉄|市営地下鉄|地下鉄)(?=.+駅$)/;

function stationNames(locations: ReturnType<typeof localLocationsInCity>): string[] {
  return [
    ...new Set(
      locations
        .flatMap(({ location }) => getCampusNearestStations(location))
        .map((station) => normalizeStationLabel(station)?.station?.replace(DISPLAY_STATION_PREFIX, ''))
        .filter((station): station is string => Boolean(station))
    ),
  ];
}

function buildTuition(school: SearchSchool): CitySchoolRow['tuition'] {
  const estimate = school.tuition_estimate;
  if (!estimate) return null;
  const [line] = buildTuitionRangeLines(estimate);
  if (!line) return null;
  return { value: line.value, basisLabel: buildTuitionCardBasisLabel(estimate) };
}

function toRow(school: SearchSchool, config: CityLandingConfig): CitySchoolRow {
  const locations = localLocationsInCity(school, config);
  const wards = [
    ...new Set(locations.map(({ area }) => area?.ward).filter((ward): ward is string => Boolean(ward))),
  ];
  const regional = findRegionalReviewStat(school.regional_reviews, config.prefecture);
  const city = regional?.municipalities?.[config.municipality] ?? null;

  return {
    id: school.id,
    name: school.name,
    slug: school.slug,
    institutionType: school.institution_type,
    headquartersPrefecture: school.prefecture,
    campusCount: locations.length,
    wards,
    stations: stationNames(locations).slice(0, 2),
    cityReviewCount: city?.reviewCount ?? 0,
    prefectureReviewCount: regional?.reviewCount ?? 0,
    reviewCount: school.review_count,
    overallAvg: school.overall_avg,
    tuition: buildTuition(school),
    admissionBadges: buildAdmissionBadges(school.admission_profile, config.prefecture),
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

function truncate(text: string | null | undefined, max: number): string | null {
  const trimmed = text?.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

/**
 * 掲載校の口コミのうち、回答者が県内キャンパスに通ったと申告したものを新しい順に抜粋する。
 * 市区町村まで申告されていない口コミを市の口コミとは表示しない（isCityCampus で区別する）。
 */
async function fetchPrefectureReviewExcerpts(
  rows: CitySchoolRow[],
  config: CityLandingConfig
): Promise<CityReviewExcerpt[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const targetRows = rows.filter((row) => row.prefectureReviewCount > 0);
  if (!url || !key || targetRows.length === 0) return [];

  const supabase = createSupabaseClientWithLargeHeaders(url, key);
  const { data, error } = await supabase
    .from('survey_responses')
    .select('id, school_id, overall_satisfaction, good_comment, bad_comment, created_at, answers')
    .in('school_id', targetRows.map((row) => row.id))
    .eq('is_public', true)
    .eq('answers->>campus_prefecture', config.prefecture)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[getCityLandingData] 口コミ抜粋の取得エラー:', error.message);
    return [];
  }

  const rowById = new Map(targetRows.map((row) => [row.id, row]));
  const perSchool = new Map<string, CityReviewExcerpt[]>();
  for (const review of data ?? []) {
    const row = rowById.get(review.school_id);
    if (!row) continue;
    const list = perSchool.get(row.id) ?? [];
    if (list.length >= REVIEW_EXCERPTS_PER_SCHOOL) continue;
    const good = truncate(review.good_comment, GOOD_EXCERPT_LENGTH);
    const bad = truncate(review.bad_comment, BAD_EXCERPT_LENGTH);
    if (!good && !bad) continue;
    const answers = (review.answers ?? {}) as Record<string, unknown>;
    const campusCity = typeof answers.campus_city === 'string' ? normalizeAreaName(answers.campus_city) : null;
    const overall = Number(review.overall_satisfaction);
    list.push({
      id: review.id,
      schoolName: row.name,
      schoolSlug: row.slug,
      overall: overall >= 1 && overall <= 5 ? overall : null,
      attendance: typeof answers.attendance_frequency === 'string' ? answers.attendance_frequency : null,
      isCityCampus: campusCity?.municipality === config.municipality,
      good,
      bad,
    });
    perSchool.set(row.id, list);
  }

  // 口コミの多い学校から1件ずつ順番に並べ、特定校に偏らないようにする
  const ordered = [...targetRows].sort((a, b) => b.prefectureReviewCount - a.prefectureReviewCount);
  const result: CityReviewExcerpt[] = [];
  for (let round = 0; round < REVIEW_EXCERPTS_PER_SCHOOL; round++) {
    for (const row of ordered) {
      const excerpt = perSchool.get(row.id)?.[round];
      if (excerpt) result.push(excerpt);
      if (result.length >= REVIEW_EXCERPTS_LIMIT) return result;
    }
  }
  return result;
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

  const rows = schools
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
  });

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
    topStations: insights.topStations,
    reviewExcerpts: await fetchPrefectureReviewExcerpts(rows, config),
    cityReviewCount: rows.reduce((sum, row) => sum + row.cityReviewCount, 0),
    prefectureReviewCount: rows.reduce((sum, row) => sum + row.prefectureReviewCount, 0),
    prefectureReviewSchoolCount: rows.filter((row) => row.prefectureReviewCount > 0).length,
    averageOverallSatisfaction: weightedOverall(rows),
    totalReviewCount: rows.reduce((sum, row) => sum + row.reviewCount, 0),
    itemListSchools: rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug })),
  };
});
