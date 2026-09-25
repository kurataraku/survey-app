import { getCampusNearestStations } from '@/lib/schools/campusLocations';
import {
  normalizeAreaName,
  normalizeStationLabel,
  stripRailOperatorPrefix,
} from '@/lib/regions/area-normalize';
import type { SearchSchool } from '@/lib/schools/searchSchools';

export type PrefectureCityLocationInsight = {
  /** 市区町村名。政令指定都市は親市へまとめた単位 */
  city: string;
  schoolCount: number;
  campusCount: number;
  nearestStations: string[];
  /** 政令指定都市の行政区ごとの内訳。該当しなければ空配列 */
  wards: Array<{ name: string; schoolCount: number }>;
};

export type PrefectureStationInsight = {
  /** 駅名。路線が違っても同じ駅は1件にまとめる */
  name: string;
  schoolCount: number;
  lines: string[];
  cities: string[];
};

export type PrefectureLocationInsights = {
  totalSchools: number;
  schoolsWithCampusLocation: number;
  schoolsWithNearestStation: number;
  /** 県内で確認できた市区町村の総数（表示上限とは別） */
  cityCount: number;
  /** 県内で確認できた駅の総数（表示上限とは別） */
  stationCount: number;
  topCities: PrefectureCityLocationInsight[];
  topStations: PrefectureStationInsight[];
};

const TOP_CITY_LIMIT = 12;
const TOP_STATION_LIMIT = 12;

type CityEntry = {
  schoolIds: Set<string>;
  campusCount: number;
  stations: Map<string, Set<string>>;
  wards: Map<string, Set<string>>;
};

type StationEntry = {
  schoolIds: Set<string>;
  lines: Set<string>;
  cities: Set<string>;
};

/**
 * 「JR名古屋駅」と「名古屋駅」のように事業者名の有無で分かれた同一駅をまとめる。
 *
 * 「京成高砂駅」「近鉄名古屋駅」のように事業者名が正式な駅名の一部である駅を壊さないよう、
 * 同じ都道府県内に接頭辞なしの駅が実在する場合だけ統合する。
 */
function mergeOperatorPrefixedStations(
  stationMap: Map<string, StationEntry>,
  cityMap: Map<string, CityEntry>
): void {
  const merges = new Map<string, string>();
  for (const key of stationMap.keys()) {
    const bare = stripRailOperatorPrefix(key);
    if (bare && bare !== key && stationMap.has(bare)) {
      merges.set(key, bare);
    }
  }
  if (merges.size === 0) return;

  for (const [from, to] of merges) {
    const source = stationMap.get(from);
    const target = stationMap.get(to);
    if (!source || !target) continue;
    source.schoolIds.forEach((id) => target.schoolIds.add(id));
    source.cities.forEach((city) => target.cities.add(city));
    // 統合元のキーに含まれていた事業者名は路線名として残す
    const operatorPrefix = from.slice(0, from.length - to.length);
    if (operatorPrefix) target.lines.add(operatorPrefix);
    source.lines.forEach((line) => target.lines.add(line));
    stationMap.delete(from);
  }

  for (const cityEntry of cityMap.values()) {
    for (const [from, to] of merges) {
      const source = cityEntry.stations.get(from);
      if (!source) continue;
      const target = cityEntry.stations.get(to) ?? new Set<string>();
      source.forEach((id) => target.add(id));
      cityEntry.stations.set(to, target);
      cityEntry.stations.delete(from);
    }
  }
}

/**
 * 都道府県内のキャンパス所在地・最寄り駅を集計する。
 *
 * DBへは問い合わせず、getSchoolsDataset から絞り込んだ学校集合をそのまま使うことで、
 * LPの掲載校数・市区町村数・ランキング母集団が同じデータから算出されるようにする。
 *
 * 市区町村名と駅名は登録値の表記揺れが大きいため area-normalize で正規化してから数える。
 * 正規化前は「さいたま市大宮区」と「さいたま市大宮区高鼻町1-20-1」が別エリアとして
 * 分散し、エリアごとの掲載校数が実態より小さく出ていた。
 */
