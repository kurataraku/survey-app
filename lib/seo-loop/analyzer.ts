import type { SupabaseClient } from '@supabase/supabase-js';
import { callLLM, resolveModel } from '@/lib/seo-generation/llm-client';
import { payloadHash, stableJson } from './hash';
import { assertProposalLimits } from './limits';
import { collectFactContext } from './context/collector';
import { validateProposalAgainstContext } from './context/validate';
import { analystOutputSchema } from './analysis/types';
import {
  buildFactInventory,
  minimumFactErrors,
  selectedFacts,
  validateAnalystGrounding,
} from './analysis/facts';
import { candidateActionsForIssue } from './analysis/policy';
import {
  assembleProposalV2,
  strategistOutputSchema,
  validateStrategistAction,
} from './analysis/strategy';
import {
  ANALYST_PROMPT_VERSION,
  ANALYST_SYSTEM_PROMPT,
  STRATEGIST_PROMPT_VERSION,
  STRATEGIST_SYSTEM_PROMPT,
  analystInput,
  strategistInput,
} from './analysis/prompts';
import { runStructuredStage } from './analysis/structured';
import { recordAnalysisAttempts } from './analysis/trace';
import type { ProposalPayloadV2 } from './types';
import type { SeoLoopConfig } from './config';
import {
  effectiveRulebookLimits,
  isRulebookSchemaUnavailable,
  loadRulebookForRun,
} from './rulebook/runtime';
import { allRuleIds } from './rulebook/schema';

type SeoIssueRow = {
  id: string;
  issue_type: string;
  title: string;
  description: string | null;
  target_url: string | null;
  query: string | null;
  gsc_snapshot: unknown;
  evidence: unknown;
  scores: unknown;
};

const STRUCTURED_MAX_ATTEMPTS = 2;

function mergeIssueEvidence(
  issue: SeoIssueRow,
  additional: Record<string, unknown>
): Record<string, unknown> {
  const existing =
    issue.evidence && typeof issue.evidence === 'object' && !Array.isArray(issue.evidence)
      ? (issue.evidence as Record<string, unknown>)
      : {};
  return { ...existing, ...additional };
}

async function fetchOpenIssues(supabase: SupabaseClient, runId: string): Promise<SeoIssueRow[]> {
  const { data, error } = await supabase
    .from('seo_issues')
    .select('id,issue_type,title,description,target_url,query,gsc_snapshot,evidence,scores')
    .eq('run_id', runId)
    .eq('status', 'open')
    .limit(5);

  if (error) throw error;
  return (data ?? []) as SeoIssueRow[];
}

