import type { SupabaseClient } from '@supabase/supabase-js';
import {
  extractGscOpportunities,
  type GscOpportunity,
} from '@/lib/gsc/analyze';
import { compareSearchAnalytics, getGscSiteUrl } from '@/lib/gsc/client';
import { getGscComparisonPeriods } from '@/lib/gsc/periods';
import type { SeoLoopConfig } from './config';

const MAX_PRIORITY_PAGE_QUERY_URLS = 5;

export function selectPriorityUrls(
  pageRows: Parameters<typeof extractGscOpportunities>[0],
  limit = MAX_PRIORITY_PAGE_QUERY_URLS
): string[] {
  const urls = extractGscOpportunities(pageRows)
    .map((opportunity) => opportunity.targetUrl)
    .filter((url): url is string => Boolean(url));
  return [...new Set(urls)].slice(0, Math.max(0, limit));
}

export function rankAndDedupeOpportunities(
  opportunities: GscOpportunity[],
  limit: number
): GscOpportunity[] {
  const ranked = [...opportunities].sort(
    (a, b) =>
      Number(Boolean(b.targetUrl)) - Number(Boolean(a.targetUrl)) ||
      b.scores.opportunity - a.scores.opportunity
  );
  const deduped = new Map<string, GscOpportunity>();
  for (const opportunity of ranked) {
    const key = opportunity.targetUrl
      ? `${opportunity.issueType}:${opportunity.targetUrl}`
      : opportunity.issueKey;
    if (!deduped.has(key)) deduped.set(key, opportunity);
  }
  return [...deduped.values()].slice(0, limit);
}

export async function observeGscIssues(params: {
  supabase: SupabaseClient;
  runId: string;
  config: SeoLoopConfig;
}): Promise<{ issueCount: number; message: string }> {
  const periods = getGscComparisonPeriods(params.config.gscDays);
  const siteUrl = getGscSiteUrl();

  const [pages, queries] = await Promise.all([
    compareSearchAnalytics({
      siteUrl,
      current: periods.current,
      previous: periods.previous,
      dimensions: ['page'],
      rowLimit: params.config.gscRowLimit,
    }),
    compareSearchAnalytics({
      siteUrl,
      current: periods.current,
      previous: periods.previous,
      dimensions: ['query'],
      rowLimit: params.config.gscRowLimit,
    }),
  ]);

  const priorityUrls = selectPriorityUrls(
    pages.rows,
    Math.min(MAX_PRIORITY_PAGE_QUERY_URLS, params.config.maxDailyProposals)
  );
  const pageQueryResults = await Promise.allSettled(
    priorityUrls.map((page) =>
      compareSearchAnalytics({
        siteUrl,
        current: periods.current,
        previous: periods.previous,
        dimensions: ['page', 'query'],
        rowLimit: params.config.gscRowLimit,
        page,
      })
    )
  );
  const pageQueryComparisons = pageQueryResults
    .filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof compareSearchAnalytics>>> =>
        result.status === 'fulfilled'
    )
    .map((result) => result.value);

  const allOpportunities = [
    ...pageQueryComparisons.flatMap((comparison) =>
      extractGscOpportunities(comparison.rows)
    ),
    ...extractGscOpportunities(pages.rows),
    ...extractGscOpportunities(queries.rows),
  ];
  const opportunities = rankAndDedupeOpportunities(
    allOpportunities,
    params.config.maxDailyProposals
  );

  for (const opportunity of opportunities) {
    const { error } = await params.supabase.from('seo_issues').upsert(
      {
        run_id: params.runId,
        issue_key: opportunity.issueKey,
        issue_type: opportunity.issueType,
        title: opportunity.title,
        description: opportunity.description,
        target_url: opportunity.targetUrl ?? null,
        query: opportunity.query ?? null,
        gsc_snapshot: opportunity.gscSnapshot,
        evidence: {
          source: 'gsc',
          current_period: periods.current,
          previous_period: periods.previous,
        },
        scores: opportunity.scores,
      },
      { onConflict: 'run_id,issue_key' }
    );

    if (error) throw error;
  }

  const { error: runUpdateError } = await params.supabase
    .from('seo_loop_runs')
    .update({
      status: opportunities.length > 0 ? 'analyzing' : 'completed',
      current_step: opportunities.length > 0 ? 'analyze' : 'observe',
      completed_at: opportunities.length > 0 ? null : new Date().toISOString(),
      metadata: {
        gsc_site_url: siteUrl,
        current_period: periods.current,
        previous_period: periods.previous,
        page_rows: pages.rows.length,
        query_rows: queries.rows.length,
        priority_page_query_urls: priorityUrls,
        page_query_failures: pageQueryResults.filter((result) => result.status === 'rejected').length,
        page_query_rows: pageQueryComparisons.reduce(
          (total, comparison) => total + comparison.rows.length,
          0
        ),
        issue_count: opportunities.length,
      },
    })
    .eq('id', params.runId);

  if (runUpdateError) throw runUpdateError;

  return {
    issueCount: opportunities.length,
    message:
      opportunities.length > 0
        ? `GSCから${opportunities.length}件の課題候補を保存しました`
        : 'GSCから優先課題候補は見つかりませんでした',
  };
}
