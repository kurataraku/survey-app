import * as path from 'path';
import * as dotenv from 'dotenv';
import { compareSearchAnalytics, getGscSiteUrl } from '../lib/gsc/client';
import { getGscComparisonPeriods } from '../lib/gsc/periods';
import type { GscDimension } from '../lib/gsc/types';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

type Args = {
  mode: 'summary' | 'pages' | 'queries' | 'page-query';
  days: number;
  limit: number;
  page?: string;
  query?: string;
};

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  };

  const mode = (get('mode') ?? 'summary') as Args['mode'];
  if (!['summary', 'pages', 'queries', 'page-query'].includes(mode)) {
    throw new Error('--mode は summary / pages / queries / page-query のいずれかです');
  }

  return {
    mode,
    days: Number.parseInt(get('days') ?? '28', 10),
    limit: Number.parseInt(get('limit') ?? '50', 10),
    page: get('page'),
    query: get('query'),
  };
}

function dimensionsFor(mode: Args['mode']): GscDimension[] {
  if (mode === 'pages') return ['page'];
  if (mode === 'queries') return ['query'];
  if (mode === 'page-query') return ['page', 'query'];
  return [];
}

async function main() {
  const args = parseArgs();
  if (args.mode === 'page-query' && !args.page && !args.query) {
    throw new Error('--mode=page-query では --page または --query で対象を絞ってください');
  }

  const siteUrl = getGscSiteUrl();
  const periods = getGscComparisonPeriods(args.days);
  const result = await compareSearchAnalytics({
    siteUrl,
    current: periods.current,
    previous: periods.previous,
    dimensions: dimensionsFor(args.mode),
    rowLimit: args.limit,
    page: args.page,
    query: args.query,
  });

  console.log(
    JSON.stringify(
      {
        siteUrl,
        mode: args.mode,
        current: result.current,
        previous: result.previous,
        rowCount: result.rows.length,
        rows: result.rows,
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[gsc-search-analytics] ${message}`);
  process.exit(1);
});
