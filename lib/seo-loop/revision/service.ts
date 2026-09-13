import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { callLLM, resolveModel } from '@/lib/seo-generation/llm-client';
import type { SeoLoopConfig } from '../config';
import { collectFactContext } from '../context/collector';
import { validateProposalAgainstContext } from '../context/validate';
import { payloadHash, stableJson } from '../hash';
import { assertProposalLimits } from '../limits';
import { feedbackCategorySchema } from '../slack-interactions/types';
import {
  proposalPayloadV2Schema,
  type ProposalPayloadV2,
  type TypedAction,
} from '../types';
import { runStructuredStage } from '../analysis/structured';
import {
  effectiveRulebookLimits,
  loadRulebookForRun,
} from '../rulebook/runtime';
import { allRuleIds } from '../rulebook/schema';
import {
  REVISION_STRATEGIST_PROMPT_VERSION,
  REVISION_STRATEGIST_SYSTEM_PROMPT,
  revisionStrategistInput,
  revisionStrategistOutputSchema,
  type RevisionStrategistOutput,
} from './prompts';

const MAX_REVISION_RETRIES = 3;
const STRUCTURED_MAX_ATTEMPTS = 3;

type ParentProposalRow = {
  id: string;
  run_id: string;
  issue_id: string | null;
  version: number;
  payload_hash: string;
  payload: unknown;
  baseline: unknown;
  revision_number: number;
  revision_retry_count: number;
  schema_version: number;
};

const feedbackRowSchema = z.object({
  id: z.string().uuid(),
  proposal_id: z.string().uuid(),
  proposal_version: z.number().int().positive(),
  proposal_payload_hash: z.string().min(16),
  reason: z.string().min(5).max(2000),
  category: feedbackCategorySchema,
  desired_change: z.string().min(5).max(2000).nullable(),
  general_rule_candidate: z.boolean(),
});
type FeedbackRow = z.infer<typeof feedbackRowSchema>;

type RevisionRequest = {
  parent: ParentProposalRow;
  feedback: FeedbackRow;
};

function targetType(action: TypedAction): 'school' | 'feature' | 'url' {
  if (action === 'updateFeatureMetaDescription') return 'feature';
  if (action === 'addApprovedInternalLink') return 'url';
  return 'school';
}

async function loadPendingRevisionRequests(
  supabase: SupabaseClient,
  runId?: string
): Promise<RevisionRequest[]> {
  let parentQuery = supabase
    .from('seo_proposals')
    .select(
      'id,run_id,issue_id,version,payload_hash,payload,baseline,revision_number,revision_retry_count,schema_version'
    )
    .eq('status', 'revision_requested')
    .eq('schema_version', 2)
    .is('revision_resolved_at', null)
    .lt('revision_retry_count', MAX_REVISION_RETRIES)
    .lte('revision_next_action_at', new Date().toISOString())
    .order('updated_at', { ascending: true })
    .limit(100);
  if (runId) parentQuery = parentQuery.eq('run_id', runId);
  const { data: parentData, error: parentError } = await parentQuery;
  if (parentError) throw parentError;
  const parents = (parentData ?? []) as ParentProposalRow[];
  if (parents.length === 0) return [];

  const { data: feedbackData, error: feedbackError } = await supabase
    .from('seo_feedback')
    .select(
      'id,proposal_id,proposal_version,proposal_payload_hash,reason,category,desired_change,general_rule_candidate'
    )
    .in(
      'proposal_id',
      parents.map((parent) => parent.id)
    )
    .eq('decision', 'revision_requested')
    .not('desired_change', 'is', null)
    .order('created_at', { ascending: true });
  if (feedbackError) throw feedbackError;
  const feedbacks = (feedbackData ?? [])
    .map((row) => feedbackRowSchema.safeParse(row))
    .filter((result) => result.success)
    .map((result) => result.data);
  if (feedbacks.length === 0) return [];

  const { data: childData, error: childError } = await supabase
    .from('seo_proposals')
    .select('revision_feedback_id')
    .in(
      'revision_feedback_id',
      feedbacks.map((feedback) => feedback.id)
    );
  if (childError) throw childError;
  const consumedFeedbackIds = new Set(
    (childData ?? []).map((child) => child.revision_feedback_id as string)
  );

  return parents.flatMap((parent) => {
    const feedback = feedbacks.find(
      (item) =>
        item.proposal_id === parent.id &&
        item.proposal_version === parent.version &&
        item.proposal_payload_hash === parent.payload_hash &&
        !consumedFeedbackIds.has(item.id)
    );
    return feedback ? [{ parent, feedback }] : [];
  });
}

