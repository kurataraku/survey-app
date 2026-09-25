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
import {
  resolveTuitionState,
  type TuitionConfirmationState,
} from '@/lib/schools/getPrefectureLandingData';
import { buildAdmissionBadges, type AdmissionBadge } from '@/lib/schools/admissionProfiles';
import type { CityLandingConfig } from '@/lib/regions/city-landing';
import type { SchoolInstitutionType } from '@/lib/types/schools';

/** 行政区が登録されていない拠点（「名古屋市」のみの登録）をまとめる表示名 */
export const UNSPECIFIED_WARD_LABEL = '区の登録なし';

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
  cityOverallAvg: number | null;
  /** 県内キャンパスの口コミ件数（市内とは限らない。市の口コミとしては数えない） */
  prefectureReviewCount: number;
  reviewCount: number;
  overallAvg: number | null;
  tuitionState: TuitionConfirmationState;
  admissionBadges: AdmissionBadge[];
};

export type CityWardInsight = {
  name: string;
  schoolCount: number;
  campusCount: number;
  schools: Array<{ id: string; name: string; slug: string | null }>;
};

export type CityLandingData = {
  config: CityLandingConfig;
  prefecture: string;
  municipality: string;
  rows: CitySchoolRow[];
  counts: {
    totalSchools: number;
    campusLocationCount: number;
    wardCount: number;
    stationCount: number;
    schoolsWithStation: number;
    publicCount: number;
    privateCount: number;
    supportCount: number;
    admissionVerifiedCount: number;
    tuitionConfirmed: number;
  };
  wards: CityWardInsight[];
  topStations: PrefectureStationInsight[];
  cityReviewCount: number;
  cityReviewSchoolCount: number;
  prefectureReviewCount: number;
  prefectureReviewSchoolCount: number;
  totalReviewCount: number;
  schoolsWithReviewsCount: number;
  itemListSchools: { id: string; name: string; slug: string | null }[];
};

function localLocationsInCity(school: SearchSchool, config: CityLandingConfig) {
  return getStandingCampusLocationsInPrefecture(school.campus_locations, config.prefecture)
    .map((location) => ({ location, area: normalizeAreaName(location.city) }))
    .filter(({ area }) => area?.municipality === config.municipality);
}

function toRow(school: SearchSchool, config: CityLandingConfig): CitySchoolRow {
  const locations = localLocationsInCity(school, config);
  const wards = [
    ...new Set(locations.map(({ area }) => area?.ward).filter((ward): ward is string => Boolean(ward))),
  ];
  const stations = [
    ...new Set(
      locations
        .flatMap(({ location }) => getCampusNearestStations(location))
        .map((station) => normalizeStationLabel(station)?.station)
        .filter((station): station is string => Boolean(station))
    ),
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
    stations: stations.slice(0, 2),
    cityReviewCount: city?.reviewCount ?? 0,
    cityOverallAvg: city?.overallAvg ?? null,
    prefectureReviewCount: regional?.reviewCount ?? 0,
    reviewCount: school.review_count,
    overallAvg: school.overall_avg,
    tuitionState: resolveTuitionState(school),
    admissionBadges: buildAdmissionBadges(school.admission_profile, config.prefecture),
  };
}

function buildWards(schools: SearchSchool[], config: CityLandingConfig): CityWardInsight[] {
  const wardMap = new Map<string, { schoolIds: Set<string>; campusCount: number; schools: Map<string, SearchSchool> }>();
  for (const school of schools) {
    for (const { area } of localLocationsInCity(school, config)) {
      const name = area?.ward ?? UNSPECIFIED_WARD_LABEL;
      const entry = wardMap.get(name) ?? { schoolIds: new Set(), campusCount: 0, schools: new Map() };
      entry.schoolIds.add(school.id);
      entry.campusCount += 1;
      entry.schools.set(school.id, school);
      wardMap.set(name, entry);
    }
  }
  return [...wardMap.entries()]
    .map(([name, entry]) => ({
      name,
      schoolCount: entry.schoolIds.size,
      campusCount: entry.campusCount,
      schools: [...entry.schools.values()]
        .sort((a, b) => b.review_count - a.review_count || a.name.localeCompare(b.name, 'ja'))
        .map((school) => ({ id: school.id, name: school.name, slug: school.slug })),
    }))
    .sort((a, b) => {
      if (a.name === UNSPECIFIED_WARD_LABEL) return 1;
      if (b.name === UNSPECIFIED_WARD_LABEL) return -1;
      return b.schoolCount - a.schoolCount || a.name.localeCompare(b.name, 'ja');
    });
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
    wardLimit: 30,
  });
  const wards = buildWards(schools, config);

  return {
    config,
    prefecture: config.prefecture,
    municipality: config.municipality,
    rows,
    counts: {
      totalSchools: rows.length,
      campusLocationCount: rows.reduce((sum, row) => sum + row.campusCount, 0),
      wardCount: wards.filter((ward) => ward.name !== UNSPECIFIED_WARD_LABEL).length,
      stationCount: insights.stationCount,
      schoolsWithStation: insights.schoolsWithNearestStation,
      publicCount: rows.filter((row) => row.institutionType === 'public').length,
      privateCount: rows.filter((row) => row.institutionType === 'private').length,
      supportCount: rows.filter((row) => row.institutionType === 'support').length,
      admissionVerifiedCount: rows.filter((row) => row.admissionBadges.length > 0).length,
      tuitionConfirmed: rows.filter((row) => row.tuitionState !== 'unconfirmed').length,
    },
    wards,
    topStations: insights.topStations,
    cityReviewCount: rows.reduce((sum, row) => sum + row.cityReviewCount, 0),
    cityReviewSchoolCount: rows.filter((row) => row.cityReviewCount > 0).length,
    prefectureReviewCount: rows.reduce((sum, row) => sum + row.prefectureReviewCount, 0),
    prefectureReviewSchoolCount: rows.filter((row) => row.prefectureReviewCount > 0).length,
    totalReviewCount: rows.reduce((sum, row) => sum + row.reviewCount, 0),
    schoolsWithReviewsCount: rows.filter((row) => row.reviewCount > 0).length,
    itemListSchools: rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug })),
  };
});
