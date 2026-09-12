import type { SupabaseClient } from '@supabase/supabase-js';
import { payloadHash } from '../hash';
import { rulebookContentSchema } from '../rulebook/schema';
import {
  buildFeedbackModal,
  extractFeedbackInput,
  parseModalMetadata,
} from './modal';
import {
  parseProposalRef,
  parseRulePatchRef,
  slackBlockActionPayloadSchema,
  slackViewSubmissionPayloadSchema,
  type FeedbackDecision,
  type SlackBlockActionPayload,
  type SlackProposalRef,
  type SlackRulePatchRef,
  type SlackViewSubmissionPayload,
} from './types';

export type SlackAfterResponse = {
  responseUrl: string;
  text: string;
  replaceOriginal: boolean;
};

export type SlackInteractionResult = {
  status: number;
  body: Record<string, unknown>;
  afterResponse?: SlackAfterResponse;
  afterAction?: () => Promise<void>;
};

function actorName(
  user: SlackBlockActionPayload['user'] | SlackViewSubmissionPayload['user']
): string {
  return user.name ?? user.username ?? user.id;
}

function isSlackResponseUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'hooks.slack.com';
  } catch {
    return false;
  }
}

function isAuthorizedUser(userId: string): boolean {
  const allowed = (process.env.SLACK_SEO_APPROVER_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.length > 0 && allowed.includes(userId);
}

function isAuthorizedChannel(channelId: string | undefined): boolean {
  const expected = process.env.SLACK_SEO_CHANNEL_ID;
  return Boolean(expected && channelId === expected);
}

function isAuthorizedRulebookUser(userId: string): boolean {
  const allowed = (process.env.SLACK_SEO_RULEBOOK_APPROVER_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.length > 0 && allowed.includes(userId);
}

function isRulePatchSwitchEnabled(): boolean {
  const value = process.env.SEO_RULEBOOK_PATCH_ENABLED?.toLowerCase();
  return value === 'true' || value === '1';
}

function blockActionError(
  payload: SlackBlockActionPayload,
  message: string
): SlackInteractionResult {
  return {
    status: 200,
    body: { ok: false },
    ...(isSlackResponseUrl(payload.response_url)
      ? {
          afterResponse: {
            responseUrl: payload.response_url,
            text: message,
            replaceOriginal: false,
          },
        }
      : {}),
  };
}

async function approveProposal(params: {
  supabase: SupabaseClient;
  payload: SlackBlockActionPayload;
  proposalRef: SlackProposalRef;
}): Promise<SlackInteractionResult> {
  let approvalId: unknown;
  let error: { code?: string; message?: string } | null = null;
  try {
    const result = await params.supabase.rpc('approve_seo_proposal', {
      p_proposal_id: params.proposalRef.id,
      p_proposal_version: params.proposalRef.version,
      p_proposal_payload_hash: params.proposalRef.hash,
      p_approver_id: params.payload.user.id,
      p_approver_name: actorName(params.payload.user),
    });
    approvalId = result.data;
    error = result.error;
  } catch (rpcError) {
    error = {
      message: rpcError instanceof Error ? rpcError.message : String(rpcError),
    };
  }
  if (error || !approvalId) {
    console.error('approve_seo_proposal failed', {
      code: error?.code,
      message: error?.message,
    });
    return blockActionError(
      params.payload,
      'この承認カードは無効化または処理済みです。設定エラーが続く場合は管理者に確認してください。'
    );
  }

  const responseUrl = isSlackResponseUrl(params.payload.response_url)
    ? params.payload.response_url
    : undefined;
  return {
    status: 200,
    body: { ok: true },
    ...(responseUrl
      ? {
          afterResponse: {
            responseUrl,
            text: `SEO提案を承認しました\nProposal: ${params.proposalRef.id} v${params.proposalRef.version}\nby ${actorName(params.payload.user)}`,
            replaceOriginal: true,
          },
        }
      : {}),
  };
}

async function openFeedbackModal(params: {
  payload: SlackBlockActionPayload;
  proposalRef: SlackProposalRef;
  decision: FeedbackDecision;
}): Promise<SlackInteractionResult> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.error('SLACK_BOT_TOKEN is not configured for feedback modal');
    return blockActionError(
      params.payload,
      '修正理由Modalを開けませんでした。Slack設定を管理者に確認してください。'
    );
  }
  let response: Response;
  try {
    response = await fetch('https://slack.com/api/views.open', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        trigger_id: params.payload.trigger_id,
        view: buildFeedbackModal({
          proposal: params.proposalRef,
          decision: params.decision,
          ...(isSlackResponseUrl(params.payload.response_url)
            ? { responseUrl: params.payload.response_url }
            : {}),
          channelId: params.payload.channel?.id,
          messageTs: params.payload.message?.ts,
        }),
      }),
      signal: AbortSignal.timeout(1500),
    });
  } catch (error) {
    console.error('Slack views.open request failed', {
      message: error instanceof Error ? error.message : String(error),
    });
    return blockActionError(
      params.payload,
      '修正理由Modalを開けませんでした。時間をおいて再試行してください。'
    );
  }
  const json = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
  };
  if (json.ok) return { status: 200, body: { ok: true } };
  console.error('Slack views.open failed', {
    error: json.error ?? response.statusText,
  });
  return blockActionError(
    params.payload,
    '修正理由Modalを開けませんでした。時間をおいて再試行してください。'
  );
}

