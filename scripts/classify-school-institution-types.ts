/**
 * 公式サイト情報をPerplexityで確認し、schools.institution_type を暫定分類するCLI
 *
 * 使い方:
 *   npm run classify:institution-types -- --dry-run --limit=5
 *   npm run classify:institution-types -- --all --sleep-ms=300
 *   npm run classify:institution-types -- --all --force --sleep-ms=300
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  callPerplexityForInstitutionType,
  type PerplexityInstitutionType,
} from '@/lib/perplexity/client';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

type SchoolRow = {
  id: string;
  name: string;
  prefecture: string | null;
  institution_type: PerplexityInstitutionType | null;
};

function parseArgs() {
  const argv = process.argv.slice(2);
  return {
    dryRun: argv.includes('--dry-run'),
    all: argv.includes('--all'),
    force: argv.includes('--force'),
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

async function fetchTargetSchools(
  supabase: SupabaseClient,
  opts: { force: boolean; all: boolean; limit: number | null }
): Promise<SchoolRow[]> {
  const pageSize = 1000;
  const out: SchoolRow[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, prefecture, institution_type')
      .eq('status', 'active')
      .eq('is_public', true)
      .order('name')
      .range(from, from + pageSize - 1);

    if (error) {
      if ('code' in error && error.code === '42703') {
        throw new Error(
          'schools.institution_type カラムが存在しません。先に supabase-migrations/add-school-institution-type.sql を適用してください。'
        );
      }
      throw error;
    }
    if (!data?.length) break;
    out.push(...(data as SchoolRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  let rows = opts.force ? out : out.filter((s) => !s.institution_type);

  if (!opts.all && opts.limit != null) {
    rows = rows.slice(0, opts.limit);
  }
  if (opts.all && opts.limit != null) {
    rows = rows.slice(0, opts.limit);
  }

  return rows;
}

function label(type: PerplexityInstitutionType) {
  if (type === 'public') return '公立';
  if (type === 'private') return '私立';
  return 'サポート校';
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
        '例: npm run classify:institution-types -- --dry-run --limit=5\n' +
        '例: npm run classify:institution-types -- --all --sleep-ms=300'
    );
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const schools = await fetchTargetSchools(supabase, args);

  console.log(
    JSON.stringify(
      {
        dryRun: args.dryRun,
        force: args.force,
        target_count: schools.length,
      },
      null,
      2
    )
  );

  let ok = 0;
  let err = 0;
  let totalTokens = 0;

  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    try {
      const result = await callPerplexityForInstitutionType(school.name, school.prefecture);
      totalTokens += result.tokensUsed.total;

      const prefix = `[${i + 1}/${schools.length}] ${school.name}`;
      const summary = `${label(result.institutionType)} (${result.institutionType}, confidence=${result.confidence})`;

      if (args.dryRun) {
        console.log(`[DRY] ${prefix}: ${summary} - ${result.reason}`);
      } else {
        const { error } = await supabase
          .from('schools')
          .update({ institution_type: result.institutionType })
          .eq('id', school.id);
        if (error) throw error;
        console.log(`[OK] ${prefix}: ${summary} - ${result.reason}`);
      }

      if (result.citations.length > 0) {
        console.log(`  citations: ${result.citations.slice(0, 3).join(' / ')}`);
      }
      ok++;
    } catch (e) {
      err++;
      console.error(`[ERR] ${school.name}:`, e instanceof Error ? e.message : e);
    }

    if (args.sleepMs > 0 && i < schools.length - 1) {
      await sleep(args.sleepMs);
    }
  }

  console.log(
    JSON.stringify(
      {
        done: true,
        ok,
        err,
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
