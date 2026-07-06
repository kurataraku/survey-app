/**
 * 国土数値情報の学校データ(P29)と鉄道駅データ(N02)を使い、
 * 単一キャンパス・最寄り駅なしの学校に最寄り駅を機械的に割り当てるCLI。
 * AI推測を使わない決定的手法。
 *
 * 前提: tmp-geodata/ に以下を展開済みであること(いずれも国土数値情報・CC BY 4.0)
 *   - tmp-geodata/P29/P29-21.geojson         (学校ポイント・全国)
 *     https://nlftp.mlit.go.jp/ksj/gml/data/P29/P29-21/P29-21_GML.zip
 *   - tmp-geodata/N02/UTF-8/N02-24_Station.geojson (駅・全国)
 *     https://nlftp.mlit.go.jp/ksj/gml/data/N02/N02-24/N02-24_GML.zip
 *
 * 使い方:
 *   npx tsx scripts/populate-nearest-stations-from-geodata.ts --dry-run
 *   npx tsx scripts/populate-nearest-stations-from-geodata.ts --apply
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import type { SchoolCampusLocation } from '@/lib/types/schools';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const MAX_STATION_DISTANCE_KM = 3;

/** JISコード順の都道府県(インデックス+1がコード) */
const JIS_PREFECTURES = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県',
  '埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県',
  '岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
  '鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県',
  '佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県',
];

type SchoolFeature = {
  properties: {
    P29_001: string; // 行政区域コード
    P29_003: number; // 学校分類コード
    P29_004: string; // 名称
    P29_005: string; // 所在地
  };
  geometry: { type: string; coordinates: [number, number] };
};

type StationFeature = {
  properties: {
    N02_002: string; // 事業者種別(1=JR新幹線, 2=JR在来線)
    N02_003: string; // 路線名
    N02_004: string; // 運営会社
    N02_005: string; // 駅名
  };
  geometry: { type: string; coordinates: [number, number][] };
};

