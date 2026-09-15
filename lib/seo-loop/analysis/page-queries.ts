import { compareSearchAnalytics, getGscSiteUrl } from '@/lib/gsc/client';
import { getGscComparisonPeriods } from '@/lib/gsc/periods';

/** 分析時にFact inventoryへ載せるページ×クエリ内訳の上限 */
export const PAGE_TOP_QUERY_LIMIT = 10;

export type PageQueryFactRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  deltaClicks: number | null;
};

/**
 * 対象ページの上位クエリをGSCから取得する。
 * dimensions=query + page filter で、ページ内の検索意図内訳をFact化する。
 */
export async function fetchPageTopQueries(params: {
  pageUrl: string;
  gscDays: number;
  rowLimit?: number;
}): Promise<PageQueryFactRow[]> {
  const periods = getGscComparisonPeriods(params.gscDays);
  const comparison = await compareSearchAnalytics({
    siteUrl: getGscSiteUrl(),
    current: periods.current,
    previous: periods.previous,
    dimensions: ['query'],
    rowLimit: params.rowLimit ?? PAGE_TOP_QUERY_LIMIT,
    page: params.pageUrl,
  });

  return comparison.rows
    .map((row) => ({
      query: row.keys[0]?.trim() ?? '',
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      deltaClicks:
        typeof row.delta?.clicks === 'number' && Number.isFinite(row.delta.clicks)
          ? row.delta.clicks
          : null,
    }))
    .filter((row) => row.query.length > 0);
}
