import type { SupabaseClient } from '@supabase/supabase-js';
import type { SeoLoopConfig } from '../config';
import { collectFactContext } from '../context/collector';
import {
  factContextSnapshotSchema,
  type FactContextSnapshot,
} from '../context/types';
import { determineRiskLevel } from '../risk-rules';
import { proposalPayloadV2Schema } from '../types';
import { runHardGate } from './hard-gate';
import { runSoftEval } from './soft-eval';
import type { ProposalEvaluationResult, SoftEvalResult } from './types';
import {
  effectiveActionValueLimits,
  effectiveRulebookLimits,
  loadRulebookForRun,
  isRulebookSchemaUnavailable,
  type BoundRulebook,
} from '../rulebook/runtime';
import { allRuleIds } from '../rulebook/schema';
import { FALLBACK_RULEBOOK } from '../rulebook/schema';

export const QUALITY_EVALUATION_VERSION = 'quality-v1';

export type ProposalForEvaluation = {
  id: string;
  run_id: string;
  version: number;
  payload_hash: string;
  action: string;
  payload: unknown;
  context_snapshot: unknown;
  rulebook_version?: number;
  rulebook_hash?: string;
};

function evaluationVersion(
  phase: 'approval' | 'execution',
  rulebook: BoundRulebook
): string {
  const base =
    phase === 'execution'
      ? `${QUALITY_EVALUATION_VERSION}-execution`
      : QUALITY_EVALUATION_VERSION;
  return `${base}@rb${rulebook.version}:${rulebook.contentHash.slice(0, 12)}`;
}

function normalizedTargetKey(type: string, id: string, urlValue: string): string {
  const url = new URL(urlValue);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return `${type}:${id}:${url.toString()}`;
}

function startOfUtcDay(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function emptySoftEval(): SoftEvalResult {
  return {
    version: 'soft-v1',
    dimensions: {
      evidence: 0,
      searchIntent: 0,
      causality: 0,
      expressionQuality: 0,
      expectedImpact: 0,
    },
    totalScore: 0,
    warnings: ['Proposal v2 schema不適合のためSoft Evalを実行できません'],
  };
}

async function loadProposalRulebookStamp(
  supabase: SupabaseClient,
  proposal: ProposalForEvaluation
): Promise<{ version: number; hash: string } | null> {
  if (
    typeof proposal.rulebook_version === 'number' &&
    typeof proposal.rulebook_hash === 'string'
  ) {
    return { version: proposal.rulebook_version, hash: proposal.rulebook_hash };
  }
  const { data, error } = await supabase
    .from('seo_proposals')
    .select('rulebook_version,rulebook_hash')
    .eq('id', proposal.id)
    .maybeSingle();
  if (error) {
    if (isRulebookSchemaUnavailable(error)) return null;
    throw error;
  }
  return typeof data?.rulebook_version === 'number' &&
    typeof data?.rulebook_hash === 'string'
    ? { version: data.rulebook_version, hash: data.rulebook_hash }
    : null;
}

async function dailyProposalCount(supabase: SupabaseClient): Promise<number> {
  const { count, error } = await supabase
    .from('seo_proposals')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfUtcDay());
  if (error) throw error;
  return count ?? 0;
}

async function hasDuplicateProposal(
  supabase: SupabaseClient,
  proposal: ProposalForEvaluation
): Promise<boolean> {
  const parsed = proposalPayloadV2Schema.safeParse(proposal.payload);
  if (!parsed.success) return false;
  const targetKeys = new Set(
    parsed.data.targets.map((target) =>
      normalizedTargetKey(target.type, target.id, target.url)
    )
  );
  const duplicateWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('seo_proposals')
    .select('id,action,payload')
    .neq('id', proposal.id)
    .eq('action', parsed.data.action)
    .in('status', ['pending_approval', 'approved'])
    .gte('created_at', duplicateWindow)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  return (data ?? []).some((row) => {
    const other = proposalPayloadV2Schema.safeParse(row.payload);
    return (
      other.success &&
      other.data.targets.some((target) =>
        targetKeys.has(normalizedTargetKey(target.type, target.id, target.url))
      )
    );
  });
}

async function loadExistingEvaluation(
  supabase: SupabaseClient,
  proposal: ProposalForEvaluation,
  softThreshold: number,
  rulebook: BoundRulebook,
  phase: 'approval' | 'execution'
): Promise<ProposalEvaluationResult | null> {
  const { data, error } = await supabase
    .from('seo_proposal_evaluations')
    .select('soft_threshold,evaluation_result')
    .eq('proposal_id', proposal.id)
    .eq('proposal_version', proposal.version)
    .eq('proposal_payload_hash', proposal.payload_hash)
    .eq('evaluation_version', evaluationVersion(phase, rulebook))
    .eq('rulebook_version', rulebook.version)
    .eq('rulebook_hash', rulebook.contentHash)
    .maybeSingle();
  if (error) throw error;
  const result = data?.evaluation_result as ProposalEvaluationResult | undefined;
  if (!result || data?.soft_threshold !== softThreshold || result.retryable) return null;
  return result;
}