async function decideRulePatch(params: {
  supabase: SupabaseClient;
  payload: SlackBlockActionPayload;
  patchRef: SlackRulePatchRef;
  decision: 'approve' | 'reject';
}): Promise<SlackInteractionResult> {
  if (
    !isRulePatchSwitchEnabled() ||
    !isAuthorizedRulebookUser(params.payload.user.id)
  ) {
    return blockActionError(
      params.payload,
      'Rulebook変更は無効、または専用承認者として登録されていません。'
    );
  }
  const functionName =
    params.decision === 'approve'
      ? 'approve_seo_rule_patch'
      : 'reject_seo_rule_patch';
  const { data, error } = await params.supabase.rpc(functionName, {
    p_candidate_id: params.patchRef.id,
    p_candidate_version: params.patchRef.version,
    p_patch_hash: params.patchRef.hash,
    p_approver_id: params.payload.user.id,
    p_approver_name: actorName(params.payload.user),
  });
  if (error || !data) {
    console.error(`${functionName} failed`, {
      code: error?.code,
      message: error?.message,
    });
    return blockActionError(
      params.payload,
      'Rule Patchは無効・期限切れ・処理済み、またはBase Rulebookが更新済みです。'
    );
  }
  const status =
    params.decision === 'approve' &&
    typeof data === 'object' &&
    data !== null &&
    'status' in data
      ? String((data as { status: unknown }).status)
      : params.decision === 'approve'
        ? 'applied'
        : 'rejected';
  if (status === 'superseded') {
    return blockActionError(
      params.payload,
      'Base Rulebookが更新済みのため、この候補をsupersededにしました。'
    );
  }
  let afterAction: (() => Promise<void>) | undefined;
  if (params.decision === 'approve' && status === 'applied') {
    const applied = data as {
      versionId?: unknown;
      contentHash?: unknown;
      isCurrentlyActive?: unknown;
    };
    if (applied.isCurrentlyActive !== true) {
      return {
        status: 200,
        body: { ok: false },
        ...(isSlackResponseUrl(params.payload.response_url)
          ? {
              afterResponse: {
                responseUrl: params.payload.response_url,
                text: `このRule Patchは適用後にrollbackされています\nCandidate: ${params.patchRef.id}`,
                replaceOriginal: true,
              },
            }
          : {}),
      };
    }
    const versionId =
      typeof applied.versionId === 'string' ? applied.versionId : null;
    const contentHash =
      typeof applied.contentHash === 'string' ? applied.contentHash : null;
    afterAction = async () => {
      const { data: active, error: activeError } = versionId
        ? await params.supabase
            .from('seo_rulebook_versions')
            .select('id,content,content_hash,status')
            .eq('id', versionId)
            .maybeSingle()
        : { data: null, error: { message: 'missing activated version id' } };
      const parsed = rulebookContentSchema.safeParse(active?.content);
      if (
        activeError ||
        !active ||
        !contentHash ||
        active.content_hash !== contentHash ||
        !parsed.success ||
        payloadHash(parsed.data) !== contentHash
      ) {
        if (versionId && contentHash && active?.status === 'active') {
          const rollback = await params.supabase.rpc('rollback_seo_rulebook', {
            p_current_version_id: versionId,
            p_current_hash: contentHash,
            p_actor_id: params.payload.user.id,
            p_actor_name: actorName(params.payload.user),
            p_idempotency_key: `post-check:${params.patchRef.id}`,
          });
          if (
            rollback.error ||
            !rollback.data ||
            typeof rollback.data !== 'object' ||
            (rollback.data as { status?: unknown }).status !== 'rolled_back'
          ) {
            throw new Error(
              `active Rulebook post-check and rollback failed: ${
                rollback.error?.message ?? 'unknown error'
              }`
            );
          }
        }
        throw new Error('active Rulebook post-check failed; rollback requested');
      }
    };
  }
  return {
    status: 200,
    body: { ok: true },
    ...(afterAction ? { afterAction } : {}),
    ...(isSlackResponseUrl(params.payload.response_url)
      ? {
          afterResponse: {
            responseUrl: params.payload.response_url!,
            text:
              params.decision === 'approve'
                ? `Rule Patchを第二承認し、次のrunから有効化しました\nCandidate: ${params.patchRef.id}\nby ${actorName(params.payload.user)}`
                : `Rule Patchを却下しました\nCandidate: ${params.patchRef.id}\nby ${actorName(params.payload.user)}`,
            replaceOriginal: true,
          },
        }
      : {}),
  };
}

