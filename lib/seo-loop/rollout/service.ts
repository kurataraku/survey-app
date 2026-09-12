import type { SupabaseClient } from '@supabase/supabase-js';
import type { SeoLoopConfig } from '../config';
import { collectFactContext } from '../context/collector';
import {
  factContextSnapshotSchema,
  type FactContextSnapshot,
} from '../context/types';
import {
  evaluateProposalForApproval,
  shouldSendProposalToSlack,
  type ProposalForEvaluation,
} from '../evaluation/evaluate';
import type { ProposalEvaluationResult } from '../evaluation/types';
import { payloadHash } from '../hash';
import {
  isRulebookSchemaUnavailable,
  type BoundRulebook,
} from '../rulebook/runtime';
import { rulebookContentSchema } from '../rulebook/schema';
import { proposalPayloadV2Schema } from '../types';
import {
  calculateRolloutMetrics,
  type ObservedDecision,
  type ShadowObservation,
} from './metrics';

type RolloutRow = {
  id: string;
  candidate_id: string;
  candidate_version: number;
  patch_hash: string;
  base_rulebook_version_id: string;
  base_rulebook_version: number;
  base_rulebook_hash: string;
  shadow_content: unknown;
  shadow_content_hash: string;
  status: 'shadowing' | 'ready';
  started_at: string;
  slack_message_ts: string | null;
  notify_attempted_at?: string | null;
  metrics?: ReturnType<typeof calculateRolloutMetrics>;
};

export type ReadyRollout = RolloutRow & {
  metrics: ReturnType<typeof calculateRolloutMetrics>;
};

function rolloutSchemaUnavailable(error: unknown): boolean {
  return isRulebookSchemaUnavailable(error);
}

async function loadShadowingRollout(
  supabase: SupabaseClient
): Promise<RolloutRow | null> {
  const { data, error } = await supabase
    .from('seo_rulebook_rollouts')
    .select(
      'id,candidate_id,candidate_version,patch_hash,base_rulebook_version_id,base_rulebook_version,base_rulebook_hash,shadow_content,shadow_content_hash,status,started_at,slack_message_ts'
    )
    .eq('status', 'shadowing')
    .order('started_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (rolloutSchemaUnavailable(error)) return null;
    throw error;
  }
  return (data as RolloutRow | null) ?? null;
}

async function loadReadyRollout(
  supabase: SupabaseClient
): Promise<ReadyRollout | null> {
  const { data, error } = await supabase
    .from('seo_rulebook_rollouts')
    .select(
      'id,candidate_id,candidate_version,patch_hash,base_rulebook_version_id,base_rulebook_version,base_rulebook_hash,shadow_content,shadow_content_hash,status,started_at,slack_message_ts,notify_attempted_at,metrics'
    )
    .eq('status', 'ready')
    .is('slack_message_ts', null)
    .order('started_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (rolloutSchemaUnavailable(error)) return null;
    throw error;
  }
  const rollout = data as RolloutRow | null;
  if (!rollout?.metrics?.eligible) return null;
  const attemptedAt = rollout.notify_attempted_at
    ? Date.parse(rollout.notify_attempted_at)
    : Number.NaN;
  if (
    Number.isFinite(attemptedAt) &&
    attemptedAt > Date.now() - 15 * 60 * 1000
  ) {
    return null;
  }
  if (rollout.notify_attempted_at) {
    const staleAttempt = rollout.notify_attempted_at;
    const { data: reset, error: resetError } = await supabase
      .from('seo_rulebook_rollouts')
      .update({ notify_attempted_at: null })
      .eq('id', rollout.id)
      .eq('status', 'ready')
      .is('slack_message_ts', null)
      .eq('notify_attempted_at', staleAttempt)
      .select('id')
      .maybeSingle();
    if (resetError) throw resetError;
    if (!reset) return null;
    rollout.notify_attempted_at = null;
  }
  return rollout as ReadyRollout;
}

function boundShadowRulebook(rollout: RolloutRow): BoundRulebook | null {
  const parsed = rulebookContentSchema.safeParse(rollout.shadow_content);
  if (
    !parsed.success ||
    payloadHash(parsed.data) !== rollout.shadow_content_hash
  ) {
    return null;
  }
  return {
    source: 'database',
    versionId: null,
    version: rollout.base_rulebook_version + 1,
    contentHash: rollout.shadow_content_hash,
    content: parsed.data,
  };
}

