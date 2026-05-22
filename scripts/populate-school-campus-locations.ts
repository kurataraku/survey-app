/**
 * 公式サイト情報をPerplexityで確認し、schools.campus_locations を暫定登録するCLI
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
};

type ReviewCandidate = {
  school_name: string;
  reason: string;
  confidence: string;
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

async function fetchTargetSchools(
  supabase: SupabaseClient,
  opts: { force: boolean; all: boolean; limit: number | null; name: string }
): Promise<SchoolRow[]> {
  const pageSize = 1000;
  const out: SchoolRow[] = [];
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
    out.push(...(data as SchoolRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  let rows = out;
  if (opts.name) {
    const needle = opts.name.toLowerCase();
    rows = rows.filter((s) => s.name.toLowerCase().includes(needle));
  }
  rows = opts.force ? rows : rows.filter((s) => !hasCampusLocations(s.campus_locations));

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

function writeReviewCsv(candidates: ReviewCandidate[]) {
  const filePath = path.join(process.cwd(), 'campus-location-review-candidates.csv');
  const rows = [
    ['school_name', 'reason', 'confidence', 'citations'].map(csvEscape).join(','),
    ...candidates.map((candidate) =>
      [
        candidate.school_name,
        candidate.reason,
        candidate.confidence,
        candidate.citations.join(' / '),
      ].map(csvEscape).join(',')
    ),
  ];
  fs.writeFileSync(filePath, `${rows.join('\n')}\n`, 'utf8');
  return filePath;
}

function formatLocations(locations: PerplexityCampusLocation[]) {
  return locations.map((location) => `${location.prefecture}${location.city}`).join('、');
}

function mergeLocations(
  existing: PerplexityCampusLocation[] | null,
  generated: PerplexityCampusLocation[]
): PerplexityCampusLocation[] {
  const merged: PerplexityCampusLocation[] = [];
  const seen = new Set<string>();
  for (const location of [...(existing ?? []), ...generated]) {
    if (!location?.prefecture || !location?.city) continue;
    const normalized = {
      prefecture: location.prefecture.trim(),
      city: location.city.trim(),
    };
    const key = `${normalized.prefecture}::${normalized.city}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(normalized);
  }
  return merged;
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

  console.log(
    JSON.stringify(
      {
        dryRun: args.dryRun,
        force: args.force,
        merge: args.merge,
        name: args.name || null,
        target_count: schools.length,
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
          reason:
            result.reason ||
            (result.officialFound
              ? '公式情報は見つかったが、市区町村まで確定できませんでした。'
              : '公式HPが見つからない、または公式情報で所在地を確認できませんでした。'),
          confidence: result.confidence,
          citations: result.citations.slice(0, 5),
        });
        console.log(
          `[SKIP] [${i + 1}/${schools.length}] ${school.name}: ${result.reason || '所在地未確定'}`
        );
      } else if (args.dryRun) {
        ok++;
        const mergedLocations = args.merge
          ? mergeLocations(school.campus_locations, result.locations)
          : result.locations;
        console.log(
          `[DRY] [${i + 1}/${schools.length}] ${school.name}: ${formatLocations(mergedLocations)} (${result.confidence})`
        );
      } else {
        const mergedLocations = args.merge
          ? mergeLocations(school.campus_locations, result.locations)
          : result.locations;
        const { error } = await supabase
          .from('schools')
          .update({ campus_locations: mergedLocations })
          .eq('id', school.id);
        if (error) throw error;
        ok++;
        console.log(
          `[OK] [${i + 1}/${schools.length}] ${school.name}: ${formatLocations(mergedLocations)} (${result.confidence})`
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
        reason: message,
        confidence: 'error',
        citations: [],
      });
      console.error(`[ERR] ${school.name}:`, message);
    }

    if (args.sleepMs > 0 && i < schools.length - 1) {
      await sleep(args.sleepMs);
    }
  }

  const reviewCsvPath = writeReviewCsv(reviewCandidates);

  console.log(
    JSON.stringify(
      {
        done: true,
        ok,
        skip,
        err,
        review_candidates: reviewCandidates.length,
        review_csv: reviewCsvPath,
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
