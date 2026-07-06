/**
 * 公式サイト情報をPerplexityで確認し、schools.campus_locations を暫定登録するCLI。
 * 公開口コミが1件以上ある学校のみ対象（口コミ多い順）。
 *
 * 使い方:
 *   npm run populate:campus-locations -- --dry-run --limit=5
 *   npm run populate:campus-locations -- --all --sleep-ms=300
 *   npm run populate:campus-locations -- --all --force --sleep-ms=300
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  callPerplexityForCampusLocations,
  type PerplexityCampusLocation,
} from '@/lib/perplexity/client';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

type SchoolRow = {
  id: string;
  name: string;
  prefecture: string | null;
  prefectures: string[] | null;
  campus_locations: PerplexityCampusLocation[] | null;
  review_count: number;
};

type ReviewCandidate = {
  school_name: string;
  review_count: number;
  reason: string;
  confidence: string;
  generated_locations: string;
  citations: string[];
};

type GeneratedCandidate = {
  school_name: string;
  review_count: number;
  confidence: string;
  locations: PerplexityCampusLocation[];
  reason: string;
  citations: string[];
};

function parseArgs() {
  const argv = process.argv.slice(2);
  return {
    dryRun: argv.includes('--dry-run'),
    all: argv.includes('--all'),
    force: argv.includes('--force'),
    merge: !argv.includes('--replace'),
    name: (() => {
      const a = argv.find((x) => x.startsWith('--name='));
      return a ? a.slice('--name='.length).trim() : '';
    })(),
    limit: (() => {
      const a = argv.find((x) => x.startsWith('--limit='));
      if (!a) return null;
      const n = parseInt(a.split('=')[1], 10);
      return Number.isFinite(n) ? n : null;
    })(),
    sleepMs: (() => {
      const a = argv.find((x) => x.startsWith('--sleep-ms='));
      if (!a) return 0;
      const n = parseInt(a.split('=')[1], 10);
      return Number.isFinite(n) ? n : 0;
    })(),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasCampusLocations(value: unknown): boolean {
  return Array.isArray(value) && value.some((location) => {
    if (!location || typeof location !== 'object') return false;
    const record = location as Record<string, unknown>;
    return typeof record.prefecture === 'string' && record.prefecture.trim() !== ''
      && typeof record.city === 'string' && record.city.trim() !== '';
  });
}

function hasNearestStation(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((location) => {
    if (!location || typeof location !== 'object') return false;
    const record = location as Record<string, unknown>;
    if (Array.isArray(record.nearest_stations)) {
      return record.nearest_stations.some(
        (station) => typeof station === 'string' && station.trim() !== ''
      );
    }
    return typeof record.nearest_station === 'string' && record.nearest_station.trim() !== '';
  });
}

/** 市区町村または最寄り駅が欠けている学校を補完対象にする */
function needsCampusLocationUpdate(value: unknown): boolean {
  return !hasCampusLocations(value) || !hasNearestStation(value);
}

async function fetchPublicReviewCounts(
  supabase: SupabaseClient,
  schoolIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const chunkSize = 200;
  for (let i = 0; i < schoolIds.length; i += chunkSize) {
    const chunk = schoolIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('survey_responses')
      .select('school_id')
      .in('school_id', chunk)
      .eq('is_public', true);
    if (error) throw error;
    for (const row of data ?? []) {
      if (!row.school_id) continue;
      counts.set(row.school_id, (counts.get(row.school_id) || 0) + 1);
    }
  }
  return counts;
}