async function saveFeedback(params: {
  supabase: SupabaseClient;
  payload: SlackViewSubmissionPayload;
}): Promise<SlackInteractionResult> {
  const metadata = parseModalMetadata(params.payload.view.private_metadata);
  if (!metadata) {
    return {
      status: 200,
      body: {
        response_action: 'errors',
        errors: { feedback_reason: '提案情報が不正です。カードから開き直してください' },
      },
    };
  }
  if (
    !isAuthorizedUser(params.payload.user.id) ||
    !isAuthorizedChannel(metadata.channelId)
  ) {
    return {
      status: 200,
      body: {
        response_action: 'errors',
        errors: { feedback_reason: 'この操作を行う権限がありません' },
      },
    };
  }
  const input = extractFeedbackInput(params.payload, metadata);
  if (!input.success) {
    return {
      status: 200,
      body: { response_action: 'errors', errors: input.errors },
    };
  }
  let data: unknown;
  let error: { code?: string; message?: string } | null = null;
  try {
    const result = await params.supabase.rpc('record_seo_feedback', {
      p_proposal_id: metadata.proposal.id,
      p_proposal_version: metadata.proposal.version,
      p_proposal_payload_hash: metadata.proposal.hash,
      p_decision: metadata.decision,
      p_reason: input.data.reason,
      p_category: input.data.category,
      p_desired_change: input.data.desiredChange ?? null,
      p_general_rule_candidate: input.data.generalRuleCandidate,
      p_submitted_by_id: params.payload.user.id,
      p_submitted_by_name: actorName(params.payload.user),
      p_slack_view_id: params.payload.view.id,
      p_idempotency_key: `slack-view:${params.payload.view.id}`,
    });
    data = result.data;
    error = result.error;
  } catch (rpcError) {
    error = {
      message: rpcError instanceof Error ? rpcError.message : String(rpcError),
    };
  }
  if (error || !data) {
    console.error('record_seo_feedback failed', {
      code: error?.code,
      message: error?.message,
    });
    return {
      status: 200,
      body: {
        response_action: 'errors',
        errors: {
          feedback_reason:
            '保存できませんでした。提案が処理済みでないか確認して、カードから開き直してください',
        },
      },
    };
  }
  const responseUrl = isSlackResponseUrl(metadata.responseUrl)
    ? metadata.responseUrl
    : undefined;
  const decisionLabel =
    metadata.decision === 'rejected' ? '却下' : '修正依頼';
  return {
    status: 200,
    body: { response_action: 'clear' },
    ...(responseUrl
      ? {
          afterResponse: {
            responseUrl,
            text: `SEO提案を${decisionLabel}にしました（理由を保存済み）\nProposal: ${metadata.proposal.id} v${metadata.proposal.version}\nby ${actorName(params.payload.user)}`,
            replaceOriginal: true,
          },
        }
      : {}),
  };
}

