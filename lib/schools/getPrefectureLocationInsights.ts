import { unstable_cache } from 'next/cache';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import {
  getCampusNearestStations,
  normalizeCampusLocations,
} from '@/lib/schools/campusLocations';
import type { SchoolCampusLocation } from '@/lib/types/schools';

export type PrefectureCityLocationInsight = {
  city: string;
  schoolCount: number;
  nearestStations: string[];
};

export type PrefectureStationInsight = {
  name: string;
  schoolCount: number;
};

export type PrefectureLocationInsights = {
  totalSchools: number;
  schoolsWithCampusLocation: number;
  schoolsWithNearestStation: number;
  topCities: PrefectureCityLocationInsight[];
  topStations: PrefectureStationInsight[];
};

type SchoolLocationRow = {
  id: string;
  prefecture: string | null;
  prefectures: string[] | null;
  campus_locations: SchoolCampusLocation[] | null;
};

function hasPrefecture(row: SchoolLocationRow, prefecture: string): boolean {
  if (row.prefecture === prefecture) return true;
  if (row.prefectures?.includes(prefecture)) return true;
  return normalizeCampusLocations(row.campus_locations)?.some((location) => location.prefecture === prefecture) ?? false;
}

function createEmptyInsights(): PrefectureLocationInsights {
  return {
    totalSchools: 0,
    schoolsWithCampusLocation: 0,
    schoolsWithNearestStation: 0,
    topCities: [],
    topStations: [],
  };
}

async function fetchPrefectureLocationInsights(
  prefecture: string
): Promise<PrefectureLocationInsights> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('schools')
    .select('id, prefecture, prefectures, campus_locations')
    .eq('status', 'active')
    .eq('is_public', true);

  if (error) {
    if ('code' in error && error.code === '42703') return createEmptyInsights();
    throw error;
  }

  const rows = ((data ?? []) as SchoolLocationRow[]).filter((row) => hasPrefecture(row, prefecture));
  const cityMap = new Map<string, { schoolIds: Set<string>; stations: Map<string, Set<string>> }>();
  const stationMap = new Map<string, Set<string>>();
  let schoolsWithCampusLocation = 0;
  let schoolsWithNearestStation = 0;

  for (const row of rows) {
    const locations = normalizeCampusLocations(row.campus_locations)?.filter(
      (location) => location.prefecture === prefecture
    ) ?? [];
    if (locations.length === 0) continue;

    schoolsWithCampusLocation += 1;
    let hasStation = false;

    for (const location of locations) {
      const cityEntry = cityMap.get(location.city) ?? {
        schoolIds: new Set<string>(),
        stations: new Map<string, Set<string>>(),
      };
      cityEntry.schoolIds.add(row.id);

      for (const station of getCampusNearestStations(location)) {
        hasStation = true;
        const cityStationSchoolIds = cityEntry.stations.get(station) ?? new Set<string>();
        cityStationSchoolIds.add(row.id);
        cityEntry.stations.set(station, cityStationSchoolIds);

        const stationSchoolIds = stationMap.get(station) ?? new Set<string>();
        stationSchoolIds.add(row.id);
        stationMap.set(station, stationSchoolIds);
      }

      cityMap.set(location.city, cityEntry);
    }

    if (hasStation) schoolsWithNearestStation += 1;
  }

  const topCities = [...cityMap.entries()]
    .map(([city, entry]) => ({
      city,
      schoolCount: entry.schoolIds.size,
      nearestStations: [...entry.stations.entries()]
        .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0], 'ja'))
        .map(([station]) => station)
        .slice(0, 3),
    }))
    .sort((a, b) => b.schoolCount - a.schoolCount || a.city.localeCompare(b.city, 'ja'))
    .slice(0, 8);

  const topStations = [...stationMap.entries()]
    .map(([name, schoolIds]) => ({ name, schoolCount: schoolIds.size }))
    .sort((a, b) => b.schoolCount - a.schoolCount || a.name.localeCompare(b.name, 'ja'))
    .slice(0, 8);

  return {
    totalSchools: rows.length,
    schoolsWithCampusLocation,
    schoolsWithNearestStation,
    topCities,
    topStations,
  };
}

export const getPrefectureLocationInsights = unstable_cache(
  fetchPrefectureLocationInsights,
  ['prefecture-location-insights-v1'],
  { revalidate: 3600 }
);
