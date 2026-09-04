import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { getSeoLoopConfig } from './config';
import { executeApprovedProposal } from './executor';
import { payloadHash } from './hash';
import { acquireRunLock, createOrLoadRun, dailyRunKey, releaseRunLock } from './lock';
import { analyzeIssuesToProposals } from './analyzer';
import { observeGscIssues } from './observer';
import { notifySlackApproval } from './slack';
import type { SeoLoopRun, SeoLoopStepResult } from './types';

type ProposalRow = {
  id: string;
  version: number;
  payload_hash: string;
  action: string;
  rationale: string | null;
  payload: unknown;
};

type ApprovedProposalRow = ProposalRow & {
  seo_approvals: Array<{
    id: string;
    proposal_payload_hash: string;
    proposal_version: number;
    status: string;
  }>;
};

async function updateRun(
  supabase: SupabaseClient,
  runId: string,
  values: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('seo_loop_runs').update(values).eq('id', runId);
  if (error) throw error;
}

async function handlePendingApproval(
  supabase: SupabaseClient,
  run: SeoLoopRun
): Promise<SeoLoopStepResult> {
  const { data: proposals, error } = await supabase
    .from('seo_proposals')
    .select('id,version,payload_hash,action,rationale,payload')
    .eq('run_id', run.id)
    .eq('status', 'pending_approval')
    .limit(10);

  if (error) throw error;

  for (const proposal of (proposals ?? []) as ProposalRow[]) {
    await notifySlackApproval({ supabase, proposal });
  }

  const { data: approved, error: approvalError } = await supabase
    .from('seo_proposals')
    .select('id,version,payload_hash,action,rationale,payload,seo_approvals(id,proposal_payload_hash,proposal_version,status)')
    .eq('run_id', run.id)
    .eq('status', 'approved')
    .limit(1);

  if (approvalError) throw approvalError;

  if (approved?.length) {
    await updateRun(supabase, run.id, {
      status: 'executing',
      current_step: 'execute',
      next_action_at: new Date().toISOString(),
    });
    return {
      status: 'pending_approval',
      runId: run.id,
      message: '承認済みproposalを検出し、次tickでexecuteへ進みます',
    };
  }

  return {
    status: 'pending_approval',
    runId: run.id,
    message: 'Slack承認待ちです',
  };
}

async function handleExecute(
  supabase: SupabaseClient,
  run: SeoLoopRun
): Promise<SeoLoopStepResult> {
  const { data, error } = await supabase
    .from('seo_proposals')
    .select('id,version,payload_hash,action,rationale,payload,seo_approvals(id,proposal_payload_hash,proposal_version,status)')
    .eq('run_id', run.id)
    .eq('status', 'approved')
    .limit(5);

  if (error) throw error;

  const proposals = (data ?? []) as ApprovedProposalRow[];
  if (proposals.length === 0) {
    await updateRun(supabase, run.id, {
      status: 'completed',
      current_step: 'execute',
      completed_at: new Date().toISOString(),
    });
    return { status: 'skipped', runId: run.id, message: '実行対象の承認済みproposalがありません' };
  }

  for (const proposal of proposals) {
    const approval = proposal.seo_approvals.find(
      (item) =>
        item.status === 'approved' &&
        item.proposal_version === proposal.version &&
        item.proposal_payload_hash === proposal.payload_hash
    );

    if (!approval) {
      const { error: blockError } = await supabase
        .from('seo_proposals')
        .update({ status: 'execution_blocked' })
        .eq('id', proposal.id);
      if (blockError) throw blockError;
      continue;
    }

    const actualHash = payloadHash(proposal.payload);
    const result = await executeApprovedProposal({
      supabase,
      config: getSeoLoopConfig(),
      proposalId: proposal.id,
      approvalId: approval.id,
      payload: proposal.payload,
      expectedHash: approval.proposal_payload_hash,
      actualHash,
    });

    const executionKey = `proposal:${proposal.id}:v${proposal.version}:${proposal.payload_hash}`;
    const { error: experimentError } = await supabase.from('seo_experiments').upsert(
      {
        proposal_id: proposal.id,
        approval_id: approval.id,
        execution_key: executionKey,
        status: result.executed ? 'executed' : 'blocked',
        action: proposal.action,
        baseline_metrics: { phase1_message: result.message },
        executed_at: result.executed ? new Date().toISOString() : null,
      },
      { onConflict: 'execution_key' }
    );
    if (experimentError) throw experimentError;

    const { error: proposalUpdateError } = await supabase
      .from('seo_proposals')
      .update({ status: result.executed ? 'executed' : 'execution_blocked' })
      .eq('id', proposal.id);
    if (proposalUpdateError) throw proposalUpdateError;
  }

  await updateRun(supabase, run.id, {
    status: 'completed',
    current_step: 'execute',
    completed_at: new Date().toISOString(),
  });

  return { status: 'executed', runId: run.id, message: '承認済みproposalの実行ゲート処理が完了しました' };
}

async function processLockedRun(
  supabase: SupabaseClient,
  run: SeoLoopRun
): Promise<SeoLoopStepResult> {
  const config = getSeoLoopConfig();

  if (run.status === 'completed' || run.status === 'failed' || run.status === 'skipped') {
    return { status: 'skipped', runId: run.id, message: `runは既に${run.status}です` };
  }

  if (run.status === 'observing') {
    const result = await observeGscIssues({ supabase, runId: run.id, config });
    return { status: 'observed', runId: run.id, message: result.message };
  }

  if (run.status === 'analyzing') {
    const result = await analyzeIssuesToProposals({ supabase, runId: run.id, config });
    return { status: 'analyzed', runId: run.id, message: result.message };
  }

  if (run.status === 'pending_approval') {
    return handlePendingApproval(supabase, run);
  }

  if (run.status === 'executing') {
    return handleExecute(supabase, run);
  }

  return { status: 'skipped', runId: run.id, message: `未対応statusです: ${run.status}` };
}

export async function runSeoLoopTick(): Promise<SeoLoopStepResult> {
  const config = getSeoLoopConfig();
  if (!config.enabled) {
    return { status: 'disabled', message: 'SEO_LOOP_ENABLED=false のためSEO Loopを実行しません' };
  }

  const supabase = createAdminSupabaseClient();
  const run = await createOrLoadRun(supabase, dailyRunKey());
  const lockedBy = `vercel:${process.pid}:${Date.now()}`;
  const locked = await acquireRunLock({
    supabase,
    runId: run.id,
    config,
    lockedBy,
  });

  if (!locked) {
    return { status: 'locked', runId: run.id, message: '別Functionが同じrunを処理中です' };
  }

  try {
    return await processLockedRun(supabase, locked);
  } catch (error) {
    await updateRun(supabase, run.id, {
      status: run.retry_count + 1 >= run.max_retries ? 'failed' : run.status,
      retry_count: run.retry_count + 1,
      error_message: error instanceof Error ? error.message : String(error),
      next_action_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });
    return {
      status: 'failed',
      runId: run.id,
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await releaseRunLock(supabase, run.id);
  }
}
