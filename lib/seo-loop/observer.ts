import type { SupabaseClient } from '@supabase/supabase-js';
import {
  extractGscOpportunities,
  type GscOpportunity,
} from '@/lib/gsc/analyze';
import { compareSearchAnalytics, getGscSiteUrl } from '@/lib/gsc/client';
import { getGscComparisonPeriods } from '@/lib/gsc/periods';
import type { SeoLoopConfig } from './config';
import { isWithinSeoLoopReplenishWindow } from './schedule';

const MAX_PRIORITY_PAGE_QUERY_URLS = 8;

/** 検出する課題数はproposal上限より多く取り、見送り分を吸収する */
const ISSUE_CAP_MULTIPLIER = 2;

/** 1回の補充で追加する課題数。毎時の分析バケットに合わせる */
export const REPLENISH_BATCH_SIZE = 5;

export function issueCapForRun(maxDailyProposals: number): number {
  return Math.max(1, maxDailyProposals) * ISSUE_CAP_MULTIPLIER;
}

export function selectPriorityUrls(
  pageRows: Parameters<typeof extractGscOpportunities>[0],
  limit = MAX_PRIORITY_PAGE_QUERY_URLS,
  excludeUrls: ReadonlySet<string> = new Set()
): string[] {
  const urls = extractGscOpportunities(pageRows)
    .map((opportunity) => opportunity.targetUrl)
    .filter((url): url is string => typeof url === 'string' && url.length > 0)
    .filter((url) => !excludeUrls.has(url));
  return [...new Set(urls)].slice(0, Math.max(0, limit));
}

export function rankAndDedupeOpportunities(
  opportunities: GscOpportunity[],
  limit: number
): GscOpportunity[] {
  const ranked = [...opportunities].sort(
    (a, b) =>
      Number(Boolean(b.targetUrl)) - Number(Boolean(a.targetUrl)) ||
      Number(Boolean(b.query)) - Number(Boolean(a.query)) ||
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

function coverageKey(opportunity: {
  issueType: string;
  targetUrl?: string | null;
  issueKey: string;
}): string {
  return opportunity.targetUrl
    ? `${opportunity.issueType}:${opportunity.targetUrl}`
    : opportunity.issueKey;
}

/**
 * 当日すでに扱った issueType×URL を除外し、クエリ付き候補を優先して補充する。
 */
export function selectReplenishOpportunities(
  opportunities: GscOpportunity[],
  coveredKeys: ReadonlySet<string>,
  existingIssueKeys: ReadonlySet<string>,
  limit: number
): GscOpportunity[] {
  const ranked = opportunities
    .filter(
      (opportunity) =>
        Boolean(opportunity.targetUrl) &&
        !existingIssueKeys.has(opportunity.issueKey) &&
        !coveredKeys.has(coverageKey(opportunity))
    )
    .sort(
      (a, b) =>
        Number(Boolean(b.query)) - Number(Boolean(a.query)) ||
        Number(Boolean(b.targetUrl)) - Number(Boolean(a.targetUrl)) ||
        b.scores.opportunity - a.scores.opportunity
    );

  const selected: GscOpportunity[] = [];
  const seen = new Set<string>();
  for (const opportunity of ranked) {
    const key = coverageKey(opportunity);
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(opportunity);
    if (selected.length >= limit) break;
  }
  return selected;
}

type ExistingIssueCoverage = {
  issueKeys: Set<string>;
  coveredKeys: Set<string>;
  targetUrls: Set<string>;
};

async function loadExistingIssueCoverage(
  supabase: SupabaseClient,
  runId: string
): Promise<ExistingIssueCoverage> {
  const { data, error } = await supabase
    .from('seo_issues')
    .select('issue_key,issue_type,target_url')
    .eq('run_id', runId);
  if (error) throw error;

  const issueKeys = new Set<string>();
  const coveredKeys = new Set<string>();
  const targetUrls = new Set<string>();
  for (const row of data ?? []) {
    const issueKey = String(row.issue_key ?? '');
    const issueType = String(row.issue_type ?? '');
    const targetUrl =
      typeof row.target_url === 'string' && row.target_url.length > 0
        ? row.target_url
        : null;
    if (issueKey) issueKeys.add(issueKey);
    if (targetUrl) targetUrls.add(targetUrl);
    coveredKeys.add(
      coverageKey({
        issueType,
        targetUrl,
        issueKey,
      })
    );
  }
  return { issueKeys, coveredKeys, targetUrls };
}

async function collectGscOpportunities(params: {
  config: SeoLoopConfig;
  excludeUrls?: ReadonlySet<string>;
  priorityUrlLimit?: number;
}): Promise<{
  siteUrl: string;
  periods: ReturnType<typeof getGscComparisonPeriods>;
  opportunities: GscOpportunity[];
  priorityUrls: string[];
  pageRows: number;
  queryRows: number;
  pageQueryFailures: number;
  pageQueryRows: number;
}> {
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

  const issueCap = issueCapForRun(params.config.maxDailyProposals);
  const priorityUrls = selectPriorityUrls(
    pages.rows,
    Math.min(
      params.priorityUrlLimit ?? MAX_PRIORITY_PAGE_QUERY_URLS,
      issueCap
    ),
    params.excludeUrls
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
      (
        result
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<typeof compareSearchAnalytics>>
      > => result.status === 'fulfilled'
    )
    .map((result) => result.value);

  return {
    siteUrl,
    periods,
    opportunities: [
      ...pageQueryComparisons.flatMap((comparison) =>
        extractGscOpportunities(comparison.rows)
      ),
      ...extractGscOpportunities(pages.rows),
      ...extractGscOpportunities(queries.rows),
    ],
    priorityUrls,
    pageRows: pages.rows.length,
    queryRows: queries.rows.length,
    pageQueryFailures: pageQueryResults.filter((result) => result.status === 'rejected')
      .length,
    pageQueryRows: pageQueryComparisons.reduce(
      (total, comparison) => total + comparison.rows.length,
      0
    ),
  };
}

async function saveOpportunities(params: {
  supabase: SupabaseClient;
  runId: string;
  opportunities: GscOpportunity[];
  periods: ReturnType<typeof getGscComparisonPeriods>;
}): Promise<void> {
  for (const opportunity of params.opportunities) {
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
          current_period: params.periods.current,
          previous_period: params.periods.previous,
        },
        scores: opportunity.scores,
        status: 'open',
      },
      { onConflict: 'run_id,issue_key' }
    );
    if (error) throw error;
  }
}