export async function findNextRevisionRunId(params: {
  supabase: SupabaseClient;
  excludedRunIds?: ReadonlySet<string>;
}): Promise<string | null> {
  try {
    const requests = await loadPendingRevisionRequests(params.supabase);
    const candidateRunIds = [
      ...new Set(
        requests
          .map((request) => request.parent.run_id)
          .filter((runId) => !params.excludedRunIds?.has(runId))
      ),
    ];
    if (candidateRunIds.length === 0) return null;
    const { data, error } = await params.supabase
      .from('seo_loop_runs')
      .select('id,status,retry_count,max_retries')
      .in('id', candidateRunIds);
    if (error) throw error;
    const runnableIds = new Set(
      (data ?? [])
        .filter(
          (run) =>
            run.status !== 'failed' &&
            run.status !== 'skipped' &&
            run.retry_count < run.max_retries
        )
        .map((run) => run.id as string)
    );
    return candidateRunIds.find((runId) => runnableIds.has(runId)) ?? null;
  } catch (error) {
    if (isRevisionSchemaUnavailable(error)) {
      console.error('SEO revision migration is not applied', {
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
    throw error;
  }
}

export async function hasPendingRevisionForRun(
  supabase: SupabaseClient,
  runId: string
): Promise<boolean> {
  try {
    return (await loadPendingRevisionRequests(supabase, runId)).length > 0;
  } catch (error) {
    if (isRevisionSchemaUnavailable(error)) return false;
    throw error;
  }
}

function isRevisionSchemaUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: string; message?: string };
  return (
    ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(value.code ?? '') ||
    /revision_(?:retry_count|next_action_at|resolved_at)|seo_revision_traces/i.test(
      value.message ?? ''
    )
  );
}

function assembleRevisionProposal(params: {
  parent: ProposalPayloadV2;
  output: RevisionStrategistOutput;
  context: Awaited<ReturnType<typeof collectFactContext>>;
  feedback: FeedbackRow;
  ruleIds: string[];
}): ProposalPayloadV2 {
  const action = params.parent.action;
  const currentValue = params.context.currentValues[action];
  if (!params.context.target.id || currentValue === undefined) {
    throw new Error('改訂proposalに必要な対象IDまたは最新currentValueがありません');
  }
  const freshFacts: ProposalPayloadV2['facts'] = [
    { source: 'html', statement: `HTTP status: ${params.context.html.status}` },
    ...(params.context.html.title
      ? [{ source: 'html' as const, statement: `Title: ${params.context.html.title}` }]
      : []),
    ...(params.context.html.description
      ? [
          {
            source: 'html' as const,
            statement: `Description: ${params.context.html.description}`,
          },
        ]
      : []),
    ...(params.context.database
      ? [
          {
            source: 'database' as const,
            statement: `対象レコード: ${params.context.database.type}:${params.context.database.id} public=${params.context.database.isPublic}`,
          },
        ]
      : []),
  ];
  const evidenceWasChallenged =
    params.feedback.category === 'factual_error' ||
    params.feedback.category === 'weak_evidence';
  const inheritedFacts = evidenceWasChallenged
    ? params.parent.facts.filter((fact) => fact.source === 'gsc')
    : params.parent.facts;
  const facts = [...inheritedFacts, ...freshFacts].filter(
    (fact, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.source === fact.source &&
          candidate.statement === fact.statement
      ) === index
  );
  const proposal = proposalPayloadV2Schema.parse({
    ...params.parent,
    action,
    targets: [
      {
        type: targetType(action),
        id: params.context.target.id,
        url: params.context.target.url,
        currentValue,
        proposedValue: params.output.proposal.proposedValue,
      },
    ],
    rollbackPlan: params.output.proposal.rollbackPlan,
    rationale: params.output.proposal.rationale,
    expectedImpact: params.output.proposal.expectedImpact,
    facts,
    evidence: facts.map((fact) => fact.statement),
    assumptions: [
      ...params.parent.assumptions,
      `人間feedback category=${params.feedback.category} を受けた改訂`,
    ],
    confidence: evidenceWasChallenged
      ? Math.min(params.parent.confidence, 0.5)
      : params.parent.confidence,
    ruleIds: params.ruleIds,
  });
  const errors = validateProposalAgainstContext(proposal, params.context);
  if (errors.length > 0) throw new Error(errors.join('; '));
  return proposal;
}

async function recordRevisionAttempts(params: {
  supabase: SupabaseClient;
  request: RevisionRequest;
  provider: 'openai' | 'anthropic';
  model: string;
  attempts: Awaited<ReturnType<typeof runStructuredStage<RevisionStrategistOutput>>>['attempts'];
}): Promise<void> {
  if (params.attempts.length === 0) return;
  const rows = params.attempts.map((attempt) => ({
    run_id: params.request.parent.run_id,
    issue_id: params.request.parent.issue_id,
    parent_proposal_id: params.request.parent.id,
    feedback_id: params.request.feedback.id,
    cycle: params.request.parent.revision_retry_count + 1,
    attempt: attempt.attempt,
    prompt_version: REVISION_STRATEGIST_PROMPT_VERSION,
    model_provider: params.provider,
    model: params.model,
    input_context_hash: attempt.inputHash,
    input_snapshot: attempt.inputSnapshot,
    raw_output: attempt.rawOutput,
    parsed_output: attempt.parsedOutput,
    status: attempt.status,
    error_message: attempt.error,
    token_usage: attempt.tokens,
  }));
  const { error } = await params.supabase
    .from('seo_revision_traces')
    .upsert(rows, {
      onConflict: 'parent_proposal_id,feedback_id,cycle,attempt',
    });
  if (error) throw error;
}

async function markRevisionFailure(params: {
  supabase: SupabaseClient;
  request: RevisionRequest;
  message: string;
  retryable?: boolean;
}): Promise<{ retryCount: number; notify: boolean }> {
  const retryCount =
    params.request.parent.revision_retry_count + (params.retryable ? 0 : 1);
  const { error: proposalError } = await params.supabase
    .from('seo_proposals')
    .update({
      revision_retry_count: retryCount,
      revision_error: `${params.retryable ? '[retryable] ' : ''}${params.message}`,
      revision_next_action_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })
    .eq('id', params.request.parent.id)
    .eq('status', 'revision_requested');
  if (proposalError) throw proposalError;
  await settleRunAfterRevision({
    supabase: params.supabase,
    runId: params.request.parent.run_id,
    currentStep: 'revision_wait',
    errorMessage:
      retryCount >= MAX_REVISION_RETRIES
        ? `改訂生成が${MAX_REVISION_RETRIES}回失敗しました: ${params.message}`
        : params.message,
  });
  return {
    retryCount,
    notify: retryCount >= MAX_REVISION_RETRIES,
  };
}

async function abandonRevisionRequest(params: {
  supabase: SupabaseClient;
  request: RevisionRequest;
  message: string;
}): Promise<void> {
  const { error: proposalError } = await params.supabase
    .from('seo_proposals')
    .update({
      status: 'rejected',
      revision_resolved_at: new Date().toISOString(),
      revision_error: params.message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.request.parent.id)
    .eq('status', 'revision_requested')
    .is('revision_resolved_at', null);
  if (proposalError) throw proposalError;

  await params.supabase
    .from('seo_approvals')
    .update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
    })
    .eq('proposal_id', params.request.parent.id)
    .eq('proposal_version', params.request.parent.version)
    .eq('proposal_payload_hash', params.request.parent.payload_hash)
    .eq('status', 'revision_requested');

  await settleRunAfterRevision({
    supabase: params.supabase,
    runId: params.request.parent.run_id,
    currentStep: 'revision_abandoned',
    errorMessage: params.message,
  });
}

