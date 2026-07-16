import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

type CampusLocation = {
  prefecture?: unknown;
  city?: unknown;
  nearest_station?: unknown;
  nearest_stations?: unknown;
};

type SchoolRow = {
  id: string;
  name: string;
  prefecture: string | null;
  campus_locations: unknown;
};

type StationGeoJsonFeature = {
  properties?: {
    N02_003?: string;
    N02_004?: string;
    N02_005?: string;
  };
};

type DictionaryEntry = {
  term: string;
  type: 'city' | 'station' | 'alias';
  prefecture: string | null;
  city: string | null;
  station: string | null;
  schoolCount: number;
  confidence: 'high' | 'medium' | 'low';
  ambiguous: boolean;
  examples: string[];
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const AMBIGUOUS_TERMS = new Set([
  '中央',
  '希望',
  '本郷',
  '一社',
  '高田',
  '大久保',
  '学園前',
  '公園',
  '市役所',
  '県庁',
  '大学',
  '高校',
  '学校',
  '前',
]);

function normalizeTerm(value: string): string {
  return value
    .replace(/[ 　]/g, '')
    .replace(/[「」『』（）()]/g, '')
    .replace(/駅前|駅近/g, '駅')
    .trim();
}

function normalizeStation(value: string): string {
  const term = normalizeTerm(value);
  if (!term) return '';
  return term.endsWith('駅') ? term : `${term}駅`;
}

function getCampusLocations(value: unknown): Array<{ prefecture: string; city: string; stations: string[] }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((location) => {
      if (!location || typeof location !== 'object') return null;
      const record = location as CampusLocation;
      const prefecture = typeof record.prefecture === 'string' ? normalizeTerm(record.prefecture) : '';
      const city = typeof record.city === 'string' ? normalizeTerm(record.city) : '';
      if (!prefecture || !city) return null;

      const stationValues = Array.isArray(record.nearest_stations)
        ? record.nearest_stations
        : typeof record.nearest_station === 'string'
          ? [record.nearest_station]
          : [];
      const stations = stationValues
        .map((station) => (typeof station === 'string' ? normalizeStation(station) : ''))
        .filter(Boolean);

      return { prefecture, city, stations };
    })
    .filter((location): location is { prefecture: string; city: string; stations: string[] } =>
      Boolean(location)
    );
}

function addEntry(
  map: Map<string, DictionaryEntry & { schoolNames: Set<string> }>,
  input: {
    term: string;
    type: DictionaryEntry['type'];
    prefecture: string | null;
    city: string | null;
    station: string | null;
    schoolName: string;
  }
) {
  const term = normalizeTerm(input.term);
  if (term.length < 2) return;
  if (/学校|高校|通信制|キャンパス|校舎/.test(term)) return;

  const key = `${input.type}:${term}:${input.prefecture ?? ''}:${input.city ?? ''}:${input.station ?? ''}`;
  const current =
    map.get(key) ??
    {
      term,
      type: input.type,
      prefecture: input.prefecture,
      city: input.city,
      station: input.station,
      schoolCount: 0,
      confidence: 'medium' as const,
      ambiguous: false,
      examples: [],
      schoolNames: new Set<string>(),
    };

  current.schoolNames.add(input.schoolName);
  map.set(key, current);
}

function classify(entry: DictionaryEntry & { schoolNames: Set<string> }): DictionaryEntry {
  const withoutStationSuffix = entry.term.replace(/駅$/, '');
  const ambiguous =
    AMBIGUOUS_TERMS.has(entry.term) ||
    AMBIGUOUS_TERMS.has(withoutStationSuffix) ||
    entry.term.length <= 2;

  let confidence: DictionaryEntry['confidence'] = 'medium';
  if (!ambiguous && /(?:市|区|町|村|駅)$/.test(entry.term)) {
    confidence = 'high';
  }
  if (!ambiguous && entry.term.length >= 4 && entry.type === 'station') {
    confidence = 'high';
  }
  if (ambiguous) {
    confidence = 'low';
  }

  const examples = [...entry.schoolNames].sort().slice(0, 5);
  return {
    term: entry.term,
    type: entry.type,
    prefecture: entry.prefecture,
    city: entry.city,
    station: entry.station,
    schoolCount: entry.schoolNames.size,
    confidence,
    ambiguous,
    examples,
  };
}

function csvEscape(value: unknown): string {
  const text = Array.isArray(value) ? value.join(' / ') : String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  values.push(current);
  return values;
}

function readCsvRows(filePath: string): string[][] {
  if (!fs.existsSync(filePath)) return [];
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.slice(1).map(parseCsvLine);
}