export async function recordShadowEvaluation(params: {
  supabase: SupabaseClient;
  config: SeoLoopConfig;
  proposal: ProposalForEvaluation;
  mainEvaluation: ProposalEvaluationResult;
  freshContextOverride?: {
    context: FactContextSnapshot | null;
    warning: string | null;
  };
}): Promise<void> {
  if (!params.config.shadowRolloutEnabled) return;
  const rollout = await loadShadowingRollout(params.supabase);
  if (!rollout) return;

  // 比較する旧系はrollout開始時のactive版に固定する。別版にbind済みの
  // 古いrunやfallback runを混ぜると比較にならないため記録しない。
  if (
    params.proposal.rulebook_hash !== rollout.base_rulebook_hash ||
    params.proposal.rulebook_version !== rollout.base_rulebook_version
  ) {
    return;
  }
  const shadowRulebook = boundShadowRulebook(rollout);
  if (!shadowRulebook) {
    const completedAt = new Date().toISOString();
    const { error } = await params.supabase
      .from('seo_rulebook_rollouts')
      .update({
        status: 'failed',
        completed_at: completedAt,
      })
      .eq('id', rollout.id)
      .eq('status', 'shadowing');
    if (error) throw error;
    const { error: candidateError } = await params.supabase
      .from('seo_rule_patch_candidates')
      .update({ status: 'failed', updated_at: completedAt })
      .eq('id', rollout.candidate_id)
      .eq('status', 'shadowing');
    if (candidateError) throw candidateError;
    return;
  }

  const { data: existing, error: existingError } = await params.supabase
    .from('seo_rulebook_shadow_evaluations')
    .select('id')
    .eq('rollout_id', rollout.id)
    .eq('proposal_id', params.proposal.id)
    .eq('proposal_version', params.proposal.version)
    .eq('proposal_payload_hash', params.proposal.payload_hash)
    .maybeSingle();
  if (existingError) {
    if (rolloutSchemaUnavailable(existingError)) return;
    throw existingError;
  }
  if (existing) return;

  const shadowEvaluation = await evaluateProposalForApproval({
    supabase: params.supabase,
    config: params.config,
    proposal: params.proposal,
    forceFresh: true,
    rulebookOverride: shadowRulebook,
    persist: false,
    ignoreProposalRulebookStamp: true,
    freshContextOverride: params.freshContextOverride,
  });
  const { error } = await params.supabase
    .from('seo_rulebook_shadow_evaluations')
    .upsert(
      {
        rollout_id: rollout.id,
        run_id: params.proposal.run_id,
        proposal_id: params.proposal.id,
        proposal_version: params.proposal.version,
        proposal_payload_hash: params.proposal.payload_hash,
        main_rulebook_hash: rollout.base_rulebook_hash,
        shadow_rulebook_hash: rollout.shadow_content_hash,
        main_evaluation: params.mainEvaluation,
        shadow_evaluation: shadowEvaluation,
        main_retryable: params.mainEvaluation.retryable,
        shadow_retryable: shadowEvaluation.retryable,
        main_hard_gate_passed: params.mainEvaluation.hardGatePassed,
        shadow_hard_gate_passed: shadowEvaluation.hardGatePassed,
        main_would_send: shouldSendProposalToSlack(params.mainEvaluation),
        shadow_would_send: shouldSendProposalToSlack(shadowEvaluation),
      },
      {
        onConflict:
          'rollout_id,proposal_id,proposal_version,proposal_payload_hash',
        ignoreDuplicates: true,
      }
    );
  if (error && !rolloutSchemaUnavailable(error)) throw error;
}

