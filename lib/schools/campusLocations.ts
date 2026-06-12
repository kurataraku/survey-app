import type { SchoolCampusLocation } from '@/lib/types/schools';

const MAX_NEAREST_STATIONS_PER_CAMPUS = 2;

function parseNearestStations(record: Record<string, unknown>): string[] {
  if (Array.isArray(record.nearest_stations)) {
    const stations = record.nearest_stations
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean);
    if (stations.length > 0) return stations.slice(0, MAX_NEAREST_STATIONS_PER_CAMPUS);
  }

  const legacy =
    typeof record.nearest_station === 'string' ? record.nearest_station.trim() : '';
  return legacy ? [legacy] : [];
}

function buildCampusLocation(
  prefecture: string,
  city: string,
  nearest_stations: string[]
): SchoolCampusLocation {
  const stations = nearest_stations
    .map((station) => station.trim())
    .filter(Boolean)
    .slice(0, MAX_NEAREST_STATIONS_PER_CAMPUS);
  return stations.length > 0 ? { prefecture, city, nearest_stations: stations } : { prefecture, city };
}

export function getCampusNearestStations(location: SchoolCampusLocation): string[] {
  if (location.nearest_stations?.length) {
    return location.nearest_stations
      .map((station) => station.trim())
      .filter(Boolean)
      .slice(0, MAX_NEAREST_STATIONS_PER_CAMPUS);
  }
  return location.nearest_station ? [location.nearest_station.trim()].filter(Boolean) : [];
}

export function formatCampusNearestStations(stations: string[]): string | null {
  if (stations.length === 0) return null;
  return stations.join('／');
}

/** 管理画面フォーム用: 最寄り駅入力欄2つ分の値を返す */
export function getCampusNearestStationSlots(location: SchoolCampusLocation): [string, string] {
  const stations = getCampusNearestStations(location);
  return [stations[0] ?? '', stations[1] ?? ''];
}

export function normalizeCampusLocations(value: unknown): SchoolCampusLocation[] | null {
  if (!Array.isArray(value)) return null;
  const locations = value
    .map((location) => {
      if (!location || typeof location !== 'object') return null;
      const record = location as Record<string, unknown>;
      const prefecture = typeof record.prefecture === 'string' ? record.prefecture.trim() : '';
      const city = typeof record.city === 'string' ? record.city.trim() : '';
      if (!prefecture || !city) return null;
      return buildCampusLocation(prefecture, city, parseNearestStations(record));
    })
    .filter((location): location is SchoolCampusLocation => Boolean(location));
  return locations.length > 0 ? locations : null;
}

export function sanitizeCampusLocationsInput(campus_locations: unknown): SchoolCampusLocation[] {
  if (!Array.isArray(campus_locations)) return [];
  return campus_locations
    .map((location) => {
      if (!location || typeof location !== 'object') return null;
      const record = location as Record<string, unknown>;
      const prefecture = String(record.prefecture || '').trim();
      const city = String(record.city || '').trim();
      if (!prefecture || !city) return null;
      return buildCampusLocation(prefecture, city, parseNearestStations(record));
    })
    .filter((location): location is SchoolCampusLocation => Boolean(location));
}

export function filterCampusLocationsByPrefecture(
  locations: SchoolCampusLocation[] | null | undefined,
  matchedPrefecture?: string
): SchoolCampusLocation[] {
  if (!locations?.length) return [];
  return matchedPrefecture
    ? locations.filter((location) => location.prefecture === matchedPrefecture)
    : locations;
}

const CARD_MAX_STATIONS = 6;

/** 一覧カード用の最寄り駅サマリー（例: 「JR山手線 新宿駅／丸の内線 新宿三丁目駅」） */
export function buildNearestStationSummary(
  locations: SchoolCampusLocation[] | null | undefined,
  matchedPrefecture?: string
): string | null {
  const visible = filterCampusLocationsByPrefecture(locations, matchedPrefecture);
  const stations = [
    ...new Set(visible.flatMap((location) => getCampusNearestStations(location))),
  ];
  if (stations.length === 0) return null;

  const shown = stations.slice(0, CARD_MAX_STATIONS).join('／');
  return stations.length > CARD_MAX_STATIONS ? `${shown} ほか` : shown;
}