async function saveEvaluation(params: {
  supabase: SupabaseClient;
  proposal: ProposalForEvaluation;
  result: ProposalEvaluationResult;
  phase: 'approval' | 'execution';
  rulebook: BoundRulebook;
}): Promise<void> {
  const evaluationRow = {
      proposal_id: params.proposal.id,
      proposal_version: params.proposal.version,
      proposal_payload_hash: params.proposal.payload_hash,
      evaluation_version: evaluationVersion(params.phase, params.rulebook),
      hard_gate_passed: params.result.hardGatePassed,
      hard_gate_results: params.result.hardGateResults,
      soft_scores: params.result.softEval,
      total_score: params.result.softEval.totalScore,
      soft_threshold: params.result.softThreshold,
      risk_level: params.result.riskLevel,
      passed: params.result.passed,
      retryable: params.result.retryable,
      block_reasons: params.result.blockReasons,
      warnings: params.result.warnings,
      evaluation_result: params.result,
      rulebook_version_id: params.rulebook.versionId,
      rulebook_version: params.rulebook.version,
      rulebook_hash: params.rulebook.contentHash,
      applied_rule_ids: allRuleIds(params.rulebook.content),
      evaluated_at: new Date().toISOString(),
    };
  let { error } = await params.supabase.from('seo_proposal_evaluations').upsert(
    evaluationRow,
    {
      onConflict:
        'proposal_id,proposal_version,proposal_payload_hash,evaluation_version',
    }
  );
  if (error && isRulebookSchemaUnavailable(error)) {
    const {
      rulebook_version_id: _versionId,
      rulebook_version: _version,
      rulebook_hash: _hash,
      applied_rule_ids: _ruleIds,
      ...legacyRow
    } = evaluationRow;
    void _versionId;
    void _version;
    void _hash;
    void _ruleIds;
    ({ error } = await params.supabase
      .from('seo_proposal_evaluations')
      .upsert(legacyRow, {
        onConflict:
          'proposal_id,proposal_version,proposal_payload_hash,evaluation_version',
      }));
  }
  if (error) throw error;
}