export async function evaluateProposalWithShadow(params: {
  supabase: SupabaseClient;
  config: SeoLoopConfig;
  proposal: ProposalForEvaluation;
}): Promise<ProposalEvaluationResult> {
  const evaluateMain = (
    options: {
      forceFresh?: boolean;
      freshContextOverride?: {
        context: FactContextSnapshot | null;
        warning: string | null;
      };
    } = {}
  ) =>
    evaluateProposalForApproval({
      supabase: params.supabase,
      config: params.config,
      proposal: params.proposal,
      ...options,
    });
  if (!params.config.shadowRolloutEnabled) return evaluateMain();

  const rollout = await loadShadowingRollout(params.supabase);
  if (
    !rollout ||
    params.proposal.rulebook_hash !== rollout.base_rulebook_hash ||
    params.proposal.rulebook_version !== rollout.base_rulebook_version
  ) {
    return evaluateMain();
  }
  const { data: existing, error: existingError } = await params.supabase
    .from('seo_rulebook_shadow_evaluations')
    .select('id')
    .eq('rollout_id', rollout.id)
    .eq('proposal_id', params.proposal.id)
    .eq('proposal_version', params.proposal.version)
    .eq('proposal_payload_hash', params.proposal.payload_hash)
    .maybeSingle();
  if (existingError) {
    if (rolloutSchemaUnavailable(existingError)) return evaluateMain();
    throw existingError;
  }
  if (existing) return evaluateMain();

  const stored = factContextSnapshotSchema.safeParse(
    params.proposal.context_snapshot
  );
  let freshContextOverride: {
    context: FactContextSnapshot | null;
    warning: string | null;
  };
  if (!stored.success) {
    freshContextOverride = {
      context: null,
      warning: '保存済みFact Contextが不正です',
    };
  } else {
    try {
      freshContextOverride = {
        context: await collectFactContext({
          supabase: params.supabase,
          targetUrl: stored.data.target.url,
        }),
        warning: null,
      };
    } catch (error) {
      freshContextOverride = {
        context: null,
        warning: `最新Fact Contextを収集できません: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }
  const mainEvaluation = await evaluateMain({
    forceFresh: true,
    freshContextOverride,
  });
  await recordShadowEvaluation({
    ...params,
    mainEvaluation,
    freshContextOverride,
  });
  return mainEvaluation;
}

function decisionForProposal(
  proposalId: string,
  approvals: Array<{ proposal_id: string; status: string }>,
  feedback: Array<{
    proposal_id: string;
    decision: string;
    category: string;
  }>
): {
  decision: ObservedDecision;
  category: string | null;
} {
  const correction = feedback.find((row) => row.proposal_id === proposalId);
  if (
    correction?.decision === 'rejected' ||
    correction?.decision === 'revision_requested'
  ) {
    return {
      decision: correction.decision,
      category: correction.category,
    };
  }
  return approvals.some(
    (row) => row.proposal_id === proposalId && row.status === 'approved'
  )
    ? { decision: 'approved', category: null }
    : { decision: null, category: null };
}

function correctionTargetKey(payload: unknown): string | null {
  const parsed = proposalPayloadV2Schema.safeParse(payload);
  if (!parsed.success) return null;
  return parsed.data.targets
    .map((target) => `${target.type}:${target.id}`)
    .sort()
    .join('|');
}

export async function refreshShadowRolloutMetrics(
  supabase: SupabaseClient,
  config: SeoLoopConfig
): Promise<ReadyRollout | null> {
  if (!config.shadowRolloutEnabled) return null;
  const ready = await loadReadyRollout(supabase);
  if (ready) return ready;
  const rollout = await loadShadowingRollout(supabase);
  if (!rollout) return null;

  const { data: active, error: activeError } = await supabase
    .from('seo_rulebook_versions')
    .select('id,version,content_hash,status')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (activeError) throw activeError;
  if (
    !active ||
    active.id !== rollout.base_rulebook_version_id ||
    active.version !== rollout.base_rulebook_version ||
    active.content_hash !== rollout.base_rulebook_hash
  ) {
    const completedAt = new Date().toISOString();
    const { error: rolloutError } = await supabase
      .from('seo_rulebook_rollouts')
      .update({ status: 'superseded', completed_at: completedAt })
      .eq('id', rollout.id)
      .eq('status', 'shadowing');
    if (rolloutError) throw rolloutError;
    const { error: candidateError } = await supabase
      .from('seo_rule_patch_candidates')
      .update({ status: 'superseded', updated_at: completedAt })
      .eq('id', rollout.candidate_id)
      .eq('status', 'shadowing');
    if (candidateError) throw candidateError;
    return null;
  }

  const { data: runs, error: runError } = await supabase
    .from('seo_loop_runs')
    .select('id')
    .gte('created_at', rollout.started_at)
    .order('created_at', { ascending: true })
    .limit(100);
  if (runError) throw runError;
  const runIds = (runs ?? []).map((row) => row.id as string);
  if (runIds.length === 0) return null;

  const [
    { data: issues, error: issueError },
    { data: proposals, error: proposalError },
    { data: evaluations, error: evaluationError },
  ] = await Promise.all([
    supabase.from('seo_issues').select('id').in('run_id', runIds).limit(1000),
    supabase
      .from('seo_proposals')
      .select('id,run_id,action,payload,parent_proposal_id')
      .in('run_id', runIds)
      .limit(1000),
    supabase
      .from('seo_rulebook_shadow_evaluations')
      .select(
        'run_id,proposal_id,main_retryable,shadow_retryable,main_hard_gate_passed,shadow_hard_gate_passed,main_would_send,shadow_would_send'
      )
      .eq('rollout_id', rollout.id)
      .in('run_id', runIds)
      .limit(1000),
  ]);
  if (issueError) throw issueError;
  if (proposalError) throw proposalError;
  if (evaluationError) throw evaluationError;

  const proposalRows = (proposals ?? []) as Array<{
    id: string;
    run_id: string;
    action: string;
    payload: unknown;
    parent_proposal_id: string | null;
  }>;
  const proposalIds = proposalRows.map((row) => row.id);
  const [{ data: approvals, error: approvalError }, { data: feedback, error: feedbackError }] =
    proposalIds.length > 0
      ? await Promise.all([
          supabase
            .from('seo_approvals')
            .select('proposal_id,status')
            .in('proposal_id', proposalIds),
          supabase
            .from('seo_feedback')
            .select('proposal_id,decision,category')
            .in('proposal_id', proposalIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];
  if (approvalError) throw approvalError;
  if (feedbackError) throw feedbackError;

  const proposalById = new Map(
    proposalRows.map((proposal) => [proposal.id, proposal])
  );
  const observations: ShadowObservation[] = (
    (evaluations ?? []) as Array<{
      run_id: string;
      proposal_id: string;
      main_retryable: boolean;
      shadow_retryable: boolean;
      main_hard_gate_passed: boolean;
      shadow_hard_gate_passed: boolean;
      main_would_send: boolean;
      shadow_would_send: boolean;
    }>
  )
    .filter(
      (evaluation) =>
        !evaluation.main_retryable && !evaluation.shadow_retryable
    )
    .map((evaluation) => {
      const proposal = proposalById.get(evaluation.proposal_id);
      const observed = decisionForProposal(
        evaluation.proposal_id,
        (approvals ?? []) as Array<{ proposal_id: string; status: string }>,
        (feedback ?? []) as Array<{
          proposal_id: string;
          decision: string;
          category: string;
        }>
      );
      const targetKey = correctionTargetKey(proposal?.payload);
      return {
        runId: evaluation.run_id,
        proposalId: evaluation.proposal_id,
        mainHardGatePassed: evaluation.main_hard_gate_passed,
        shadowHardGatePassed: evaluation.shadow_hard_gate_passed,
        mainWouldSend: evaluation.main_would_send,
        shadowWouldSend: evaluation.shadow_would_send,
        decision: observed.decision,
        correctionKey:
          observed.category && proposal && targetKey
            ? `${proposal.action}:${targetKey}:${observed.category}`
            : null,
      };
    });
  const metrics = calculateRolloutMetrics({
    runCount: runIds.length,
    issueCount: (issues ?? []).length,
    mainProposalCount: proposalRows.filter(
      (proposal) => proposal.parent_proposal_id === null
    ).length,
    observations,
  });
  const now = new Date().toISOString();
  const { error: snapshotError } = await supabase
    .from('seo_rulebook_rollout_metric_snapshots')
    .upsert(
      {
        rollout_id: rollout.id,
        metrics_version: metrics.version,
        metrics,
        metrics_hash: metrics.metricsHash,
        idempotency_key: `rollout:${rollout.id}:${metrics.metricsHash}`,
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true }
    );
  if (snapshotError) throw snapshotError;

  const { data: updated, error: updateError } = await supabase
    .from('seo_rulebook_rollouts')
    .update({
      status: metrics.eligible ? 'ready' : 'shadowing',
      metrics_version: metrics.version,
      metrics,
      metrics_hash: metrics.metricsHash,
      run_count: metrics.samples.runs,
      evaluated_proposal_count: metrics.samples.evaluatedProposals,
      observed_decision_count: metrics.samples.mainObservedDecisions,
      ready_at: metrics.eligible ? now : null,
    })
    .eq('id', rollout.id)
    .eq('status', 'shadowing')
    .select(
      'id,candidate_id,candidate_version,patch_hash,base_rulebook_version_id,base_rulebook_version,base_rulebook_hash,shadow_content,shadow_content_hash,status,started_at,slack_message_ts'
    )
    .maybeSingle();
  if (updateError) throw updateError;
  return metrics.eligible && updated
    ? ({ ...(updated as RolloutRow), metrics } as ReadyRollout)
    : null;
}