function parsePrefectureAndCity(value: string): { prefecture: string | null; city: string | null } {
  const normalized = normalizeTerm(value);
  const prefectureMatch = normalized.match(/^(北海道|東京都|大阪府|京都府|.{2,3}県)/u);
  const cityMatch = normalized.match(/(.*?(?:市|区|町|村))/u);
  return {
    prefecture: prefectureMatch?.[1] ?? null,
    city: cityMatch?.[1] ?? null,
  };
}

function extractStationNames(value: string): string[] {
  const normalized = value.replace(/[「」『』（）()]/g, ' ');
  const matches = normalized.match(/[一-龥ぁ-んァ-ヶA-Za-z0-9ー]+駅/gu) ?? [];
  return [...new Set(matches.map(normalizeStation).filter((station) => station.endsWith('駅')))];
}

function addStationCsvEntries(map: Map<string, DictionaryEntry & { schoolNames: Set<string> }>) {
  const campusStationRows = readCsvRows(path.join(process.cwd(), 'campus-station-fill-results.csv'));
  for (const row of campusStationRows) {
    const [schoolName, campus, stationRaw, confidence] = row;
    if (!schoolName || !campus || !stationRaw) continue;
    if (confidence === 'low') continue;
    const { prefecture, city } = parsePrefectureAndCity(campus);
    const stationParts = extractStationNames(stationRaw);
    for (const station of stationParts) {
      addEntry(map, {
        term: station,
        type: 'station',
        prefecture,
        city,
        station,
        schoolName,
      });
      addEntry(map, {
        term: station.replace(/駅$/, ''),
        type: 'alias',
        prefecture,
        city,
        station,
        schoolName,
      });
    }
  }

  const geodataRows = readCsvRows(path.join(process.cwd(), 'nearest-station-geodata-results.csv'));
  for (const row of geodataRows) {
    const [schoolName, status, detail] = row;
    if (!schoolName || status !== 'MATCH' || !detail) continue;
    const locationPart = detail.split('→')[0] ?? '';
    const stationPart = detail.split('→')[1]?.split('(')[0] ?? '';
    const { prefecture, city } = parsePrefectureAndCity(locationPart);
    for (const station of extractStationNames(stationPart)) {
      addEntry(map, {
        term: station,
        type: 'station',
        prefecture,
        city,
        station,
        schoolName,
      });
      addEntry(map, {
        term: station.replace(/駅$/, ''),
        type: 'alias',
        prefecture,
        city,
        station,
        schoolName,
      });
    }
  }
}

function addNationalStationGeojsonEntries(
  map: Map<string, DictionaryEntry & { schoolNames: Set<string> }>
) {
  const stationGeojsonPath = path.join(
    process.cwd(),
    'tmp-geodata',
    'N02',
    'UTF-8',
    'N02-24_Station.geojson'
  );
  if (!fs.existsSync(stationGeojsonPath)) return;

  const raw = JSON.parse(fs.readFileSync(stationGeojsonPath, 'utf8')) as {
    features?: StationGeoJsonFeature[];
  };
  const features = raw.features ?? [];
  for (const feature of features) {
    const stationName = feature.properties?.N02_005;
    if (!stationName) continue;
    const station = normalizeStation(stationName);
    if (!station.endsWith('駅')) continue;
    const line = feature.properties?.N02_003 ? normalizeTerm(feature.properties.N02_003) : '';
    const operator = feature.properties?.N02_004 ? normalizeTerm(feature.properties.N02_004) : '';
    const sourceLabel = ['国土数値情報駅データ', operator, line].filter(Boolean).join(':');

    addEntry(map, {
      term: station,
      type: 'station',
      prefecture: null,
      city: null,
      station,
      schoolName: sourceLabel,
    });
    addEntry(map, {
      term: station.replace(/駅$/, ''),
      type: 'alias',
      prefecture: null,
      city: null,
      station,
      schoolName: sourceLabel,
    });
  }
}

function toCsv(entries: DictionaryEntry[]): string {
  const header = [
    'term',
    'type',
    'prefecture',
    'city',
    'station',
    'source_count',
    'confidence',
    'ambiguous',
    'examples',
  ];
  const rows = entries.map((entry) =>
    [
      entry.term,
      entry.type,
      entry.prefecture,
      entry.city,
      entry.station,
      entry.schoolCount,
      entry.confidence,
      entry.ambiguous,
      entry.examples,
    ]
      .map(csvEscape)
      .join(',')
  );
  return `${header.join(',')}\n${rows.join('\n')}\n`;
}