function isRevisionInfrastructureError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: string; message?: string };
  return (
    ['42883', 'PGRST000', 'PGRST002', 'PGRST202'].includes(value.code ?? '') ||
    (value.code === 'P0001' && /rulebook/i.test(value.message ?? '')) ||
    /create_seo_proposal_revision|network|fetch|timeout|connection|schema cache/i.test(
      value.message ?? ''
    )
  );
}

async function settleRunAfterRevision(params: {
  supabase: SupabaseClient;
  runId: string;
  currentStep: string;
  errorMessage?: string | null;
}): Promise<void> {
  const { data, error: proposalError } = await params.supabase
    .from('seo_proposals')
    .select('status')
    .eq('run_id', params.runId)
    .in('status', ['pending_approval', 'approved']);
  if (proposalError) throw proposalError;
  const statuses = new Set((data ?? []).map((row) => row.status as string));
  const status = statuses.has('approved')
    ? 'executing'
    : statuses.has('pending_approval')
      ? 'pending_approval'
      : 'completed';
  const { error: runError } = await params.supabase
    .from('seo_loop_runs')
    .update({
      status,
      current_step: params.currentStep,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      error_message: params.errorMessage ?? null,
    })
    .eq('id', params.runId);
  if (runError) throw runError;
}

export async function reviseRequestedProposal(params: {
  supabase: SupabaseClient;
  runId: string;
  config: SeoLoopConfig;
}): Promise<{
  proposalCount: number;
  outcome: 'created' | 'no_request' | 'failed' | 'abandoned';
  message: string;
  notify: boolean;
  reason: string | null;
}> {
  const request = (await loadPendingRevisionRequests(params.supabase, params.runId))[0];
  if (!request) {
    await settleRunAfterRevision({
      supabase: params.supabase,
      runId: params.runId,
      currentStep: 'revise',
    });
    return {
      proposalCount: 0,
      outcome: 'no_request',
      message: '処理可能な改訂要求がありません',
      notify: false,
      reason: null,
    };
  }

  const parentParsed = proposalPayloadV2Schema.safeParse(request.parent.payload);
  if (!parentParsed.success) {
    const failure = await markRevisionFailure({
      supabase: params.supabase,
      request,
      message: '改訂元がProposal v2 schemaに適合しません',
    });
    return {
      proposalCount: 0,
      outcome: 'failed',
      message: '改訂元proposalが不正なため改訂を停止しました',
      notify: failure.notify,
      reason: '改訂元がProposal v2 schemaに適合しません',
    };
  }
  if (request.feedback.category === 'wrong_target') {
    const reason =
      'wrong_targetの修正依頼は、現在の改訂レーンではaction/対象を変更できないため打ち切りました。新しいissueから別proposalを生成してください。';
    await abandonRevisionRequest({
      supabase: params.supabase,
      request,
      message: reason,
    });
    return {
      proposalCount: 0,
      outcome: 'abandoned',
      message: reason,
      notify: true,
      reason,
    };
  }
  const rulebook = await loadRulebookForRun({
    supabase: params.supabase,
    runId: params.runId,
  });
  const ruleIds = allRuleIds(rulebook.content);
  const effectiveLimits = effectiveRulebookLimits(params.config, rulebook);
  try {
    await assertProposalLimits(
      params.supabase,
      { ...params.config, ...effectiveLimits },
      parentParsed.data
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failure = await markRevisionFailure({ supabase: params.supabase, request, message });
    return {
      proposalCount: 0,
      outcome: 'failed',
      message: `改訂上限チェック失敗: ${message}`,
      notify: failure.notify,
      reason: message,
    };
  }

  let context;
  try {
    context = await collectFactContext({
      supabase: params.supabase,
      targetUrl: parentParsed.data.targets[0]!.url,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failure = await markRevisionFailure({
      supabase: params.supabase,
      request,
      message,
      retryable: true,
    });
    return {
      proposalCount: 0,
      outcome: 'failed',
      message: `Fact Context再取得失敗: ${message}`,
      notify: failure.notify,
      reason: message,
    };
  }

  const parent = parentParsed.data;
  const originalProposedValue = parent.targets[0]!.proposedValue.trim();
  const guardedSchema = revisionStrategistOutputSchema.superRefine((output, ctx) => {
    if (output.proposal.action !== parent.action) {
      ctx.addIssue({
        code: 'custom',
        path: ['proposal', 'action'],
        message: `改訂でactionを変更できません: ${output.proposal.action}`,
      });
    }
    if (output.proposal.proposedValue.trim() === originalProposedValue) {
      ctx.addIssue({
        code: 'custom',
        path: ['proposal', 'proposedValue'],
        message: '改訂案が元のproposedValueと同じです',
      });
    }
    try {
      assembleRevisionProposal({
        parent,
        output,
        context,
        feedback: request.feedback,
        ruleIds,
      });
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });
  const model = resolveModel('SEO_LOOP_LLM_MODEL', 'gpt-4o-mini', 'openai');
  const revisionRun = await runStructuredStage({
    schema: guardedSchema,
    maxAttempts: STRUCTURED_MAX_ATTEMPTS,
    makeInput: (_attempt, previousError) =>
      revisionStrategistInput({
        fixedAction: parent.action,
        parentProposal: parent,
        feedback: {
          category: request.feedback.category,
          reason: request.feedback.reason,
          desiredChange: request.feedback.desired_change,
          generalRuleCandidate: request.feedback.general_rule_candidate,
        },
        freshContext: context,
        ruleIds,
        rulebookVersion: rulebook.version,
        rulebookHash: rulebook.contentHash,
        retryError: previousError,
      }),
    call: (inputSnapshot) =>
      callLLM({
        provider: model.provider,
        model: model.model,
        systemPrompt: REVISION_STRATEGIST_SYSTEM_PROMPT,
        userPrompt: stableJson(inputSnapshot),
        jsonMode: true,
        maxTokens: 2200,
        temperature: 0.2,
      }),
  });
  try {
    await recordRevisionAttempts({
      supabase: params.supabase,
      request,
      provider: model.provider,
      model: model.model,
      attempts: revisionRun.attempts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failure = await markRevisionFailure({
      supabase: params.supabase,
      request,
      message,
      retryable: isRevisionInfrastructureError(error),
    });
    return {
      proposalCount: 0,
      outcome: 'failed',
      message: `改訂trace保存失敗: ${message}`,
      notify: failure.notify,
      reason: message,
    };
  }
  if (!revisionRun.data) {
    const message =
      revisionRun.attempts.at(-1)?.error ?? '改訂Strategistが有効なJSONを返しませんでした';
    const failure = await markRevisionFailure({
      supabase: params.supabase,
      request,
      message,
      retryable:
        revisionRun.attempts.length > 0 &&
        revisionRun.attempts.every((attempt) => attempt.status === 'call_failed'),
    });
    return {
      proposalCount: 0,
      outcome: 'failed',
      message: `改訂proposalを生成できませんでした: ${message}`,
      notify: failure.notify,
      reason: message,
    };
  }

  const proposal = assembleRevisionProposal({
    parent,
    output: revisionRun.data,
    context,
    feedback: request.feedback,
    ruleIds,
  });
  const hash = payloadHash(proposal);
  if (hash === request.parent.payload_hash) {
    const failure = await markRevisionFailure({
      supabase: params.supabase,
      request,
      message: '改訂proposalのpayload hashが元proposalと同一です',
    });
    return {
      proposalCount: 0,
      outcome: 'failed',
      message: '同一hashの改訂proposalを拒否しました',
      notify: failure.notify,
      reason: '改訂proposalのpayload hashが元proposalと同一です',
    };
  }
  const baseline =
    request.parent.baseline &&
    typeof request.parent.baseline === 'object' &&
    !Array.isArray(request.parent.baseline)
      ? (request.parent.baseline as Record<string, unknown>)
      : {};
  let childId: string | null = null;
  let createError: { code?: string; message?: string } | null = null;
  try {
    const result = await params.supabase.rpc('create_seo_proposal_revision', {
      p_parent_proposal_id: request.parent.id,
      p_feedback_id: request.feedback.id,
      p_context_snapshot: context,
      p_payload: proposal,
      p_payload_hash: hash,
      p_rationale: proposal.rationale,
      p_baseline: {
        ...baseline,
        revision: {
          parent_proposal_id: request.parent.id,
          feedback_id: request.feedback.id,
          prompt_version: REVISION_STRATEGIST_PROMPT_VERSION,
          model_provider: model.provider,
          model: model.model,
          rulebook_version: rulebook.version,
          rulebook_hash: rulebook.contentHash,
        },
      },
    });
    childId = result.data as string | null;
    createError = result.error;
  } catch (error) {
    createError = {
      message: error instanceof Error ? error.message : String(error),
    };
  }
  if (createError || !childId) {
    const message =
      createError?.message ?? '改訂proposalの原子的保存に失敗しました';
    const failure = await markRevisionFailure({
      supabase: params.supabase,
      request,
      message,
      retryable: isRevisionInfrastructureError(createError),
    });
    return {
      proposalCount: 0,
      outcome: 'failed',
      message: `改訂proposal保存失敗: ${message}`,
      notify: failure.notify,
      reason: message,
    };
  }

  return {
    proposalCount: 1,
    outcome: 'created',
    message: `改訂proposalを生成しました: revision ${request.parent.revision_number + 1}`,
    notify: false,
    reason: null,
  };
}