async function fetchTargetSchools(
  supabase: SupabaseClient,
  opts: { force: boolean; all: boolean; limit: number | null; name: string }
): Promise<SchoolRow[]> {
  const pageSize = 1000;
  const out: Array<Omit<SchoolRow, 'review_count'>> = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, prefecture, prefectures, campus_locations')
      .eq('status', 'active')
      .eq('is_public', true)
      .order('name')
      .range(from, from + pageSize - 1);

    if (error) {
      if ('code' in error && error.code === '42703') {
        throw new Error(
          'schools.campus_locations カラムが存在しません。先に supabase-migrations/add-school-campus-locations.sql を適用してください。'
        );
      }
      throw error;
    }
    if (!data?.length) break;
    out.push(...(data as Array<Omit<SchoolRow, 'review_count'>>));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const reviewCounts = await fetchPublicReviewCounts(
    supabase,
    out.map((school) => school.id)
  );

  let rows: SchoolRow[] = out
    .map((school) => ({
      ...school,
      review_count: reviewCounts.get(school.id) || 0,
    }))
    .filter((school) => school.review_count > 0);

  if (opts.name) {
    const needle = opts.name.toLowerCase();
    // 完全一致があればそれを優先（「未来高等学校」で「飛鳥未来高等学校」を巻き込まないため）
    const exact = rows.filter((s) => s.name.toLowerCase() === needle);
    rows = exact.length > 0 ? exact : rows.filter((s) => s.name.toLowerCase().includes(needle));
  }
  rows = opts.force
    ? rows
    : rows.filter((s) => needsCampusLocationUpdate(s.campus_locations));

  rows.sort(
    (a, b) =>
      b.review_count - a.review_count || a.name.localeCompare(b.name, 'ja')
  );

  if (!opts.all && opts.limit != null) {
    rows = rows.slice(0, opts.limit);
  }
  if (opts.all && opts.limit != null) {
    rows = rows.slice(0, opts.limit);
  }

  return rows;
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** IDE等でファイルが開かれていてロック中（EBUSY）の場合はタイムスタンプ付き別名で保存する */
function writeCsvWithFallback(filePath: string, content: string): string {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return filePath;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EBUSY') throw error;
    const fallbackPath = filePath.replace(/\.csv$/, `-${Date.now()}.csv`);
    fs.writeFileSync(fallbackPath, content, 'utf8');
    console.warn(`[WARN] ${path.basename(filePath)} がロック中のため ${path.basename(fallbackPath)} に保存しました`);
    return fallbackPath;
  }
}

function writeReviewCsv(candidates: ReviewCandidate[]) {
  const filePath = path.join(process.cwd(), 'campus-location-review-candidates.csv');
  const rows = [
    ['school_name', 'review_count', 'reason', 'confidence', 'generated_locations', 'citations'].map(csvEscape).join(','),
    ...candidates.map((candidate) =>
      [
        candidate.school_name,
        String(candidate.review_count),
        candidate.reason,
        candidate.confidence,
        candidate.generated_locations,
        candidate.citations.join(' / '),
      ].map(csvEscape).join(',')
    ),
  ];
  return writeCsvWithFallback(filePath, `${rows.join('\n')}\n`);
}

function writeGeneratedCsv(candidates: GeneratedCandidate[]) {
  const filePath = path.join(process.cwd(), 'campus-location-generated-candidates.csv');
  const rows = [
    ['school_name', 'review_count', 'confidence', 'locations', 'reason', 'citations'].map(csvEscape).join(','),
    ...candidates.map((candidate) =>
      [
        candidate.school_name,
        String(candidate.review_count),
        candidate.confidence,
        formatLocations(candidate.locations),
        candidate.reason,
        candidate.citations.join(' / '),
      ].map(csvEscape).join(',')
    ),
  ];
  return writeCsvWithFallback(filePath, `${rows.join('\n')}\n`);
}

function formatLocations(locations: PerplexityCampusLocation[]) {
  return locations
    .map((location) => {
      const stations = location.nearest_stations?.length
        ? `（最寄り: ${location.nearest_stations.join('／')}）`
        : '';
      return `${location.prefecture}${location.city}${stations}`;
    })
    .join('、');
}

function normalizeLocation(location: PerplexityCampusLocation): PerplexityCampusLocation | null {
  const prefecture = location.prefecture?.trim();
  const city = location.city?.trim();
  if (!prefecture || !city) return null;
  const nearestStations = (location.nearest_stations ?? [])
    .map((station) => station.trim())
    .filter(Boolean)
    .slice(0, 1);
  return nearestStations.length > 0
    ? { prefecture, city, nearest_stations: nearestStations }
    : { prefecture, city };
}

/**
 * 同一都道府県内で「札幌市」と「札幌市中央区」のように粗い市と区レベルが併存する場合、
 * 粗い方（他エントリの前方一致になっている方）を除外する
 */
function dropCoarseDuplicates(locations: PerplexityCampusLocation[]): PerplexityCampusLocation[] {
  return locations.filter((location) => {
    const hasFiner = locations.some(
      (other) =>
        other !== location &&
        other.prefecture === location.prefecture &&
        other.city !== location.city &&
        other.city.startsWith(location.city)
    );
    return !hasFiner;
  });
}

function mergeLocations(
  existing: PerplexityCampusLocation[] | null,
  generated: PerplexityCampusLocation[]
): PerplexityCampusLocation[] {
  const merged: PerplexityCampusLocation[] = [];
  for (const location of [...(existing ?? []), ...generated]) {
    const normalized = normalizeLocation(location);
    if (!normalized) continue;
    const key = `${normalized.prefecture}::${normalized.city}`;
    const current = merged.find((item) => `${item.prefecture}::${item.city}` === key);
    if (current) {
      if (!current.nearest_stations?.length && normalized.nearest_stations?.length) {
        current.nearest_stations = normalized.nearest_stations.slice(0, 1);
      }
      continue;
    }
    merged.push(normalized);
  }
  return dropCoarseDuplicates(merged);
}

