import type { SupabaseClient } from '@supabase/supabase-js';
import { extractGscOpportunities } from '@/lib/gsc/analyze';
import { compareSearchAnalytics, getGscSiteUrl } from '@/lib/gsc/client';
import { getGscComparisonPeriods } from '@/lib/gsc/periods';
import type { SeoLoopConfig } from './config';

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

  const opportunities = [
    ...extractGscOpportunities(pages.rows),
    ...extractGscOpportunities(queries.rows),
  ].slice(0, params.config.maxDailyProposals);

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
