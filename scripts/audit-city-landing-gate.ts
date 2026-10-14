import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  CITY_LANDING_CANDIDATES,
  CITY_LANDING_GATE,
  type CityLandingCandidate,
} from '../lib/regions/city-landing-candidates';
import { normalizeAreaName } from '../lib/regions/area-normalize';
import {
  getCampusNearestStations,
  getStandingCampusLocationsInPrefecture,
} from '../lib/schools/campusLocations';
import { fetchSchoolsDatasetUncached } from '../lib/schools/getSchoolsDataset';
import { findRegionalReviewStat } from '../lib/schools/regionalReviews';
import type { SearchSchool } from '../lib/schools/searchSchools';

dotenv.config({ path: '.env.local' });

type AuditResult = {
  prefecture: string;
  municipality: string;
  slug: string;
  expectedStatus: CityLandingCandidate['status'];
  expectedAreaMode: CityLandingCandidate['areaMode'];
  expectedWave: CityLandingCandidate['publishWave'] | null;
  designatedCity: boolean;
  population2020: number;
  campusLocationCount: number;
  schoolCount: number;
  prefectureSchoolCount: number;
  stationCoverage: number;
  wardCoverage: number | null;
  missingWardLocationCount: number;
  prefectureOverlap: number;
  prefectureReviewCount: number;
  prefectureReviewSchoolCount: number;
  cityReviewCount: number;
  cityReviewSchoolCount: number;
  passedGate: boolean;
  actualStatus: CityLandingCandidate['status'];
  reasons: string[];
};

type WardMissingLocation = {
  schoolId: string;
  schoolName: string;
  prefecture: string;
  municipality: string;
  registeredCity: string;
  address: string | null;
  nearestStations: string[];
  officialUrl: string | null;
};

function isRelatedToPrefecture(school: SearchSchool, prefecture: string): boolean {
  if (school.prefecture === prefecture) return true;
  if (school.prefectures?.includes(prefecture)) return true;
  return getStandingCampusLocationsInPrefecture(school.campus_locations, prefecture).length > 0;
}

function localLocationsInCity(school: SearchSchool, candidate: CityLandingCandidate) {
  return getStandingCampusLocationsInPrefecture(school.campus_locations, candidate.prefecture)
    .map((location) => ({ location, area: normalizeAreaName(location.city) }))
    .filter(({ area }) => area?.municipality === candidate.municipality);
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function auditCandidate(candidate: CityLandingCandidate, schools: SearchSchool[]): AuditResult {
  const prefectureSchools = schools.filter((school) => isRelatedToPrefecture(school, candidate.prefecture));
  const citySchools = schools.filter((school) => localLocationsInCity(school, candidate).length > 0);
  const cityLocations = citySchools.flatMap((school) => localLocationsInCity(school, candidate));
  const stationLocationCount = cityLocations.filter(({ location }) => getCampusNearestStations(location).length > 0).length;
  const wardLocationCount = cityLocations.filter(({ area }) => Boolean(area?.ward)).length;
  const regionalStats = citySchools
    .map((school) => findRegionalReviewStat(school.regional_reviews, candidate.prefecture))
    .filter((stat): stat is NonNullable<typeof stat> => stat !== null);
  const prefectureReviewCount = regionalStats.reduce((sum, stat) => sum + stat.reviewCount, 0);
  const prefectureReviewSchoolCount = regionalStats.filter((stat) => stat.reviewCount > 0).length;
  const cityReviewStats = regionalStats
    .map((stat) => stat.municipalities[candidate.municipality])
    .filter((stat): stat is NonNullable<typeof stat> => Boolean(stat));
  const cityReviewCount = cityReviewStats.reduce((sum, stat) => sum + stat.reviewCount, 0);
  const cityReviewSchoolCount = cityReviewStats.filter((stat) => stat.reviewCount > 0).length;
  const prefectureOverlap = ratio(citySchools.length, prefectureSchools.length);
  const stationCoverage = ratio(stationLocationCount, cityLocations.length);
  const wardCoverage = candidate.designatedCity ? ratio(wardLocationCount, cityLocations.length) : null;
  const reasons: string[] = [];

  if (cityLocations.length < CITY_LANDING_GATE.minCampusLocations) reasons.push('campus_locations_below_gate');
  if (stationCoverage < CITY_LANDING_GATE.minStationCoverage) reasons.push('station_coverage_below_gate');
  if (prefectureReviewCount < CITY_LANDING_GATE.minPrefectureReviewCount) reasons.push('prefecture_reviews_below_gate');
  if (prefectureOverlap >= CITY_LANDING_GATE.maxPrefectureOverlap) reasons.push('prefecture_overlap_too_high');

  const passedGate = reasons.length === 0;
  const actualStatus: CityLandingCandidate['status'] =
    cityLocations.length < CITY_LANDING_GATE.minCampusLocations
      ? 'defer_few_campuses'
      : prefectureOverlap >= CITY_LANDING_GATE.maxPrefectureOverlap
        ? 'prefecture_page'
        : passedGate
          ? 'publish'
          : 'defer_few_campuses';

  return {
    prefecture: candidate.prefecture,
    municipality: candidate.municipality,
    slug: candidate.slug,
    expectedStatus: candidate.status,
    expectedAreaMode: candidate.areaMode,
    expectedWave: candidate.publishWave ?? null,
    designatedCity: candidate.designatedCity,
    population2020: candidate.population2020,
    campusLocationCount: cityLocations.length,
    schoolCount: citySchools.length,
    prefectureSchoolCount: prefectureSchools.length,
    stationCoverage,
    wardCoverage,
    missingWardLocationCount: candidate.designatedCity ? cityLocations.length - wardLocationCount : 0,
    prefectureOverlap,
    prefectureReviewCount,
    prefectureReviewSchoolCount,
    cityReviewCount,
    cityReviewSchoolCount,
    passedGate,
    actualStatus,
    reasons,
  };
}

function collectMissingWardLocations(
  candidate: CityLandingCandidate,
  schools: SearchSchool[],
  officialUrlBySchoolId: Map<string, string | null>
): WardMissingLocation[] {
  if (!candidate.designatedCity || candidate.status !== 'publish') return [];
  return schools.flatMap((school) =>
    localLocationsInCity(school, candidate)
      .filter(({ area }) => !area?.ward)
      .map(({ location }) => ({
        schoolId: school.id,
        schoolName: school.name,
        prefecture: candidate.prefecture,
        municipality: candidate.municipality,
        registeredCity: location.city,
        address: location.address ?? null,
        nearestStations: getCampusNearestStations(location),
        officialUrl: officialUrlBySchoolId.get(school.id) ?? null,
      }))
  );
}

async function fetchOfficialUrls(schoolIds: string[]): Promise<Map<string, string | null>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const map = new Map<string, string | null>();
  if (!url || !key || schoolIds.length === 0) return map;

  const supabase = createClient(url, key);
  const { data, error } = await supabase.from('schools').select('id, official_url').in('id', schoolIds);
  if (error) {
    console.error('[audit-city-landing-gate] official_url の取得エラー:', error.message);
    return map;
  }
  for (const row of data ?? []) {
    map.set(row.id, typeof row.official_url === 'string' && row.official_url.trim() ? row.official_url.trim() : null);
  }
  return map;
}