async function collectFreshContext(
  supabase: SupabaseClient,
  storedContext: FactContextSnapshot | null
): Promise<{ context: FactContextSnapshot | null; warning: string | null }> {
  if (!storedContext) {
    return { context: null, warning: '保存済みFact Contextが不正です' };
  }
  try {
    return {
      context: await collectFactContext({
        supabase,
        targetUrl: storedContext.target.url,
      }),
      warning: null,
    };
  } catch (error) {
    return {
      context: null,
      warning: `最新Fact Contextを収集できません: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

export async function evaluateProposalForApproval(params: {
  supabase: SupabaseClient;
  config: SeoLoopConfig;
  proposal: ProposalForEvaluation;
  forceFresh?: boolean;
  phase?: 'approval' | 'execution';
  rulebookOverride?: BoundRulebook;
  persist?: boolean;
  ignoreProposalRulebookStamp?: boolean;
  freshContextOverride?: {
    context: FactContextSnapshot | null;
    warning: string | null;
  };
}): Promise<ProposalEvaluationResult> {
  const phase = params.phase ?? 'approval';
  const rulebook =
    params.rulebookOverride ??
    (await loadRulebookForRun({
      supabase: params.supabase,
      runId: params.proposal.run_id,
    }));
  const limits = effectiveRulebookLimits(params.config, rulebook);
  const actionValueLimits = effectiveActionValueLimits(rulebook);
  const proposalRulebook = params.ignoreProposalRulebookStamp
    ? null
    : await loadProposalRulebookStamp(params.supabase, params.proposal);
  if (proposalRulebook && proposalRulebook.hash !== rulebook.contentHash) {
    const hardGate = runHardGate({
      payload: params.proposal.payload,
      context: null,
      phase,
      duplicateProposal: false,
      dailyProposalCount: 0,
      maxDailyProposals: limits.maxDailyProposals,
      maxTargetsPerProposal: limits.maxTargetsPerProposal,
      actionValueLimits,
      forbiddenExpressionIds: rulebook.content.risk.forbiddenExpressionIds,
    });
    const message = `proposalのRulebook hash (${proposalRulebook.hash}) とrun固定hash (${rulebook.contentHash}) が一致しません`;
    const result: ProposalEvaluationResult = {
      version: QUALITY_EVALUATION_VERSION,
      passed: false,
      retryable: rulebook.source === 'fallback',
      hardGatePassed: false,
      hardGateResults: hardGate.results,
      softEval: hardGate.proposal
        ? runSoftEval(hardGate.proposal)
        : emptySoftEval(),
      softThreshold: limits.softEvalMinScore,
      riskLevel: 'blocked',
      blockReasons: [
        `${
          rulebook.source === 'fallback' ? 'infrastructure' : 'rulebook_binding_mismatch'
        }: ${message}`,
      ],
      warnings: [message],
    };
    if (params.persist !== false) {
      await saveEvaluation({
        supabase: params.supabase,
        proposal: params.proposal,
        result,
        phase,
        rulebook,
      });
    }
    return result;
  }
  if (!params.forceFresh && params.persist !== false) {
    const existing = await loadExistingEvaluation(
      params.supabase,
      params.proposal,
      limits.softEvalMinScore,
      rulebook,
      phase
    );
    if (existing) return existing;
  }

  const storedContextResult = factContextSnapshotSchema.safeParse(
    params.proposal.context_snapshot
  );
  const fresh =
    params.freshContextOverride ??
    (await collectFreshContext(
      params.supabase,
      storedContextResult.success ? storedContextResult.data : null
    ));
  if (fresh.warning) {
    const hardGate = runHardGate({
      payload: params.proposal.payload,
      context: null,
      phase,
      duplicateProposal: false,
      dailyProposalCount: 0,
      maxDailyProposals: limits.maxDailyProposals,
      maxTargetsPerProposal: limits.maxTargetsPerProposal,
      actionValueLimits,
      forbiddenExpressionIds: rulebook.content.risk.forbiddenExpressionIds,
    });
    const result: ProposalEvaluationResult = {
      version: QUALITY_EVALUATION_VERSION,
      passed: false,
      retryable: true,
      hardGatePassed: false,
      hardGateResults: hardGate.results,
      softEval: hardGate.proposal ? runSoftEval(hardGate.proposal) : emptySoftEval(),
      softThreshold: limits.softEvalMinScore,
      riskLevel: 'blocked',
      blockReasons: [`infrastructure: ${fresh.warning}`],
      warnings: [fresh.warning],
    };
    if (params.persist !== false) {
      await saveEvaluation({
        supabase: params.supabase,
        proposal: params.proposal,
        result,
        phase,
        rulebook,
      });
    }
    return result;
  }
  const [duplicateProposal, proposalCount] =
    phase === 'approval'
      ? await Promise.all([
          hasDuplicateProposal(params.supabase, params.proposal),
          dailyProposalCount(params.supabase),
        ])
      : [false, 0];
  const hardGate = runHardGate({
    payload: params.proposal.payload,
    context: fresh.context,
    phase,
    duplicateProposal,
    dailyProposalCount: proposalCount,
    maxDailyProposals: limits.maxDailyProposals,
    maxTargetsPerProposal: limits.maxTargetsPerProposal,
    actionValueLimits,
    forbiddenExpressionIds: rulebook.content.risk.forbiddenExpressionIds,
  });
  const softEval = hardGate.proposal ? runSoftEval(hardGate.proposal) : emptySoftEval();
  const hardGatePassed = hardGate.passed;
  const softPassed = softEval.totalScore >= limits.softEvalMinScore;
  const riskLevel = determineRiskLevel({
    proposal: hardGate.proposal,
    hardGatePassed,
    softScore: softEval.totalScore,
    softScoreThreshold: limits.softEvalMinScore,
    highRiskConfidenceBelow:
      Math.max(
        rulebook.content.risk.highRiskConfidenceBelow,
        FALLBACK_RULEBOOK.risk.highRiskConfidenceBelow
      ),
  });
  const blockReasons = hardGate.results
    .filter((result) => !result.passed)
    .map((result) => `${result.ruleId}: ${result.message}`);
  if (!softPassed) {
    blockReasons.push(
      `soft_eval: ${softEval.totalScore}/${limits.softEvalMinScore}`
    );
  }
  const warnings = [
    ...softEval.warnings,
    ...(fresh.warning ? [fresh.warning] : []),
  ];
  const result: ProposalEvaluationResult = {
    version: QUALITY_EVALUATION_VERSION,
    passed: hardGatePassed && softPassed && riskLevel !== 'blocked',
    retryable: false,
    hardGatePassed,
    hardGateResults: hardGate.results,
    softEval,
    softThreshold: limits.softEvalMinScore,
    riskLevel,
    blockReasons,
    warnings,
  };
  if (params.persist !== false) {
    await saveEvaluation({
      supabase: params.supabase,
      proposal: params.proposal,
      result,
      phase,
      rulebook,
    });
  }
  return result;
}

export function shouldSendProposalToSlack(
  evaluation: ProposalEvaluationResult
): boolean {
  return evaluation.passed && evaluation.hardGatePassed && evaluation.riskLevel !== 'blocked';
}
