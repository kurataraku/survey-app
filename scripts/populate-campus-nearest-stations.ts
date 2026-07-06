/**
 * 所在地(都道府県+市区町村)が確定済みで最寄り駅がないキャンパスに対し、
 * Perplexityでキャンパス単位に最寄り駅のみを補完するCLI。市区町村は変更しない。
 * 公開口コミが多い学校から処理する。
 *
 * 使い方:
 *   npm run populate:campus-stations -- --dry-run --max-queries=10
 *   npm run populate:campus-stations -- --apply --max-queries=200 --sleep-ms=300
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { callPerplexityForCampusNearestStation } from '@/lib/perplexity/client';
import type { SchoolCampusLocation } from '@/lib/types/schools';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

type SchoolRow = {
  id: string;
  name: string;
  campus_locations: SchoolCampusLocation[];
  review_count: number;
};

function parseArgs() {
  const argv = process.argv.slice(2);
  const num = (name: string, fallback: number) => {
    const arg = argv.find((x) => x.startsWith(`--${name}=`));
    if (!arg) return fallback;
    const n = parseInt(arg.split('=')[1], 10);
    return Number.isFinite(n) ? n : fallback;
  };
  const excludeArg = argv.find((x) => x.startsWith('--exclude='));
  return {
    apply: argv.includes('--apply'),
    maxQueries: num('max-queries', 50),
    sleepMs: num('sleep-ms', 300),
    minReviews: num('min-reviews', 0),
    exclude: excludeArg
      ? excludeArg.slice('--exclude='.length).split(',').map((s) => s.trim()).filter(Boolean)
      : [],
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasStation(location: SchoolCampusLocation): boolean {
  return (
    (location.nearest_stations?.length ?? 0) > 0 ||
    (typeof location.nearest_station === 'string' && location.nearest_station.trim() !== '')
  );
}

async function fetchTargets(supabase: SupabaseClient, minReviews: number): Promise<SchoolRow[]> {
  const pageSize = 1000;
  const rows: Array<Omit<SchoolRow, 'review_count'>> = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, campus_locations')
      .eq('status', 'active')
      .eq('is_public', true)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const locations = (row.campus_locations ?? []) as SchoolCampusLocation[];
      if (locations.length === 0) continue;
      if (locations.every(hasStation)) continue;
      rows.push({ id: row.id, name: row.name, campus_locations: locations });
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const counts = new Map<string, number>();
  const ids = rows.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from('survey_responses')
      .select('school_id')
      .in('school_id', ids.slice(i, i + 200))
      .eq('is_public', true);
    if (error) throw error;
    for (const r of data ?? []) {
      counts.set(r.school_id, (counts.get(r.school_id) || 0) + 1);
    }
  }

  return rows
    .map((row) => ({ ...row, review_count: counts.get(row.id) || 0 }))
    .filter((row) => row.review_count >= minReviews)
    .sort((a, b) => b.review_count - a.review_count || a.name.localeCompare(b.name, 'ja'));
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function main() {
  const args = parseArgs();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !process.env.PERPLEXITY_API_KEY) {
    console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / PERPLEXITY_API_KEY が必要です');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  let schools = await fetchTargets(supabase, args.minReviews);
  if (args.exclude.length > 0) {
    schools = schools.filter(
      (school) => !args.exclude.some((needle) => school.name.includes(needle))
    );
  }
  const totalMissing = schools.reduce(
    (sum, s) => sum + s.campus_locations.filter((l) => !hasStation(l)).length,
    0
  );

  console.log(
    JSON.stringify(
      {
        apply: args.apply,
        max_queries: args.maxQueries,
        min_reviews: args.minReviews,
        target_schools: schools.length,
        missing_station_campuses: totalMissing,
      },
      null,
      2
    )
  );

  type LogRow = { school: string; campus: string; result: string; confidence: string; reason: string };
  const log: LogRow[] = [];
  let queries = 0;
  let filled = 0;
  let skipped = 0;
  let errors = 0;
  let totalTokens = 0;

  for (const school of schools) {
    if (queries >= args.maxQueries) break;
    let updated = false;
    const locations = [...school.campus_locations];

    for (let i = 0; i < locations.length; i++) {
      if (queries >= args.maxQueries) break;
      const campus = locations[i];
      if (hasStation(campus)) continue;

      queries++;
      try {
        const result = await callPerplexityForCampusNearestStation(
          school.name,
          campus.prefecture,
          campus.city
        );
        totalTokens += result.tokensUsed.total;

        if (result.nearestStation && result.confidence !== 'low') {
          filled++;
          updated = true;
          locations[i] = { ...campus, nearest_stations: [result.nearestStation] };
          console.log(
            `[${args.apply ? 'OK' : 'DRY'}] ${school.name} / ${campus.prefecture}${campus.city}: ${result.nearestStation} (${result.confidence})`
          );
          log.push({
            school: school.name,
            campus: `${campus.prefecture}${campus.city}`,
            result: result.nearestStation,
            confidence: result.confidence,
            reason: result.reason,
          });
        } else {
          skipped++;
          console.log(
            `[SKIP] ${school.name} / ${campus.prefecture}${campus.city}: ${result.reason || '駅を確認できず'}`
          );
          log.push({
            school: school.name,
            campus: `${campus.prefecture}${campus.city}`,
            result: '',
            confidence: result.confidence,
            reason: result.reason,
          });
        }
      } catch (e) {
        errors++;
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[ERR] ${school.name} / ${campus.prefecture}${campus.city}:`, message);
        log.push({
          school: school.name,
          campus: `${campus.prefecture}${campus.city}`,
          result: '',
          confidence: 'error',
          reason: message,
        });
      }

      if (args.sleepMs > 0) await sleep(args.sleepMs);
    }

    if (args.apply && updated) {
      const { error } = await supabase
        .from('schools')
        .update({ campus_locations: locations })
        .eq('id', school.id);
      if (error) throw error;
    }
  }

  const csvPath = path.join(process.cwd(), 'campus-station-fill-results.csv');
  fs.writeFileSync(
    csvPath,
    [
      ['school', 'campus', 'result', 'confidence', 'reason'].map(csvEscape).join(','),
      ...log.map((r) => [r.school, r.campus, r.result, r.confidence, r.reason].map(csvEscape).join(',')),
    ].join('\n') + '\n',
    'utf8'
  );

  console.log(
    JSON.stringify(
      { done: true, queries, filled, skipped, errors, total_tokens: totalTokens, csv: csvPath },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
