import * as crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { proposalPayloadV2Schema } from './types';
import type { ProposalEvaluationResult } from './evaluation/types';

type SeoProposalForSlack = {
  id: string;
  version: number;
  payload_hash: string;
  action: string;
  rationale: string | null;
  payload: unknown;
  parent_proposal_id?: string | null;
  revision_number?: number;
};

type SeoRulePatchForSlack = {
  id: string;
  candidate_version: number;
  base_rulebook_version: number;
  base_rulebook_hash: string;
  patch_path: string;
  patch: unknown;
  patch_hash: string;
  proposed_content_hash: string;
  evidence_count: number;
  status: string;
  slack_message_ts: string | null;
};

function truncateSlack(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, Math.max(0, max - 1))}…`;
}

function safeSlackValue(value: string, max: number): string {
  return truncateSlack(value, max)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`/g, 'ˋ');
}

export function approvalDetails(
  payload: unknown,
  evaluation: ProposalEvaluationResult
): string {
  const parsed = proposalPayloadV2Schema.safeParse(payload);
  if (!parsed.success) return 'Proposal v2の表示データを解析できません。';
  const proposal = parsed.data;
  const targets = proposal.targets
    .map(
      (target) =>
        `• \`${safeSlackValue(`${target.type}:${target.id}`, 150)}\`\n  現在: ${safeSlackValue(target.currentValue, 350)}\n  提案: ${safeSlackValue(target.proposedValue, 350)}`
    )
    .join('\n');
  const evidence = proposal.facts
    .slice(0, 3)
    .map((fact) => `• [${fact.source}] ${safeSlackValue(fact.statement, 300)}`)
    .join('\n');
  const warnings =
    evaluation.warnings.length > 0
      ? `\n*警告*\n${evaluation.warnings.map((warning) => `• ${safeSlackValue(warning, 250)}`).join('\n')}`
      : '';
  return truncateSlack(
    `*評価* ${evaluation.softEval.totalScore}/100 / Risk: \`${evaluation.riskLevel}\`${warnings}\n\n*対象と実測値*\n${targets}\n\n*根拠*\n${evidence}`,
    2900
  );
}

export function verifySlackSignature(params: {
  signingSecret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
}): boolean {
  if (!params.timestamp || !params.signature) return false;

  const age = Math.abs(Date.now() / 1000 - Number(params.timestamp));
  if (!Number.isFinite(age) || age > 60 * 5) return false;

  const base = `v0:${params.timestamp}:${params.rawBody}`;
  const expected = `v0=${crypto
    .createHmac('sha256', params.signingSecret)
    .update(base)
    .digest('hex')}`;

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(params.signature);
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function notifySlackLoopStatus(params: {
  text: string;
}): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_SEO_CHANNEL_ID;
  if (!token || !channel) return;

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel,
      text: safeSlackValue(params.text, 2900),
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: safeSlackValue(params.text, 2900),
          },
        },
      ],
    }),
  });

  const json = (await response.json()) as { ok?: boolean; error?: string };
  if (!json.ok) {
    throw new Error(`Slackステータス通知に失敗しました: ${json.error ?? response.statusText}`);
  }
}

