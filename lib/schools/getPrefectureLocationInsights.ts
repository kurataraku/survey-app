import { getCampusNearestStations } from '@/lib/schools/campusLocations';
import type { SearchSchool } from '@/lib/schools/searchSchools';

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

const TOP_CITY_LIMIT = 8;
const TOP_STATION_LIMIT = 8;

/**
 * 都道府県内のキャンパス所在地・最寄り駅を集計する。
 *
 * DBへは問い合わせず、getSchoolsDataset から絞り込んだ学校集合をそのまま使うことで、
 * LPの掲載校数・市区町村数・ランキング母集団が同じデータから算出されるようにする。
 */
export function computePrefectureLocationInsights(
  schools: SearchSchool[],
  prefecture: string
): PrefectureLocationInsights {
  const cityMap = new Map<string, { schoolIds: Set<string>; stations: Map<string, Set<string>> }>();
  const stationMap = new Map<string, Set<string>>();
  let schoolsWithCampusLocation = 0;
  let schoolsWithNearestStation = 0;

  for (const school of schools) {
    const locations =
      school.campus_locations?.filter((location) => location.prefecture === prefecture) ?? [];
    if (locations.length === 0) continue;

    schoolsWithCampusLocation += 1;
    let hasStation = false;

    for (const location of locations) {
      const cityEntry = cityMap.get(location.city) ?? {
        schoolIds: new Set<string>(),
        stations: new Map<string, Set<string>>(),
      };
      cityEntry.schoolIds.add(school.id);

      for (const station of getCampusNearestStations(location)) {
        hasStation = true;
        const cityStationSchoolIds = cityEntry.stations.get(station) ?? new Set<string>();
        cityStationSchoolIds.add(school.id);
        cityEntry.stations.set(station, cityStationSchoolIds);

        const stationSchoolIds = stationMap.get(station) ?? new Set<string>();
        stationSchoolIds.add(school.id);
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
    .slice(0, TOP_CITY_LIMIT);

  const topStations = [...stationMap.entries()]
    .map(([name, schoolIds]) => ({ name, schoolCount: schoolIds.size }))
    .sort((a, b) => b.schoolCount - a.schoolCount || a.name.localeCompare(b.name, 'ja'))
    .slice(0, TOP_STATION_LIMIT);

  return {
    totalSchools: schools.length,
    schoolsWithCampusLocation,
    schoolsWithNearestStation,
    topCities,
    topStations,
  };
}
