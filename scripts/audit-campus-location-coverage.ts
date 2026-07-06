/**
 * schools.campus_locations の都道府県別充足率を確認するCLI。
 *
 * 使い方:
 *   npm run audit:campus-locations
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  getCampusNearestStations,
  normalizeCampusLocations,
} from '@/lib/schools/campusLocations';
import type { SchoolCampusLocation } from '@/lib/types/schools';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

type SchoolRow = {
  id: string;
  name: string;
  prefecture: string | null;
  prefectures: string[] | null;
  campus_locations: SchoolCampusLocation[] | null;
};

type PrefectureCoverage = {
  prefecture: string;
  schools: number;
  withCampusLocation: number;
  withNearestStation: number;
  topCities: Map<string, Set<string>>;
  topStations: Map<string, Set<string>>;
};

function getCoverage(map: Map<string, PrefectureCoverage>, prefecture: string) {
  const current = map.get(prefecture);
  if (current) return current;
  const next: PrefectureCoverage = {
    prefecture,
    schools: 0,
    withCampusLocation: 0,
    withNearestStation: 0,
    topCities: new Map(),
    topStations: new Map(),
  };
  map.set(prefecture, next);
  return next;
}

function addToSetMap(map: Map<string, Set<string>>, key: string, schoolId: string) {
  const set = map.get(key) ?? new Set<string>();
  set.add(schoolId);
  map.set(key, set);
}

function percent(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : '0%';
}

function csvEscape(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function formatTopEntries(map: Map<string, Set<string>>) {
  return [...map.entries()]
    .map(([label, schoolIds]) => ({ label, count: schoolIds.size }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ja'))
    .slice(0, 5)
    .map((entry) => `${entry.label}(${entry.count})`)
    .join(' / ');
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, prefecture, prefectures, campus_locations')
    .eq('status', 'active')
    .eq('is_public', true)
    .order('prefecture');

  if (error) throw error;

  const coverageByPrefecture = new Map<string, PrefectureCoverage>();

  for (const school of (data ?? []) as SchoolRow[]) {
    const prefectures = new Set<string>([
      ...(school.prefecture && school.prefecture !== '不明' ? [school.prefecture] : []),
      ...(school.prefectures ?? []).filter((prefecture) => prefecture && prefecture !== '不明'),
    ]);
    const locations = normalizeCampusLocations(school.campus_locations) ?? [];
    for (const location of locations) {
      if (location.prefecture && location.prefecture !== '不明') {
        prefectures.add(location.prefecture);
      }
    }

    for (const prefecture of prefectures) {
      const coverage = getCoverage(coverageByPrefecture, prefecture);
      coverage.schools += 1;

      const matchedLocations = locations.filter((location) => location.prefecture === prefecture);
      if (matchedLocations.length === 0) continue;

      coverage.withCampusLocation += 1;
      let hasNearestStation = false;

      for (const location of matchedLocations) {
        addToSetMap(coverage.topCities, location.city, school.id);
        for (const station of getCampusNearestStations(location)) {
          hasNearestStation = true;
          addToSetMap(coverage.topStations, station, school.id);
        }
      }

      if (hasNearestStation) coverage.withNearestStation += 1;
    }
  }

  const rows = [...coverageByPrefecture.values()].sort(
    (a, b) => b.schools - a.schools || a.prefecture.localeCompare(b.prefecture, 'ja')
  );

  console.log(
    [
      'prefecture',
      'schools',
      'with_campus_location',
      'campus_location_rate',
      'with_nearest_station',
      'nearest_station_rate',
      'top_cities',
      'top_stations',
    ].join(',')
  );

  for (const row of rows) {
    console.log(
      [
        csvEscape(row.prefecture),
        csvEscape(row.schools),
        csvEscape(row.withCampusLocation),
        csvEscape(percent(row.withCampusLocation, row.schools)),
        csvEscape(row.withNearestStation),
        csvEscape(percent(row.withNearestStation, row.schools)),
        csvEscape(formatTopEntries(row.topCities)),
        csvEscape(formatTopEntries(row.topStations)),
      ].join(',')
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