export async function notifySlackApproval(params: {
  supabase: SupabaseClient;
  proposal: SeoProposalForSlack;
  evaluation: ProposalEvaluationResult;
}): Promise<void> {
  const { data: existing, error: existingError } = await params.supabase
    .from('seo_approvals')
    .select('id,status,slack_message_ts')
    .eq('proposal_id', params.proposal.id)
    .eq('proposal_version', params.proposal.version)
    .eq('proposal_payload_hash', params.proposal.payload_hash)
    .maybeSingle();

  if (existingError) throw existingError;
  const hasFinalDecision = existing?.status !== undefined && existing.status !== 'pending';
  if (existing?.slack_message_ts || hasFinalDecision) {
    return;
  }

  const approvalId = existing?.id ?? null;
  if (!approvalId) {
    const { error } = await params.supabase.from('seo_approvals').insert({
      proposal_id: params.proposal.id,
      proposal_version: params.proposal.version,
      proposal_payload_hash: params.proposal.payload_hash,
      status: 'pending',
    });

    if (error) throw error;
  }

  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_SEO_CHANNEL_ID;

  if (!token || !channel) {
    return;
  }

  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel,
      text: `SEO proposal approval: ${params.proposal.action}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: truncateSlack(
              `*SEO提案の承認依頼*${
                (params.proposal.revision_number ?? 0) > 0
                  ? `\nRevision: \`${params.proposal.revision_number}\` / Parent: \`${safeSlackValue(params.proposal.parent_proposal_id ?? '', 80)}\``
                  : ''
              }\nAction: \`${params.proposal.action}\`\nHash: \`${params.proposal.payload_hash.slice(0, 12)}...\`\n${safeSlackValue(params.proposal.rationale ?? '', 2000)}`,
              2900
            ),
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: approvalDetails(params.proposal.payload, params.evaluation),
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '承認' },
              style: 'primary',
              action_id: 'seo_approve',
              value: JSON.stringify({
                id: params.proposal.id,
                version: params.proposal.version,
                hash: params.proposal.payload_hash,
              }),
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '却下' },
              style: 'danger',
              action_id: 'seo_reject',
              value: JSON.stringify({
                id: params.proposal.id,
                version: params.proposal.version,
                hash: params.proposal.payload_hash,
              }),
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '修正依頼' },
              action_id: 'seo_revision_requested',
              value: JSON.stringify({
                id: params.proposal.id,
                version: params.proposal.version,
                hash: params.proposal.payload_hash,
              }),
            },
          ],
        },
      ],
    }),
  });

  const json = (await response.json()) as { ok?: boolean; ts?: string; error?: string };
  if (!json.ok) {
    throw new Error(`Slack通知に失敗しました: ${json.error ?? response.statusText}`);
  }

  const { error } = await params.supabase.from('seo_approvals').update(
    {
      slack_channel: channel,
      slack_message_ts: json.ts ?? null,
    }
  )
    .eq('proposal_id', params.proposal.id)
    .eq('proposal_version', params.proposal.version)
    .eq('proposal_payload_hash', params.proposal.payload_hash);

  if (error) throw error;
}

export async function notifySlackRulePatchApproval(params: {
  supabase: SupabaseClient;
  candidate: SeoRulePatchForSlack;
}): Promise<boolean> {
  if (
    params.candidate.status !== 'pending_approval' ||
    params.candidate.slack_message_ts
  ) {
    return false;
  }
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_SEO_CHANNEL_ID;
  if (!token || !channel) return false;

  const patch =
    params.candidate.patch &&
    typeof params.candidate.patch === 'object' &&
    'value' in params.candidate.patch
      ? (params.candidate.patch as { value: unknown })
      : { value: '?' };
  const { data: claimed, error: attemptError } = await params.supabase
    .from('seo_rule_patch_candidates')
    .update({ notify_attempted_at: new Date().toISOString() })
    .eq('id', params.candidate.id)
    .eq('status', 'pending_approval')
    .is('notify_attempted_at', null)
    .select('id')
    .maybeSingle();
  if (attemptError) throw attemptError;
  if (!claimed) return false;

  const ref = JSON.stringify({
    kind: 'rulebook_patch',
    id: params.candidate.id,
    version: params.candidate.candidate_version,
    hash: params.candidate.patch_hash,
  });
  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel,
        text: `SEO Rulebook patch approval: ${params.candidate.patch_path}`,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*SEO Rulebook変更の第二承認*\nBase: \`v${params.candidate.base_rulebook_version} ${params.candidate.base_rulebook_hash.slice(0, 12)}...\`\nPath: \`${safeSlackValue(params.candidate.patch_path, 180)}\`\nNew value: \`${safeSlackValue(String(patch.value), 100)}\`\nEvidence: \`${params.candidate.evidence_count} independent feedbacks\`\nPatch hash: \`${params.candidate.patch_hash.slice(0, 12)}...\`\nProposed content: \`${params.candidate.proposed_content_hash.slice(0, 12)}...\``,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Rulebookへ適用' },
                style: 'primary',
                action_id: 'seo_rule_patch_approve',
                value: ref,
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Rule Patchを却下' },
                style: 'danger',
                action_id: 'seo_rule_patch_reject',
                value: ref,
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      ts?: string;
      error?: string;
    };
    if (!json.ok) {
      throw new Error(
        `Rule Patch Slack通知に失敗しました: ${json.error ?? response.statusText}`
      );
    }
    const { error } = await params.supabase
      .from('seo_rule_patch_candidates')
      .update({ slack_channel: channel, slack_message_ts: json.ts ?? null })
      .eq('id', params.candidate.id)
      .eq('status', 'pending_approval');
    if (error) throw error;
  } catch (error) {
    await params.supabase
      .from('seo_rule_patch_candidates')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', params.candidate.id)
      .eq('status', 'pending_approval');
    throw error;
  }
  return true;
}