function toMarkdown(results: AuditResult[]): string {
  const rows = results
    .map((r) =>
      [
        r.prefecture,
        r.municipality,
        r.expectedStatus,
        r.actualStatus,
        r.campusLocationCount,
        r.schoolCount,
        `${Math.round(r.stationCoverage * 100)}%`,
        r.wardCoverage == null ? '-' : `${Math.round(r.wardCoverage * 100)}%`,
        `${Math.round(r.prefectureOverlap * 100)}%`,
        `${r.prefectureReviewCount}件/${r.prefectureReviewSchoolCount}校`,
        r.reasons.join(', ') || 'passed',
      ].join(' | ')
    )
    .join('\n');
  return [
    '# 都市LP公開条件監査',
    '',
    `- 候補: ${results.length}市`,
    `- 公開候補: ${results.filter((r) => r.expectedStatus === 'publish').length}市`,
    `- 県ページ対応: ${results.filter((r) => r.expectedStatus === 'prefecture_page').length}市`,
    `- 見送り: ${results.filter((r) => r.expectedStatus === 'defer_few_campuses').length}市`,
    '',
    '都道府県 | 市 | 予定 | 実測判定 | 拠点 | 学校 | 駅率 | 区率 | 県重複 | 県口コミ | 理由',
    '--- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | ---',
    rows,
    '',
  ].join('\n');
}

async function main() {
  const schools = await fetchSchoolsDatasetUncached();
  const results = CITY_LANDING_CANDIDATES.map((candidate) => auditCandidate(candidate, schools));
  const missingSchoolIds = [
    ...new Set(
      CITY_LANDING_CANDIDATES.flatMap((candidate) =>
        collectMissingWardLocations(candidate, schools, new Map()).map((location) => location.schoolId)
      )
    ),
  ];
  const officialUrlBySchoolId = await fetchOfficialUrls(missingSchoolIds);
  const missingWardLocations = CITY_LANDING_CANDIDATES.flatMap((candidate) =>
    collectMissingWardLocations(candidate, schools, officialUrlBySchoolId)
  );
  const now = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const seoDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.seo');
  await fs.mkdir(seoDir, { recursive: true });
  await fs.writeFile(
    path.join(seoDir, `city-landing-gate-${now}.json`),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), gate: CITY_LANDING_GATE, results, missingWardLocations }, null, 2)}\n`
  );
  await fs.writeFile(path.join(seoDir, `city-landing-gate-${now}.md`), toMarkdown(results));
  console.log(`audited ${results.length} candidates`);
  console.log(`missing ward locations: ${missingWardLocations.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