export async function analyzeIssuesToProposals(params: {
  supabase: SupabaseClient;
  runId: string;
  config: SeoLoopConfig;
}): Promise<{ proposalCount: number; message: string }> {
  const issues = await fetchOpenIssues(params.supabase, params.runId);
  if (issues.length === 0) {
    const { error } = await params.supabase
      .from('seo_loop_runs')
      .update({ status: 'completed', current_step: 'analyze', completed_at: new Date().toISOString() })
      .eq('id', params.runId);
    if (error) throw error;
    return { proposalCount: 0, message: '分析対象の課題がありません' };
  }

  const model = resolveModel('SEO_LOOP_LLM_MODEL', 'gpt-4o-mini', 'openai');
  const rulebook = await loadRulebookForRun({
    supabase: params.supabase,
    runId: params.runId,
  });
  const ruleIds = allRuleIds(rulebook.content);
  const effectiveLimits = effectiveRulebookLimits(params.config, rulebook);
  let proposalCount = 0;

  for (const issue of issues) {
    if (!issue.target_url) {
      const { error } = await params.supabase
        .from('seo_issues')
        .update({
          status: 'dismissed',
          evidence: mergeIssueEvidence(issue, {
            context_error: '対象URLがないためFact Contextを収集できません',
          }),
        })
        .eq('id', issue.id);
      if (error) throw error;
      continue;
    }

    let context;
    try {
      context = await collectFactContext({
        supabase: params.supabase,
        targetUrl: issue.target_url,
      });
    } catch (error) {
      const { error: updateError } = await params.supabase
        .from('seo_issues')
        .update({
          status: 'dismissed',
          evidence: mergeIssueEvidence(issue, {
            context_error: error instanceof Error ? error.message : String(error),
          }),
        })
        .eq('id', issue.id);
      if (updateError) throw updateError;
      continue;
    }

    const factErrors = minimumFactErrors(
      { issueType: issue.issue_type, gscSnapshot: issue.gsc_snapshot },
      context
    );
    if (factErrors.length > 0) {
      const { error } = await params.supabase
        .from('seo_issues')
        .update({
          status: 'dismissed',
          evidence: mergeIssueEvidence(issue, {
            analysis_failure: {
              stage: 'facts',
              reason: '決定論的な最低Fact基準を満たしません',
              errors: factErrors,
            },
          }),
        })
        .eq('id', issue.id);
      if (error) throw error;
      continue;
    }

    const candidateActions = candidateActionsForIssue(
      issue.issue_type,
      context,
      rulebook.content.analyzer
    );
    if (candidateActions.length === 0) {
      const { error } = await params.supabase
        .from('seo_issues')
        .update({
          status: 'dismissed',
          evidence: mergeIssueEvidence(issue, {
            analysis_failure: {
              stage: 'policy',
              reason: 'issue type・ページ種別・実測currentValueに合う候補actionがありません',
            },
          }),
        })
        .eq('id', issue.id);
      if (error) throw error;
      continue;
    }

    const factInventory = buildFactInventory(
      {
        issueType: issue.issue_type,
        title: issue.title,
        description: issue.description,
        query: issue.query,
        gscSnapshot: issue.gsc_snapshot,
        scores: issue.scores,
      },
      context
    );
    const groundedAnalystSchema = analystOutputSchema.superRefine((output, ctx) => {
      for (const error of validateAnalystGrounding(output, factInventory)) {
        ctx.addIssue({ code: 'custom', message: error });
      }
    });
    const analystRun = await runStructuredStage({
      schema: groundedAnalystSchema,
      maxAttempts: STRUCTURED_MAX_ATTEMPTS,
      makeInput: (_attempt, previousError) =>
        analystInput({
          issue,
          factInventory,
          ruleIds: rulebook.content.analyzer.ruleIds,
          rulebookVersion: rulebook.version,
          rulebookHash: rulebook.contentHash,
          retryError: previousError,
        }),
      call: (inputSnapshot) =>
        callLLM({
          provider: model.provider,
          model: model.model,
          systemPrompt: ANALYST_SYSTEM_PROMPT,
          userPrompt: stableJson(inputSnapshot),
          jsonMode: true,
          maxTokens: 1200,
          temperature: 0.1,
        }),
    });
    await recordAnalysisAttempts({
      supabase: params.supabase,
      runId: params.runId,
      issueId: issue.id,
      stage: 'analyst',
      promptVersion: ANALYST_PROMPT_VERSION,
      provider: model.provider,
      model: model.model,
      attempts: analystRun.attempts,
    });

    if (!analystRun.data) {
      const { error } = await params.supabase
        .from('seo_issues')
        .update({
          status: 'dismissed',
          evidence: mergeIssueEvidence(issue, {
            analysis_failure: {
              stage: 'analyst',
              attempts: analystRun.attempts.map((attempt) => ({
                attempt: attempt.attempt,
                status: attempt.status,
                error: attempt.error,
              })),
            },
          }),
        })
        .eq('id', issue.id);
      if (error) throw error;
      continue;
    }

    if (!analystRun.data.sufficient) {
      const { error } = await params.supabase
        .from('seo_issues')
        .update({
          status: 'dismissed',
          evidence: mergeIssueEvidence(issue, {
            analysis_result: analystRun.data,
            analysis_failure: {
              stage: 'analyst',
              reason: 'Analystが事実不足と判定しました',
            },
          }),
        })
        .eq('id', issue.id);
      if (error) throw error;
      continue;
    }

    const facts = selectedFacts(analystRun.data, factInventory);
    const groundedStrategistSchema = strategistOutputSchema.superRefine((output, ctx) => {
      const errors = validateStrategistAction(output, candidateActions);
      try {
        const proposal = assembleProposalV2({
          strategist: output,
          analyst: analystRun.data!,
          selectedFacts: facts,
          context,
          ruleIds,
        });
        if (proposal) errors.push(...validateProposalAgainstContext(proposal, context));
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
      for (const error of errors) {
        ctx.addIssue({ code: 'custom', message: error });
      }
    });
    const strategistRun = await runStructuredStage({
      schema: groundedStrategistSchema,
      maxAttempts: STRUCTURED_MAX_ATTEMPTS,
      makeInput: (_attempt, previousError) =>
        strategistInput({
          analyst: analystRun.data!,
          selectedFacts: facts,
          candidateActions,
          context,
          ruleIds,
          rulebookVersion: rulebook.version,
          rulebookHash: rulebook.contentHash,
          retryError: previousError,
        }),
      call: (inputSnapshot) =>
        callLLM({
          provider: model.provider,
          model: model.model,
          systemPrompt: STRATEGIST_SYSTEM_PROMPT,
          userPrompt: stableJson(inputSnapshot),
          jsonMode: true,
          maxTokens: 2200,
          temperature: 0.2,
        }),
    });
    await recordAnalysisAttempts({
      supabase: params.supabase,
      runId: params.runId,
      issueId: issue.id,
      stage: 'strategist',
      promptVersion: STRATEGIST_PROMPT_VERSION,
      provider: model.provider,
      model: model.model,
      attempts: strategistRun.attempts,
    });

    if (!strategistRun.data) {
      const { error } = await params.supabase
        .from('seo_issues')
        .update({
          status: 'dismissed',
          evidence: mergeIssueEvidence(issue, {
            analysis_result: analystRun.data,
            analysis_failure: {
              stage: 'strategist',
              attempts: strategistRun.attempts.map((attempt) => ({
                attempt: attempt.attempt,
                status: attempt.status,
                error: attempt.error,
              })),
            },
          }),
        })
        .eq('id', issue.id);
      if (error) throw error;
      continue;
    }

    const assembledProposal = assembleProposalV2({
      strategist: strategistRun.data,
      analyst: analystRun.data,
      selectedFacts: facts,
      context,
      ruleIds,
    });
    const proposals = assembledProposal ? [assembledProposal] : [];
    let issueProposalCount = 0;
    for (const proposal of proposals) {
      await assertProposalLimits(
        params.supabase,
        { ...params.config, ...effectiveLimits },
        proposal
      );
      const hash = payloadHash(proposal);
      const proposalKey = `${issue.id}:${proposal.action}:${hash.slice(0, 16)}`;
      const insert: ProposalPayloadV2 = proposal;
      const proposalRow = {
          run_id: params.runId,
          issue_id: issue.id,
          proposal_key: proposalKey,
          version: 1,
          schema_version: 2,
          context_snapshot: context,
          change_type: 'application_data',
          action: insert.action,
          payload: insert,
          payload_hash: hash,
          risk_level: 'medium',
          requires_approval: true,
          status: 'pending_approval',
          rationale: insert.rationale,
          baseline: {
            gsc_snapshot: issue.gsc_snapshot,
            issue_scores: issue.scores,
            analysis: {
              analyst_prompt_version: ANALYST_PROMPT_VERSION,
              strategist_prompt_version: STRATEGIST_PROMPT_VERSION,
              model_provider: model.provider,
              model: model.model,
              analyst_input_hash: analystRun.attempts.at(-1)?.inputHash ?? null,
              strategist_input_hash: strategistRun.attempts.at(-1)?.inputHash ?? null,
            },
          },
          rulebook_version_id: rulebook.versionId,
          rulebook_version: rulebook.version,
          rulebook_hash: rulebook.contentHash,
          applied_rule_ids: ruleIds,
        };
      let { error } = await params.supabase.from('seo_proposals').upsert(
        proposalRow,
        { onConflict: 'run_id,proposal_key' }
      );
      if (error && isRulebookSchemaUnavailable(error)) {
        const {
          rulebook_version_id: _versionId,
          rulebook_version: _version,
          rulebook_hash: _hash,
          applied_rule_ids: _ruleIds,
          ...legacyRow
        } = proposalRow;
        void _versionId;
        void _version;
        void _hash;
        void _ruleIds;
        ({ error } = await params.supabase.from('seo_proposals').upsert(
          legacyRow,
          { onConflict: 'run_id,proposal_key' }
        ));
      }
      if (error) throw error;
      proposalCount += 1;
      issueProposalCount += 1;
    }

    const { error: issueUpdateError } = await params.supabase
      .from('seo_issues')
      .update({
        status: issueProposalCount > 0 ? 'proposed' : 'dismissed',
        evidence: mergeIssueEvidence(issue, {
          analysis_result: analystRun.data,
          candidate_actions: candidateActions,
          selected_fact_ids: analystRun.data.selectedFactIds,
        }),
      })
      .eq('id', issue.id);
    if (issueUpdateError) throw issueUpdateError;
  }

  const { error: runUpdateError } = await params.supabase
    .from('seo_loop_runs')
    .update({
      status: proposalCount > 0 ? 'pending_approval' : 'completed',
      current_step: proposalCount > 0 ? 'approve' : 'analyze',
      completed_at: proposalCount > 0 ? null : new Date().toISOString(),
    })
    .eq('id', params.runId);
  if (runUpdateError) throw runUpdateError;

  return {
    proposalCount,
    message:
      proposalCount > 0
        ? `${proposalCount}件の構造化proposalを保存しました`
        : '承認対象proposalは生成されませんでした',
  };
}