export async function handleSlackInteraction(params: {
  supabase: SupabaseClient;
  rawBody: string;
}): Promise<SlackInteractionResult> {
  const payloadRaw = new URLSearchParams(params.rawBody).get('payload');
  if (!payloadRaw) {
    return { status: 400, body: { ok: false, message: 'payloadがありません' } };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(payloadRaw);
  } catch {
    return { status: 400, body: { ok: false, message: 'payload JSONが不正です' } };
  }

  if (
    payload &&
    typeof payload === 'object' &&
    (payload as { type?: unknown }).type === 'view_submission'
  ) {
    const parsed = slackViewSubmissionPayloadSchema.safeParse(payload);
    return parsed.success
      ? saveFeedback({ supabase: params.supabase, payload: parsed.data })
      : {
          status: 200,
          body: {
            response_action: 'errors',
            errors: { feedback_reason: 'Modal payloadが不正です' },
          },
        };
  }

  const parsed = slackBlockActionPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 400, body: { ok: false, message: 'block action payloadが不正です' } };
  }
  if (!isAuthorizedChannel(parsed.data.channel?.id)) {
    return blockActionError(parsed.data, 'この操作を行う権限がありません');
  }
  const action = parsed.data.actions[0]!;
  if (
    action.action_id === 'seo_rule_patch_approve' ||
    action.action_id === 'seo_rule_patch_reject'
  ) {
    const patchRef = parseRulePatchRef(action.value);
    if (!patchRef) {
      return blockActionError(parsed.data, 'Rule Patch参照が不正です。');
    }
    return decideRulePatch({
      supabase: params.supabase,
      payload: parsed.data,
      patchRef,
      decision:
        action.action_id === 'seo_rule_patch_approve' ? 'approve' : 'reject',
    });
  }
  if (!isAuthorizedUser(parsed.data.user.id)) {
    return blockActionError(parsed.data, 'この操作を行う権限がありません');
  }
  const proposalRef = parseProposalRef(action.value);
  if (!proposalRef) {
    return blockActionError(
      parsed.data,
      '古い形式の承認カードは無効です。新しい承認通知を使用してください。'
    );
  }
  if (action.action_id === 'seo_approve') {
    return approveProposal({
      supabase: params.supabase,
      payload: parsed.data,
      proposalRef,
    });
  }
  return openFeedbackModal({
    payload: parsed.data,
    proposalRef,
    decision: action.action_id === 'seo_reject' ? 'rejected' : 'revision_requested',
  });
}

export async function replaceSlackOriginalMessage(
  params: SlackAfterResponse
): Promise<void> {
  if (!isSlackResponseUrl(params.responseUrl)) return;
  const text = params.text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .slice(0, 2900);
  const response = await fetch(params.responseUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      ...(params.replaceOriginal
        ? { replace_original: true }
        : { response_type: 'ephemeral', replace_original: false }),
      text,
    }),
    signal: AbortSignal.timeout(1500),
  });
  if (!response.ok) {
    console.error('Slack response_url update failed', { status: response.status });
  }
}
