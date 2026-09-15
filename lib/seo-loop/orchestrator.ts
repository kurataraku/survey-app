import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { getSeoLoopConfig } from './config';
import { executeApprovedProposal } from './executor';
import { payloadHash } from './hash';
import { acquireRunLock, createOrLoadRun, dailyRunKey, releaseRunLock } from './lock';
import { analyzeIssuesToProposals, countOpenIssues } from './analyzer';
import { remainingDailyProposalBudget } from './limits';
import { observeGscIssues, replenishGscIssues } from './observer';
import { isWithinSeoLoopReplenishWindow } from './schedule';
import {
  notifySlackApproval,
  notifySlackLoopStatus,
  notifySlackRolloutPromotion,
} from './slack';
import {
  findNextRevisionRunId,
  hasPendingRevisionForRun,
  reviseRequestedProposal,
} from './revision/service';
import {
  isRulebookBindingConflict,
  loadRulebookForRun,
} from './rulebook/runtime';
import { processRulePatchLearning } from './rulebook/learning';
import {
  evaluateProposalWithShadow,
  refreshShadowRolloutMetrics,
} from './rollout/service';
import {
  evaluateProposalForApproval,
  shouldSendProposalToSlack,
  type ProposalForEvaluation,
} from './evaluation/evaluate';
import type { SeoLoopRun, SeoLoopStepResult } from './types';

const MAX_STEPS_PER_TICK = 8;
const MAX_RUNS_PER_TICK = 3;
/**
 * Function maxDuration(300s)とrun lock TTL(既定240s)より手前で
 * 新しいLLMステップを始めないための時間予算。超えた分の課題はopenのまま次tickで続ける。
 */
const TICK_TIME_BUDGET_MS = 180_000;

class RetryableSeoLoopError extends Error {}