async function main() {
  const args = parseArgs();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です');
    process.exit(1);
  }
  if (!process.env.PERPLEXITY_API_KEY) {
    console.error('PERPLEXITY_API_KEY が必要です');
    process.exit(1);
  }
  if (!args.all && args.limit == null) {
    console.error(
      '使い方: --all または --limit=N を指定してください（初回は --dry-run 推奨）\n' +
        '例: npm run populate:campus-locations -- --dry-run --limit=5\n' +
        '例: npm run populate:campus-locations -- --all --sleep-ms=300'
    );
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const schools = await fetchTargetSchools(supabase, args);
  const reviewCandidates: ReviewCandidate[] = [];
  const generatedCandidates: GeneratedCandidate[] = [];

  console.log(
    JSON.stringify(
      {
        dryRun: args.dryRun,
        force: args.force,
        merge: args.merge,
        name: args.name || null,
        require_public_reviews: true,
        target_count: schools.length,
        targets: schools.map((school) => ({
          name: school.name,
          review_count: school.review_count,
        })),
      },
      null,
      2
    )
  );

  let ok = 0;
  let skip = 0;
  let err = 0;
  let totalTokens = 0;

  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    try {
      const prefectures = school.prefectures?.length
        ? school.prefectures
        : school.prefecture
          ? [school.prefecture]
          : [];
      const result = await callPerplexityForCampusLocations(school.name, prefectures);
      totalTokens += result.tokensUsed.total;

      const shouldUpdate =
        result.officialFound && result.confidence !== 'low' && result.locations.length > 0;

      if (!shouldUpdate) {
        skip++;
        reviewCandidates.push({
          school_name: school.name,
          review_count: school.review_count,
          reason:
            result.reason ||
            (result.officialFound
              ? '公式情報は見つかったが、市区町村まで確定できませんでした。'
              : '公式HPが見つからない、または公式情報で所在地を確認できませんでした。'),
          confidence: result.confidence,
          generated_locations: formatLocations(result.locations),
          citations: result.citations.slice(0, 5),
        });
        console.log(
          `[SKIP] [${i + 1}/${schools.length}] ${school.name} (口コミ${school.review_count}件): ${result.reason || '所在地未確定'}`
        );
      } else if (args.dryRun) {
        ok++;
        const mergedLocations = args.merge
          ? mergeLocations(school.campus_locations, result.locations)
          : result.locations;
        generatedCandidates.push({
          school_name: school.name,
          review_count: school.review_count,
          confidence: result.confidence,
          locations: mergedLocations,
          reason: result.reason,
          citations: result.citations.slice(0, 5),
        });
        console.log(
          `[DRY] [${i + 1}/${schools.length}] ${school.name} (口コミ${school.review_count}件): ${formatLocations(mergedLocations)} (${result.confidence})`
        );
      } else {
        const mergedLocations = args.merge
          ? mergeLocations(school.campus_locations, result.locations)
          : result.locations;
        generatedCandidates.push({
          school_name: school.name,
          review_count: school.review_count,
          confidence: result.confidence,
          locations: mergedLocations,
          reason: result.reason,
          citations: result.citations.slice(0, 5),
        });
        const { error } = await supabase
          .from('schools')
          .update({ campus_locations: mergedLocations })
          .eq('id', school.id);
        if (error) throw error;
        ok++;
        console.log(
          `[OK] [${i + 1}/${schools.length}] ${school.name} (口コミ${school.review_count}件): ${formatLocations(mergedLocations)} (${result.confidence})`
        );
      }

      if (result.citations.length > 0) {
        console.log(`  citations: ${result.citations.slice(0, 3).join(' / ')}`);
      }
    } catch (e) {
      err++;
      const message = e instanceof Error ? e.message : String(e);
      reviewCandidates.push({
        school_name: school.name,
        review_count: school.review_count,
        reason: message,
        confidence: 'error',
        generated_locations: '',
        citations: [],
      });
      console.error(`[ERR] ${school.name} (口コミ${school.review_count}件):`, message);
    }

    if (args.sleepMs > 0 && i < schools.length - 1) {
      await sleep(args.sleepMs);
    }
  }

  const reviewCsvPath = writeReviewCsv(reviewCandidates);
  const generatedCsvPath = writeGeneratedCsv(generatedCandidates);

  console.log(
    JSON.stringify(
      {
        done: true,
        ok,
        skip,
        err,
        review_candidates: reviewCandidates.length,
        review_csv: reviewCsvPath,
        generated_candidates: generatedCandidates.length,
        generated_csv: generatedCsvPath,
        total_tokens: totalTokens,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