export function computePrefectureLocationInsights(
  schools: SearchSchool[],
  prefecture: string
): PrefectureLocationInsights {
  const cityMap = new Map<string, CityEntry>();
  const stationMap = new Map<string, StationEntry>();
  let schoolsWithCampusLocation = 0;
  let schoolsWithNearestStation = 0;

  for (const school of schools) {
    const locations =
      school.campus_locations?.filter((location) => location.prefecture === prefecture) ?? [];
    if (locations.length === 0) continue;

    schoolsWithCampusLocation += 1;
    let hasStation = false;

    for (const location of locations) {
      const area = normalizeAreaName(location.city);
      if (!area) continue;

      const cityEntry = cityMap.get(area.municipality) ?? {
        schoolIds: new Set<string>(),
        campusCount: 0,
        stations: new Map<string, Set<string>>(),
        wards: new Map<string, Set<string>>(),
      };
      cityEntry.schoolIds.add(school.id);
      cityEntry.campusCount += 1;
      if (area.ward) {
        const wardSchoolIds = cityEntry.wards.get(area.ward) ?? new Set<string>();
        wardSchoolIds.add(school.id);
        cityEntry.wards.set(area.ward, wardSchoolIds);
      }

      for (const rawStation of getCampusNearestStations(location)) {
        const station = normalizeStationLabel(rawStation);
        if (!station) continue;
        hasStation = true;

        const cityStationSchoolIds = cityEntry.stations.get(station.station) ?? new Set<string>();
        cityStationSchoolIds.add(school.id);
        cityEntry.stations.set(station.station, cityStationSchoolIds);

        const stationEntry = stationMap.get(station.station) ?? {
          schoolIds: new Set<string>(),
          lines: new Set<string>(),
          cities: new Set<string>(),
        };
        stationEntry.schoolIds.add(school.id);
        station.lines.forEach((line) => stationEntry.lines.add(line));
        stationEntry.cities.add(area.municipality);
        stationMap.set(station.station, stationEntry);
      }

      cityMap.set(area.municipality, cityEntry);
    }

    if (hasStation) schoolsWithNearestStation += 1;
  }

  mergeOperatorPrefixedStations(stationMap, cityMap);

  const topCities = [...cityMap.entries()]
    .map(([city, entry]) => ({
      city,
      schoolCount: entry.schoolIds.size,
      campusCount: entry.campusCount,
      nearestStations: [...entry.stations.entries()]
        .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0], 'ja'))
        .map(([station]) => station)
        .slice(0, 3),
      wards: [...entry.wards.entries()]
        .map(([name, schoolIds]) => ({ name, schoolCount: schoolIds.size }))
        .sort((a, b) => b.schoolCount - a.schoolCount || a.name.localeCompare(b.name, 'ja'))
        .slice(0, 6),
    }))
    .sort((a, b) => b.schoolCount - a.schoolCount || a.city.localeCompare(b.city, 'ja'));

  const topStations = [...stationMap.entries()]
    .map(([name, entry]) => ({
      name,
      schoolCount: entry.schoolIds.size,
      lines: [...entry.lines].sort((a, b) => a.localeCompare(b, 'ja')).slice(0, 3),
      cities: [...entry.cities].sort((a, b) => a.localeCompare(b, 'ja')).slice(0, 2),
    }))
    .sort((a, b) => b.schoolCount - a.schoolCount || a.name.localeCompare(b.name, 'ja'));

  return {
    totalSchools: schools.length,
    schoolsWithCampusLocation,
    schoolsWithNearestStation,
    cityCount: cityMap.size,
    stationCount: stationMap.size,
    topCities: topCities.slice(0, TOP_CITY_LIMIT),
    topStations: topStations.slice(0, TOP_STATION_LIMIT),
  };
}