function toMarkdown(entries: DictionaryEntry[]): string {
  const summary = [
    '# 地名・駅名辞書プレビュー',
    '',
    `- generated_at: ${new Date().toISOString()}`,
    `- total: ${entries.length}`,
    `- high: ${entries.filter((entry) => entry.confidence === 'high').length}`,
    `- medium: ${entries.filter((entry) => entry.confidence === 'medium').length}`,
    `- low: ${entries.filter((entry) => entry.confidence === 'low').length}`,
    '',
    '## 低信頼・曖昧語サンプル',
    '',
  ];

  const ambiguousRows = entries
    .filter((entry) => entry.ambiguous || entry.confidence === 'low')
    .slice(0, 80)
    .map(
      (entry) =>
        `- ${entry.term} (${entry.type}, ${entry.prefecture ?? '-'}, ${entry.city ?? '-'}, sources=${entry.schoolCount})`
    );

  const highRows = entries
    .filter((entry) => entry.confidence === 'high')
    .slice(0, 80)
    .map(
      (entry) =>
        `- ${entry.term} (${entry.type}, ${entry.prefecture ?? '-'}, ${entry.city ?? '-'}, sources=${entry.schoolCount})`
    );

  return [
    ...summary,
    ...(ambiguousRows.length > 0 ? ambiguousRows : ['- なし']),
    '',
    '## 高信頼サンプル',
    '',
    ...highRows,
    '',
  ].join('\n');
}

function toGeneratedTs(entries: DictionaryEntry[]): string {
  return `// Auto-generated by scripts/export-location-dictionary.ts\n` +
    `// Do not edit manually.\n\n` +
    `export type GeneratedLocationDictionaryEntry = {\n` +
    `  term: string;\n` +
    `  type: 'city' | 'station' | 'alias';\n` +
    `  prefecture: string | null;\n` +
    `  city: string | null;\n` +
    `  station: string | null;\n` +
    `  schoolCount: number;\n` +
    `  confidence: 'high' | 'medium' | 'low';\n` +
    `  ambiguous: boolean;\n` +
    `};\n\n` +
    `export const generatedLocationDictionary = ${JSON.stringify(
      entries.map(({ examples: _examples, ...entry }) => entry),
      null,
      2
    )} as const satisfies readonly GeneratedLocationDictionaryEntry[];\n`;
}

async function main() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です。');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from('schools')
    .select('id,name,prefecture,campus_locations')
    .eq('status', 'active')
    .eq('is_public', true)
    .limit(3000);

  if (error) {
    console.error('学校所在地の取得に失敗しました:', error);
    process.exit(1);
  }

  const map = new Map<string, DictionaryEntry & { schoolNames: Set<string> }>();
  for (const school of (data ?? []) as SchoolRow[]) {
    const locations = getCampusLocations(school.campus_locations);
    for (const location of locations) {
      addEntry(map, {
        term: location.city,
        type: 'city',
        prefecture: location.prefecture,
        city: location.city,
        station: null,
        schoolName: school.name,
      });

      const cityParts = location.city.match(/[一-龥ぁ-んァ-ヶA-Za-z0-9]+?(?:市|区|町|村)/gu) ?? [];
      for (const cityPart of cityParts) {
        addEntry(map, {
          term: cityPart,
          type: 'alias',
          prefecture: location.prefecture,
          city: location.city,
          station: null,
          schoolName: school.name,
        });
      }

      for (const station of location.stations) {
        addEntry(map, {
          term: station,
          type: 'station',
          prefecture: location.prefecture,
          city: location.city,
          station,
          schoolName: school.name,
        });
        if (station.endsWith('駅')) {
          addEntry(map, {
            term: station.replace(/駅$/, ''),
            type: 'alias',
            prefecture: location.prefecture,
            city: location.city,
            station,
            schoolName: school.name,
          });
        }
      }
    }
  }
  addStationCsvEntries(map);
  addNationalStationGeojsonEntries(map);

  const entries = [...map.values()]
    .map(classify)
    .sort((a, b) => {
      const confidenceOrder = { high: 0, medium: 1, low: 2 };
      return (
        confidenceOrder[a.confidence] - confidenceOrder[b.confidence] ||
        a.prefecture?.localeCompare(b.prefecture ?? '') ||
        a.term.localeCompare(b.term, 'ja')
      );
    });

  const generatedDir = path.join(process.cwd(), 'lib', 'locations');
  const logsDir = path.join(process.cwd(), 'logs');
  fs.mkdirSync(generatedDir, { recursive: true });
  fs.mkdirSync(logsDir, { recursive: true });

  fs.writeFileSync(
    path.join(generatedDir, 'generated-location-dictionary.ts'),
    toGeneratedTs(entries),
    'utf8'
  );
  fs.writeFileSync(path.join(logsDir, 'location-dictionary-preview.csv'), toCsv(entries), 'utf8');
  fs.writeFileSync(path.join(logsDir, 'location-dictionary-preview.md'), toMarkdown(entries), 'utf8');

  console.log(`Generated ${entries.length} location dictionary entries.`);
  console.log('Generated: lib/locations/generated-location-dictionary.ts');
  console.log('Preview: logs/location-dictionary-preview.csv');
  console.log('Preview: logs/location-dictionary-preview.md');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