export async function observeGscIssues(params: {
  supabase: SupabaseClient;
  runId: string;
  config: SeoLoopConfig;
}): Promise<{ issueCount: number; message: string }> {
  const collected = await collectGscOpportunities({ config: params.config });
  const issueCap = issueCapForRun(params.config.maxDailyProposals);
  const opportunities = rankAndDedupeOpportunities(
    collected.opportunities,
    issueCap
  );

  await saveOpportunities({
    supabase: params.supabase,
    runId: params.runId,
    opportunities,
    periods: collected.periods,
  });

  const { error: runUpdateError } = await params.supabase
    .from('seo_loop_runs')
    .update({
      status: opportunities.length > 0 ? 'analyzing' : 'completed',
      current_step: opportunities.length > 0 ? 'analyze' : 'observe',
      completed_at: opportunities.length > 0 ? null : new Date().toISOString(),
      metadata: {
        gsc_site_url: collected.siteUrl,
        current_period: collected.periods.current,
        previous_period: collected.periods.previous,
        page_rows: collected.pageRows,
        query_rows: collected.queryRows,
        priority_page_query_urls: collected.priorityUrls,
        page_query_failures: collected.pageQueryFailures,
        page_query_rows: collected.pageQueryRows,
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

/**
 * 未分析課題が尽きたあとに、まだ扱っていないページのGSC候補を追加する。
 * 9〜18時（JST）かつ当日proposal予算があるときだけ呼ぶ想定。
 */
export async function replenishGscIssues(params: {
  supabase: SupabaseClient;
  runId: string;
  config: SeoLoopConfig;
  batchSize?: number;
  now?: Date;
}): Promise<{ issueCount: number; message: string }> {
  if (!isWithinSeoLoopReplenishWindow(params.now)) {
    return {
      issueCount: 0,
      message: '補充ウィンドウ外のためGSC候補を追加しませんでした',
    };
  }

  const coverage = await loadExistingIssueCoverage(params.supabase, params.runId);
  const batchSize = Math.max(1, params.batchSize ?? REPLENISH_BATCH_SIZE);
  const collected = await collectGscOpportunities({
    config: params.config,
    excludeUrls: coverage.targetUrls,
    priorityUrlLimit: Math.min(MAX_PRIORITY_PAGE_QUERY_URLS, batchSize + 3),
  });
  const opportunities = selectReplenishOpportunities(
    collected.opportunities,
    coverage.coveredKeys,
    coverage.issueKeys,
    batchSize
  );

  if (opportunities.length === 0) {
    return {
      issueCount: 0,
      message: '補充できる未処理のGSC課題候補がありませんでした',
    };
  }

  await saveOpportunities({
    supabase: params.supabase,
    runId: params.runId,
    opportunities,
    periods: collected.periods,
  });

  const { data: runRow, error: runReadError } = await params.supabase
    .from('seo_loop_runs')
    .select('metadata')
    .eq('id', params.runId)
    .maybeSingle();
  if (runReadError) throw runReadError;
  const previousMetadata =
    runRow?.metadata && typeof runRow.metadata === 'object' && !Array.isArray(runRow.metadata)
      ? (runRow.metadata as Record<string, unknown>)
      : {};
  const previousReplenishCount = Number(previousMetadata.replenish_count ?? 0);
  const previousIssueCount = Number(previousMetadata.issue_count ?? coverage.issueKeys.size);

  const { error: runUpdateError } = await params.supabase
    .from('seo_loop_runs')
    .update({
      status: 'analyzing',
      current_step: 'analyze',
      completed_at: null,
      next_action_at: new Date().toISOString(),
      metadata: {
        ...previousMetadata,
        gsc_site_url: collected.siteUrl,
        current_period: collected.periods.current,
        previous_period: collected.periods.previous,
        page_rows: collected.pageRows,
        query_rows: collected.queryRows,
        priority_page_query_urls: collected.priorityUrls,
        page_query_failures: collected.pageQueryFailures,
        page_query_rows: collected.pageQueryRows,
        issue_count: previousIssueCount + opportunities.length,
        replenish_count: previousReplenishCount + 1,
        last_replenish_at: new Date().toISOString(),
        last_replenish_issue_count: opportunities.length,
      },
    })
    .eq('id', params.runId);
  if (runUpdateError) throw runUpdateError;

  return {
    issueCount: opportunities.length,
    message: `未処理ページからGSC課題を${opportunities.length}件補充しました`,
  };
}