function normalizeName(name: string): string {
  return name
    .replace(/[\s　]/g, '')
    .replace(/[（(].*?[）)]/g, '')
    // P29は「県立」等の設置者接頭辞なしで収録されているため除去して照合
    .replace(/^(?:北海道立|北海道|.{2,3}[都道府県]立|.{1,4}[市区町村]立|私立|国立)/, '')
    .replace(/(?:通信制課程|通信制)$/, '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase();
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** LineStringの中点座標を返す */
function stationCenter(feature: StationFeature): [number, number] {
  const coords = feature.geometry.coordinates;
  const mid = coords[Math.floor(coords.length / 2)];
  return [mid[1], mid[0]]; // [lat, lon]
}

/** 「上伊那郡辰野町」→「辰野町」のように郡名を除いた末尾自治体名 */
function cityCore(city: string): string {
  const match = city.match(/^(?:.+郡)?(.+?[市区町村])/);
  return match ? match[1] : city;
}

function formatStationLabel(station: StationFeature): string {
  const isJr = station.properties.N02_002 === '1' || station.properties.N02_002 === '2';
  // 「9号線千代田線」の号線接頭辞と「(箱崎線)」の括弧を除去
  let line = station.properties.N02_003.replace(/^\d+号線/, '').replace(/[（()）]/g, '');
  // モノレール等で路線名が「2号線」のみだった場合は運営会社名で補う
  if (!line) line = station.properties.N02_004;
  const prefix = isJr && !line.startsWith('JR') ? `JR${line}` : line;
  return `${prefix} ${station.properties.N02_005}駅`;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です');
    process.exit(1);
  }

  const schoolsGeo = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'tmp-geodata/P29/P29-21.geojson'), 'utf8')
  ).features as SchoolFeature[];
  const stationsGeo = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'tmp-geodata/N02/UTF-8/N02-24_Station.geojson'), 'utf8')
  ).features as StationFeature[];

  // 学校名(正規化) -> features のインデックス
  const schoolIndex = new Map<string, SchoolFeature[]>();
  for (const feature of schoolsGeo) {
    const key = normalizeName(feature.properties.P29_004);
    const list = schoolIndex.get(key) ?? [];
    list.push(feature);
    schoolIndex.set(key, list);
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, campus_locations')
    .eq('status', 'active')
    .eq('is_public', true);
  if (error) throw error;

  type ResultRow = {
    school: string;
    status: 'MATCH' | 'NO_P29' | 'CITY_MISMATCH' | 'TOO_FAR' | 'AMBIGUOUS';
    detail: string;
  };
  const results: ResultRow[] = [];
  let applied = 0;

  for (const school of data ?? []) {
    const locations = (school.campus_locations ?? []) as SchoolCampusLocation[];
    if (locations.length !== 1) continue;
    const campus = locations[0];
    const hasStation =
      (campus.nearest_stations?.length ?? 0) > 0 ||
      (typeof campus.nearest_station === 'string' && campus.nearest_station.trim() !== '');
    if (hasStation) continue;

    const prefCode = String(JIS_PREFECTURES.indexOf(campus.prefecture) + 1).padStart(2, '0');
    if (prefCode === '00') continue;

    const candidates = (schoolIndex.get(normalizeName(school.name)) ?? []).filter(
      (f) => f.properties.P29_001.startsWith(prefCode)
    );
    if (candidates.length === 0) {
      results.push({ school: school.name, status: 'NO_P29', detail: `${campus.prefecture}${campus.city}` });
      continue;
    }

    // 市区町村照合(P29の住所に自治体名が含まれるか)
    const core = cityCore(campus.city);
    const cityMatched = candidates.filter((f) => f.properties.P29_005.includes(core));
    if (cityMatched.length === 0) {
      results.push({
        school: school.name,
        status: 'CITY_MISMATCH',
        detail: `DB=${campus.prefecture}${campus.city} / P29=${candidates.map((f) => f.properties.P29_005).join(' | ')}`,
      });
      continue;
    }
    if (cityMatched.length > 1) {
      results.push({
        school: school.name,
        status: 'AMBIGUOUS',
        detail: cityMatched.map((f) => f.properties.P29_005).join(' | '),
      });
      continue;
    }

    const [lon, lat] = cityMatched[0].geometry.coordinates;
    let best: { station: StationFeature; km: number } | null = null;
    for (const station of stationsGeo) {
      const [sLat, sLon] = stationCenter(station);
      const distance = haversineKm(lat, lon, sLat, sLon);
      if (!best || distance < best.km) best = { station, km: distance };
    }
    if (!best || best.km > MAX_STATION_DISTANCE_KM) {
      results.push({
        school: school.name,
        status: 'TOO_FAR',
        detail: best
          ? `${formatStationLabel(best.station)} (${best.km.toFixed(1)}km)`
          : '駅なし',
      });
      continue;
    }

    const label = formatStationLabel(best.station);
    results.push({
      school: school.name,
      status: 'MATCH',
      detail: `${campus.prefecture}${campus.city} → ${label} (${best.km.toFixed(2)}km) [${cityMatched[0].properties.P29_005}]`,
    });

    if (apply) {
      const updatedLocations: SchoolCampusLocation[] = [
        { ...campus, nearest_stations: [label] },
      ];
      const { error: updateError } = await supabase
        .from('schools')
        .update({ campus_locations: updatedLocations })
        .eq('id', school.id);
      if (updateError) throw updateError;
      applied++;
    }
  }

  const csvPath = path.join(process.cwd(), 'nearest-station-geodata-results.csv');
  const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  fs.writeFileSync(
    csvPath,
    ['school,status,detail', ...results.map((r) => [r.school, r.status, r.detail].map(csvEscape).join(','))].join('\n') + '\n',
    'utf8'
  );

  const counts: Record<string, number> = {};
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  console.log(JSON.stringify({ apply, applied, counts, csv: csvPath }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
