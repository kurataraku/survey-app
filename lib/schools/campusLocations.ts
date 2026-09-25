import type { CampusLocationType, SchoolCampusLocation } from '@/lib/types/schools';

const MAX_NEAREST_STATIONS_PER_CAMPUS = 2;

export const CAMPUS_LOCATION_TYPE_LABELS: Record<CampusLocationType, string> = {
  headquarters: '本校',
  commute_campus: '通学キャンパス',
  required_schooling_venue: 'スクーリング会場',
  support_campus: 'サポート校・学習センター',
  exam_venue: '試験会場のみ',
  event_only: '説明会・相談会のみ',
};

const CAMPUS_LOCATION_TYPES = Object.keys(CAMPUS_LOCATION_TYPE_LABELS) as CampusLocationType[];

/** 地域LPの拠点数に数えない種類（常設の学習拠点ではないもの） */
const NON_STANDING_LOCATION_TYPES: ReadonlySet<CampusLocationType> = new Set([
  'exam_venue',
  'event_only',
]);

function parseLocationType(value: unknown): CampusLocationType | undefined {
  return typeof value === 'string' && (CAMPUS_LOCATION_TYPES as string[]).includes(value)
    ? (value as CampusLocationType)
    : undefined;
}

/** 常設の学習拠点か（種類未設定の既存データは常設として扱う） */
export function isStandingCampus(location: SchoolCampusLocation): boolean {
  return !location.location_type || !NON_STANDING_LOCATION_TYPES.has(location.location_type);
}

/** 指定都道府県内の常設拠点（地域LPの拠点数・所在地・駅集計の母集団） */
export function getStandingCampusLocationsInPrefecture(
  locations: SchoolCampusLocation[] | null | undefined,
  prefecture: string
): SchoolCampusLocation[] {
  return (locations ?? []).filter(
    (location) => location.prefecture === prefecture && isStandingCampus(location)
  );
}

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
  record: Record<string, unknown>
): SchoolCampusLocation {
  const stations = parseNearestStations(record)
    .map((station) => station.trim())
    .filter(Boolean)
    .slice(0, MAX_NEAREST_STATIONS_PER_CAMPUS);
  const address = typeof record.address === 'string' ? record.address.trim() : '';
  const locationType = parseLocationType(record.location_type);
  const location: SchoolCampusLocation = { prefecture, city };
  if (address) location.address = address;
  if (locationType) location.location_type = locationType;
  if (stations.length > 0) location.nearest_stations = stations;
  return location;
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
      return buildCampusLocation(prefecture, city, record);
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
      return buildCampusLocation(prefecture, city, record);
    })
    .filter((location): location is SchoolCampusLocation => Boolean(location));
}

function getPrefectureSortIndex(prefecture: string, prefectureOrder: string[]): number {
  const index = prefectureOrder.indexOf(prefecture);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function findInsertIndexForPrefecture(
  locations: SchoolCampusLocation[],
  prefecture: string,
  prefectureOrder: string[]
): number {
  let lastSamePrefectureIndex = -1;
  for (let i = 0; i < locations.length; i += 1) {
    if (locations[i].prefecture === prefecture) {
      lastSamePrefectureIndex = i;
    }
  }
  if (lastSamePrefectureIndex >= 0) return lastSamePrefectureIndex + 1;

  const targetOrder = getPrefectureSortIndex(prefecture, prefectureOrder);
  for (let i = 0; i < locations.length; i += 1) {
    const currentOrder = getPrefectureSortIndex(locations[i].prefecture, prefectureOrder);
    if (currentOrder > targetOrder) return i;
  }
  return locations.length;
}

export function moveCampusLocation(
  locations: SchoolCampusLocation[],
  index: number,
  direction: 'up' | 'down'
): SchoolCampusLocation[] {
  if (direction === 'up' && index === 0) return locations;
  if (direction === 'down' && index >= locations.length - 1) return locations;

  const next = [...locations];
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

export function sortCampusLocationsByPrefecture(
  locations: SchoolCampusLocation[],
  prefectureOrder: string[] = []
): SchoolCampusLocation[] {
  if (locations.length <= 1) return locations;

  const groups = new Map<string, SchoolCampusLocation[]>();
  for (const location of locations) {
    const key = location.prefecture || '';
    const group = groups.get(key);
    if (group) {
      group.push(location);
    } else {
      groups.set(key, [location]);
    }
  }

  const sortedKeys = [...groups.keys()].sort((a, b) => {
    const orderDiff =
      getPrefectureSortIndex(a, prefectureOrder) - getPrefectureSortIndex(b, prefectureOrder);
    if (orderDiff !== 0) return orderDiff;
    return a.localeCompare(b, 'ja');
  });

  return sortedKeys.flatMap((key) => groups.get(key) ?? []);
}

export function insertCampusLocationByPrefecture(
  locations: SchoolCampusLocation[],
  location: SchoolCampusLocation,
  prefectureOrder: string[] = []
): SchoolCampusLocation[] {
  const insertAt = findInsertIndexForPrefecture(locations, location.prefecture, prefectureOrder);
  const next = [...locations];
  next.splice(insertAt, 0, location);
  return next;
}

export function updateCampusLocationPrefecture(
  locations: SchoolCampusLocation[],
  index: number,
  prefecture: string,
  prefectureOrder: string[] = []
): SchoolCampusLocation[] {
  const current = locations[index];
  if (!current || current.prefecture === prefecture) {
    const next = [...locations];
    next[index] = { ...current, prefecture };
    return next;
  }

  const updated = { ...current, prefecture };
  const without = locations.filter((_, i) => i !== index);
  const insertAt = findInsertIndexForPrefecture(without, prefecture, prefectureOrder);
  const next = [...without];
  next.splice(insertAt, 0, updated);
  return next;
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