type ProposalRow = {
  id: string;
  run_id: string;
  version: number;
  payload_hash: string;
  action: string;
  rationale: string | null;
  payload: unknown;
  context_snapshot: unknown;
  parent_proposal_id: string | null;
  revision_number: number;
  rulebook_version?: number;
  rulebook_hash?: string;
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

async function loadRun(supabase: SupabaseClient, runId: string): Promise<SeoLoopRun> {
  const { data, error } = await supabase
    .from('seo_loop_runs')
    .select('id,idempotency_key,status,retry_count,max_retries')
    .eq('id', runId)
    .single();

  if (error) throw error;
  return data as SeoLoopRun;
}

async function countApprovedProposals(supabase: SupabaseClient, runId: string): Promise<number> {
  const { count, error } = await supabase
    .from('seo_proposals')
    .select('id', { count: 'exact', head: true })
    .eq('run_id', runId)
    .eq('status', 'approved');

  if (error) throw error;
  return count ?? 0;
}

async function hasUnnotifiedPendingProposal(
  supabase: SupabaseClient,
  runId: string
): Promise<boolean> {
  const { data: proposals, error: proposalError } = await supabase
    .from('seo_proposals')
    .select('id,version,payload_hash')
    .eq('run_id', runId)
    .eq('status', 'pending_approval')
    .limit(20);
  if (proposalError) throw proposalError;
  const ids = (proposals ?? []).map((proposal) => proposal.id as string);
  if (ids.length === 0) return false;

  const { data: approvals, error: approvalError } = await supabase
    .from('seo_approvals')
    .select('proposal_id,proposal_version,proposal_payload_hash,status,slack_message_ts')
    .in('proposal_id', ids);
  if (approvalError) throw approvalError;
  const notified = new Set(
    (approvals ?? [])
      .filter(
        (approval) =>
          Boolean(approval.slack_message_ts) ||
          (approval.status !== 'pending' && approval.status !== undefined)
      )
      .map(
        (approval) =>
          `${approval.proposal_id}:${approval.proposal_version}:${approval.proposal_payload_hash}`
      )
  );
  return (proposals ?? []).some(
    (proposal) =>
      !notified.has(`${proposal.id}:${proposal.version}:${proposal.payload_hash}`)
  );
}

/**
 * 日次Cronは1回なので、未完了runを優先して再開する。
 * 人間承認待ちのみのrunはスキップし、当日runの新規観測を妨げない。
 */
async function selectRunnableRun(
  supabase: SupabaseClient,
  excludedRunIds: ReadonlySet<string> = new Set(),
  allowRevision = true
): Promise<SeoLoopRun> {
  if (allowRevision) {
    const revisionRunId = await findNextRevisionRunId({
      supabase,
      excludedRunIds,
    });
    if (revisionRunId) return loadRun(supabase, revisionRunId);
  }

  const { data: openRuns, error } = await supabase
    .from('seo_loop_runs')
    .select('id,idempotency_key,status,retry_count,max_retries')
    .in('status', ['observing', 'analyzing', 'revising', 'pending_approval', 'executing'])
    .order('created_at', { ascending: true })
    .limit(20);

  if (error) throw error;

  for (const candidate of (openRuns ?? []) as SeoLoopRun[]) {
    if (excludedRunIds.has(candidate.id)) continue;
    if (
      candidate.status === 'observing' ||
      candidate.status === 'analyzing' ||
      candidate.status === 'revising' ||
      candidate.status === 'executing'
    ) {
      return candidate;
    }

    if (candidate.status === 'pending_approval') {
      const approvedCount = await countApprovedProposals(supabase, candidate.id);
      if (
        approvedCount > 0 ||
        (await hasUnnotifiedPendingProposal(supabase, candidate.id))
      ) {
        return candidate;
      }
    }
  }

  return createOrLoadRun(supabase, dailyRunKey());
}

/**
 * Slack通知まで終えたあと、未分析課題と当日予算が残っていれば同じrunで分析へ戻す。
 * 課題が尽きても 9〜18時（JST）で予算が残っていれば、未処理ページのGSC候補を補充する。
 */
async function resumeAnalysisIfPossible(
  supabase: SupabaseClient,
  run: SeoLoopRun,
  config: ReturnType<typeof getSeoLoopConfig>,
  _deadlineAt: number
): Promise<{ resumed: boolean; replenished: number; message?: string }> {
  void _deadlineAt;
  const budget = await remainingDailyProposalBudget(supabase, config);
  if (budget <= 0) return { resumed: false, replenished: 0 };

  let openIssues = await countOpenIssues(supabase, run.id);
  let replenished = 0;
  let replenishMessage: string | undefined;
  if (openIssues === 0) {
    if (!isWithinSeoLoopReplenishWindow()) {
      return { resumed: false, replenished: 0 };
    }
    const replenish = await replenishGscIssues({
      supabase,
      runId: run.id,
      config,
    });
    replenished = replenish.issueCount;
    replenishMessage = replenish.message;
    if (replenished <= 0) return { resumed: false, replenished: 0, message: replenishMessage };
    openIssues = replenished;
  }

  await updateRun(supabase, run.id, {
    status: 'analyzing',
    current_step: 'analyze',
    completed_at: null,
    next_action_at: new Date().toISOString(),
  });
  return { resumed: openIssues > 0, replenished, message: replenishMessage };
}

async function handlePendingApproval(
  supabase: SupabaseClient,
  run: SeoLoopRun,
  deadlineAt: number
): Promise<SeoLoopStepResult> {
  const { data: proposals, error } = await supabase
    .from('seo_proposals')
    .select('id,run_id,version,payload_hash,action,rationale,payload,context_snapshot,parent_proposal_id,revision_number,rulebook_version,rulebook_hash')
    .eq('run_id', run.id)
    .eq('status', 'pending_approval')
    .limit(10);

  if (error) throw error;

  const config = getSeoLoopConfig();
  let blockedCount = 0;
  let blockedRevisionCount = 0;
  let retryableCount = 0;
  for (const proposal of (proposals ?? []) as ProposalRow[]) {
    let evaluation;
    try {
      evaluation = await evaluateProposalWithShadow({
        supabase,
        config,
        proposal: proposal as ProposalForEvaluation,
      });
    } catch (shadowError) {
      console.error('SEO Rulebook shadow evaluation failed; main continues', {
        proposalId: proposal.id,
        message:
          shadowError instanceof Error
            ? shadowError.message
            : String(shadowError),
      });
      evaluation = await evaluateProposalForApproval({
        supabase,
        config,
        proposal: proposal as ProposalForEvaluation,
      });
    }
    if (evaluation.retryable) {
      retryableCount += 1;
      continue;
    }
    if (!shouldSendProposalToSlack(evaluation)) {
      const { error: blockError } = await supabase
        .from('seo_proposals')
        .update({ status: 'quality_blocked', risk_level: evaluation.riskLevel })
        .eq('id', proposal.id)
        .eq('version', proposal.version)
        .eq('payload_hash', proposal.payload_hash)
        .eq('status', 'pending_approval');
      if (blockError) throw blockError;

      const { error: approvalError } = await supabase
        .from('seo_approvals')
        .update({ status: 'invalidated' })
        .eq('proposal_id', proposal.id)
        .eq('status', 'pending');
      if (approvalError) throw approvalError;
      blockedCount += 1;
      if (proposal.parent_proposal_id) blockedRevisionCount += 1;
      continue;
    }

    const { error: riskUpdateError } = await supabase
      .from('seo_proposals')
      .update({ risk_level: evaluation.riskLevel })
      .eq('id', proposal.id)
      .eq('version', proposal.version)
      .eq('payload_hash', proposal.payload_hash)
      .eq('status', 'pending_approval');
    if (riskUpdateError) throw riskUpdateError;
    await notifySlackApproval({ supabase, proposal, evaluation });
  }

  if (blockedRevisionCount > 0) {
    await notifySlackLoopStatus({
      text: `SEO改訂proposal ${blockedRevisionCount}件が品質ゲート不合格となり、再承認通知を停止しました。評価理由はseo_proposal_evaluationsを確認してください。`,
    }).catch(() => undefined);
  }

  const approvedCount = await countApprovedProposals(supabase, run.id);
  if (approvedCount > 0) {
    await updateRun(supabase, run.id, {
      status: 'executing',
      current_step: 'execute',
      next_action_at: new Date().toISOString(),
    });
    return {
      status: 'pending_approval',
      runId: run.id,
      message: '承認済みproposalを検出したのでexecuteへ進みます',
    };
  }

  const { count: pendingCount, error: pendingError } = await supabase
    .from('seo_proposals')
    .select('id', { count: 'exact', head: true })
    .eq('run_id', run.id)
    .eq('status', 'pending_approval');
  if (pendingError) throw pendingError;
  if ((pendingCount ?? 0) === 0) {
    const resumed = await resumeAnalysisIfPossible(supabase, run, config, deadlineAt);
    if (resumed.resumed) {
      return {
        status: 'analyzed',
        runId: run.id,
        message:
          resumed.replenished > 0
            ? `${blockedCount}件が品質ゲート不合格のため、GSC課題を${resumed.replenished}件補充して分析を続けます`
            : `${blockedCount}件が品質ゲート不合格のため、残りの課題分析を続けます`,
      };
    }
    await updateRun(supabase, run.id, {
      status: 'completed',
      current_step: 'evaluate',
      completed_at: new Date().toISOString(),
    });
    return {
      status: 'skipped',
      runId: run.id,
      message: `${blockedCount}件が品質ゲート不合格となり、Slack送信を停止しました`,
    };
  }

  if (retryableCount > 0) {
    await notifySlackLoopStatus({
      text: `SEO品質評価を再試行します: ${retryableCount}件でFact Contextの再取得に失敗しました。変更・承認通知は行っていません。`,
    }).catch(() => undefined);
    return {
      status: 'pending_approval',
      runId: run.id,
      message: `${retryableCount}件は一時的な観測失敗のため再評価待ちです`,
    };
  }

  const resumed = await resumeAnalysisIfPossible(supabase, run, config, deadlineAt);
  if (resumed.resumed) {
    return {
      status: 'analyzed',
      runId: run.id,
      message:
        resumed.replenished > 0
          ? `Slack通知後、GSC課題を${resumed.replenished}件補充して分析を続けます`
          : 'Slack通知後、残りの課題分析を続けます',
    };
  }

  return {
    status: 'pending_approval',
    runId: run.id,
    message: 'Slack承認待ちです',
  };
}

/**
 * execute後にrunを閉じるか、残り課題の分析へ戻すかを決める。
 * 承認1件で当日runがcompletedになり、毎時tickが止まるのを防ぐ。
 * 課題が尽きても補充ウィンドウ内かつ予算があればanalyzingへ戻し、次tickでGSC補充する。
 */
export function nextRunStateAfterExecute(params: {
  remainingPending: number;
  openIssues: number;
  remainingBudget: number;
  canReplenish?: boolean;
}): 'pending_approval' | 'analyzing' | 'completed' {
  if (params.remainingPending > 0) return 'pending_approval';
  // 時間切れでも completed にしない。analyzing のまま残せば次の毎時tickが再開できる。
  if (params.openIssues > 0 && params.remainingBudget > 0) return 'analyzing';
  if (
    params.openIssues === 0 &&
    params.remainingBudget > 0 &&
    params.canReplenish
  ) {
    return 'analyzing';
  }
  return 'completed';
}

async function finishAfterExecute(params: {
  supabase: SupabaseClient;
  run: SeoLoopRun;
  config: ReturnType<typeof getSeoLoopConfig>;
  deadlineAt: number;
  processedApproved: boolean;
}): Promise<SeoLoopStepResult> {
  const { count: remainingPending, error: remainingError } = await params.supabase
    .from('seo_proposals')
    .select('id', { count: 'exact', head: true })
    .eq('run_id', params.run.id)
    .eq('status', 'pending_approval');
  if (remainingError) throw remainingError;

  const openIssues = await countOpenIssues(params.supabase, params.run.id);
  const remainingBudget = await remainingDailyProposalBudget(
    params.supabase,
    params.config
  );
  const nextState = nextRunStateAfterExecute({
    remainingPending: remainingPending ?? 0,
    openIssues,
    remainingBudget,
    canReplenish: isWithinSeoLoopReplenishWindow(),
  });

  if (nextState === 'pending_approval') {
    await updateRun(params.supabase, params.run.id, {
      status: 'pending_approval',
      current_step: 'approval',
      completed_at: null,
      next_action_at: new Date().toISOString(),
    });
    return {
      status: 'executed',
      runId: params.run.id,
      message: params.processedApproved
        ? '承認済みproposalの実行ゲート処理が完了し、残りの承認待ちへ戻ります'
        : '実行対象の承認済みproposalはありません。残りの承認待ちへ戻ります',
    };
  }

  if (nextState === 'analyzing') {
    const resumed = await resumeAnalysisIfPossible(
      params.supabase,
      params.run,
      params.config,
      params.deadlineAt
    );
    if (resumed.resumed) {
      return {
        status: 'analyzed',
        runId: params.run.id,
        message:
          resumed.replenished > 0
            ? params.processedApproved
              ? `承認済みproposalの実行ゲート処理が完了し、GSC課題を${resumed.replenished}件補充して分析を続けます`
              : `実行対象の承認済みproposalがないため、GSC課題を${resumed.replenished}件補充して分析を続けます`
            : params.processedApproved
              ? '承認済みproposalの実行ゲート処理が完了し、残りの課題分析を続けます'
              : '実行対象の承認済みproposalがないため、残りの課題分析を続けます',
      };
    }
  }

  await updateRun(params.supabase, params.run.id, {
    status: 'completed',
    current_step: 'execute',
    completed_at: new Date().toISOString(),
  });
  return {
    status: params.processedApproved ? 'executed' : 'skipped',
    runId: params.run.id,
    message: params.processedApproved
      ? '承認済みproposalの実行ゲート処理が完了しました'
      : '実行対象の承認済みproposalがありません',
  };
}

async function handleExecute(
  supabase: SupabaseClient,
  run: SeoLoopRun,
  deadlineAt: number
): Promise<SeoLoopStepResult> {
  const config = getSeoLoopConfig();
  const { data, error } = await supabase
    .from('seo_proposals')
    .select('id,run_id,version,payload_hash,action,rationale,payload,context_snapshot,parent_proposal_id,revision_number,seo_approvals(id,proposal_payload_hash,proposal_version,status)')
    .eq('run_id', run.id)
    .eq('status', 'approved')
    .limit(5);

  if (error) throw error;

  const proposals = (data ?? []) as ApprovedProposalRow[];
  if (proposals.length === 0) {
    return finishAfterExecute({
      supabase,
      run,
      config,
      deadlineAt,
      processedApproved: false,
    });
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

    const executionEvaluation = await evaluateProposalForApproval({
      supabase,
      config,
      proposal: proposal as ProposalForEvaluation,
      forceFresh: true,
      phase: 'execution',
    });
    if (executionEvaluation.retryable) {
      throw new RetryableSeoLoopError(
        '実行直前のFact Context再取得に失敗したため、実行を延期します'
      );
    }
    if (!shouldSendProposalToSlack(executionEvaluation)) {
      const { error: evaluationBlockError } = await supabase
        .from('seo_proposals')
        .update({ status: 'execution_blocked', risk_level: 'blocked' })
        .eq('id', proposal.id)
        .eq('version', proposal.version)
        .eq('payload_hash', proposal.payload_hash);
      if (evaluationBlockError) throw evaluationBlockError;
      const { error: invalidateError } = await supabase
        .from('seo_approvals')
        .update({ status: 'invalidated' })
        .eq('id', approval.id)
        .eq('status', 'approved');
      if (invalidateError) throw invalidateError;
      continue;
    }

    const actualHash = payloadHash(proposal.payload);
    const result = await executeApprovedProposal({
      supabase,
      config,
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

  return finishAfterExecute({
    supabase,
    run,
    config,
    deadlineAt,
    processedApproved: true,
  });
}

async function processOneStep(
  supabase: SupabaseClient,
  run: SeoLoopRun,
  deadlineAt: number
): Promise<SeoLoopStepResult> {
  const config = getSeoLoopConfig();

  if (run.status === 'failed' || run.status === 'skipped') {
    return { status: 'skipped', runId: run.id, message: `runは既に${run.status}です` };
  }

  if (run.status === 'completed') {
    const resumed = await resumeAnalysisIfPossible(supabase, run, config, deadlineAt);
    if (!resumed.resumed) {
      return {
        status: 'skipped',
        runId: run.id,
        message: resumed.message
          ? `runは既にcompletedです（${resumed.message}）`
          : 'runは既にcompletedです',
      };
    }
    return {
      status: 'analyzed',
      runId: run.id,
      message:
        resumed.replenished > 0
          ? `completed runを再開し、GSC課題を${resumed.replenished}件補充しました`
          : 'completed runを再開し、残りの課題分析を続けます',
    };
  }

  if (run.status === 'observing') {
    const result = await observeGscIssues({ supabase, runId: run.id, config });
    return { status: 'observed', runId: run.id, message: result.message };
  }

  if (run.status === 'analyzing') {
    const result = await analyzeIssuesToProposals({
      supabase,
      runId: run.id,
      config,
      deadlineAt,
    });
    return { status: 'analyzed', runId: run.id, message: result.message };
  }

  if (run.status === 'revising') {
    const result = await reviseRequestedProposal({
      supabase,
      runId: run.id,
      config,
    });
    if ((result.outcome === 'failed' || result.outcome === 'abandoned') && result.notify) {
      await notifySlackLoopStatus({
        text: `SEO改訂proposalを${result.outcome === 'abandoned' ? '打ち切りました' : '生成できませんでした'}。\nrun: \`${run.idempotency_key}\`\n${result.message}`,
      }).catch(() => undefined);
    }
    return { status: 'analyzed', runId: run.id, message: result.message };
  }

  if (run.status === 'pending_approval') {
    return handlePendingApproval(supabase, run, deadlineAt);
  }

  if (run.status === 'executing') {
    return handleExecute(supabase, run, deadlineAt);
  }

  return { status: 'skipped', runId: run.id, message: `未対応statusです: ${run.status}` };
}

function isTerminalStatus(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'skipped';
}

/**
 * 1回のCron呼び出しで、待機状態か完了までステップを連続実行する。
 * 人間承認待ち（pending_approval かつ approvedなし）で停止する。
 */
async function advanceRunUntilIdle(
  supabase: SupabaseClient,
  initialRun: SeoLoopRun,
  deadlineAt: number
): Promise<SeoLoopStepResult> {
  const messages: string[] = [];
  let last: SeoLoopStepResult = {
    status: 'skipped',
    runId: initialRun.id,
    message: 'ステップ未実行',
  };

  for (let step = 0; step < MAX_STEPS_PER_TICK; step += 1) {
    const run = await loadRun(supabase, initialRun.id);

    // completed の初回だけは補充再開を試す。途中でcompletedになったら止める。
    const allowCompletedReopen = step === 0 && run.status === 'completed';
    if (isTerminalStatus(run.status) && !allowCompletedReopen) {
      if (messages.length === 0) {
        return { status: 'skipped', runId: run.id, message: `runは既に${run.status}です` };
      }
      break;
    }

    if (step > 0 && Date.now() >= deadlineAt) {
      messages.push('実行時間上限に達したため、残りは次回tickで続けます');
      break;
    }

    last = await processOneStep(supabase, run, deadlineAt);
    messages.push(last.message);

    const after = await loadRun(supabase, run.id);

    if (isTerminalStatus(after.status)) {
      break;
    }

    if (after.status === 'pending_approval') {
      const approvedCount = await countApprovedProposals(supabase, after.id);
      if (approvedCount === 0) {
        // 新規・改訂proposalの生成直後は、同tick内で品質評価とSlack通知まで進める。
        if (last.status === 'analyzed') continue;
        last = {
          status: 'pending_approval',
          runId: after.id,
          message: messages.join(' → '),
        };
        return last;
      }
      // 承認済みがある場合は同tickでexecuteへ続く
      continue;
    }
  }

  return {
    ...last,
    message: messages.length > 0 ? messages.join(' → ') : last.message,
  };
}

export async function runSeoLoopTick(): Promise<SeoLoopStepResult> {
  const config = getSeoLoopConfig();
  if (!config.enabled) {
    return { status: 'disabled', message: 'SEO_LOOP_ENABLED=false のためSEO Loopを実行しません' };
  }

  const supabase = createAdminSupabaseClient();
  const refreshRollout = async (): Promise<void> => {
    try {
      const ready = await refreshShadowRolloutMetrics(supabase, config);
      if (ready) {
        await notifySlackRolloutPromotion({
          supabase,
          rollout: ready,
        });
      }
    } catch (error) {
      console.error('SEO Rulebook shadow metrics failed; main continues', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };
  await refreshRollout();
  try {
    const learning = await processRulePatchLearning(supabase);
    if (learning.generated > 0 || learning.notified > 0) {
      await notifySlackLoopStatus({ text: learning.message }).catch(
        () => undefined
      );
    }
  } catch (error) {
    await notifySlackLoopStatus({
      text: `SEO Rule Patch処理を安全停止しました。通常のSEO Loopは継続します。\n${
        error instanceof Error ? error.message : String(error)
      }`,
    }).catch(() => undefined);
  }
  const todayKey = dailyRunKey();
  const deadlineAt = Date.now() + TICK_TIME_BUDGET_MS;
  const results: SeoLoopStepResult[] = [];
  const processedIds = new Set<string>();
  let revisionRunsProcessed = 0;

  for (let i = 0; i < MAX_RUNS_PER_TICK; i += 1) {
    if (i > 0 && Date.now() >= deadlineAt) break;
    const allowRevision = revisionRunsProcessed < 2;
    const run = await selectRunnableRun(supabase, processedIds, allowRevision);
    if (processedIds.has(run.id)) {
      break;
    }

    const lockedBy = `vercel:${process.pid}:${Date.now()}:${i}`;
    const locked = await acquireRunLock({
      supabase,
      runId: run.id,
      config,
      lockedBy,
    });

    if (!locked) {
      results.push({ status: 'locked', runId: run.id, message: '別Functionが同じrunを処理中です' });
      break;
    }

    processedIds.add(run.id);

    try {
      const boundRulebook = await loadRulebookForRun({
        supabase,
        runId: run.id,
      });
      if (boundRulebook.source === 'fallback') {
        await notifySlackLoopStatus({
          text: `SEO RulebookをDBから固定できなかったため、安全なコード内fallbackを使用します。\nrun: \`${run.idempotency_key}\`\nhash: \`${boundRulebook.contentHash}\``,
        }).catch(() => undefined);
      }
      if (
        allowRevision &&
        run.status !== 'failed' &&
        run.status !== 'skipped' &&
        run.retry_count < run.max_retries &&
        (await hasPendingRevisionForRun(supabase, run.id))
      ) {
        revisionRunsProcessed += 1;
        await updateRun(supabase, run.id, {
          status: 'revising',
          current_step: 'revise',
          completed_at: null,
          next_action_at: new Date().toISOString(),
        });
      }
      const result = await advanceRunUntilIdle(supabase, locked, deadlineAt);
      results.push(result);
    } catch (error) {
      const current = await loadRun(supabase, run.id).catch(() => run);
      if (
        error instanceof RetryableSeoLoopError ||
        isRulebookBindingConflict(error)
      ) {
        const message =
          error instanceof Error
            ? error.message
            : 'run固定Rulebookとの不一致を検出したため再試行します';
        await updateRun(supabase, run.id, {
          status: current.status,
          retry_count: current.retry_count,
          error_message: message,
          next_action_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        });
        results.push({ status: 'skipped', runId: run.id, message });
        continue;
      }
      await updateRun(supabase, run.id, {
        status: current.retry_count + 1 >= current.max_retries ? 'failed' : current.status,
        retry_count: current.retry_count + 1,
        error_message: error instanceof Error ? error.message : String(error),
        next_action_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
      const failed: SeoLoopStepResult = {
        status: 'failed',
        runId: run.id,
        message: error instanceof Error ? error.message : String(error),
      };
      results.push(failed);
      await notifySlackLoopStatus({
        text: `*SEO Loop 失敗*\nrun: \`${run.idempotency_key}\`\n${failed.message}`,
      }).catch(() => undefined);
      break;
    } finally {
      await releaseRunLock(supabase, run.id);
    }

    // 当日runまで処理したら終了。古い承認済みの消化後に当日観測へ進める。
    if (run.idempotency_key === todayKey) {
      break;
    }
  }

  if (results.length === 0) {
    await refreshRollout();
    return { status: 'skipped', message: '処理対象のrunがありません' };
  }

  const mergedMessage = results.map((r) => r.message).join(' | ');
  const last = results[results.length - 1]!;
  const noProposal = results.some((r) => r.message.includes('承認対象proposalは生成されませんでした'));
  const hadApprovalWait = results.some((r) => r.status === 'pending_approval');

  if (noProposal && !hadApprovalWait) {
    await notifySlackLoopStatus({
      text: `*SEO Loop 実行結果*\n提案カードはありませんでした。\n\`${mergedMessage}\``,
    }).catch(() => undefined);
  }
  await refreshRollout();

  return {
    ...last,
    message: mergedMessage,
  };
}
