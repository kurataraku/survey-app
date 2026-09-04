import * as crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

type SeoProposalForSlack = {
  id: string;
  version: number;
  payload_hash: string;
  action: string;
  rationale: string | null;
  payload: unknown;
};

type SlackInteractionAction = {
  action_id?: string;
  value?: string;
};

type SlackInteractionPayload = {
  type?: string;
  user?: { id?: string; name?: string; username?: string };
  actions?: SlackInteractionAction[];
  response_url?: string;
  channel?: { id?: string };
  message?: { ts?: string };
};

async function replaceSlackOriginalMessage(params: {
  responseUrl?: string;
  text: string;
}): Promise<void> {
  if (!params.responseUrl) return;

  await fetch(params.responseUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      replace_original: true,
      text: params.text,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: params.text,
          },
        },
      ],
    }),
  });
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

export async function notifySlackApproval(params: {
  supabase: SupabaseClient;
  proposal: SeoProposalForSlack;
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
            text: `*SEO提案の承認依頼*\nAction: \`${params.proposal.action}\`\nHash: \`${params.proposal.payload_hash.slice(0, 12)}...\`\n${params.proposal.rationale ?? ''}`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `\`\`\`${JSON.stringify(params.proposal.payload, null, 2).slice(0, 2500)}\`\`\``,
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
              value: params.proposal.id,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '却下' },
              style: 'danger',
              action_id: 'seo_reject',
              value: params.proposal.id,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: '修正依頼' },
              action_id: 'seo_revision_requested',
              value: params.proposal.id,
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

export async function handleSlackInteraction(params: {
  supabase: SupabaseClient;
  rawBody: string;
}): Promise<{ ok: boolean; message: string }> {
  const form = new URLSearchParams(params.rawBody);
  const payloadRaw = form.get('payload');
  if (!payloadRaw) return { ok: false, message: 'payload がありません' };

  const payload = JSON.parse(payloadRaw) as SlackInteractionPayload;
  const action = payload.actions?.[0];
  const proposalId = action?.value;
  if (!proposalId || !action?.action_id) {
    return { ok: false, message: 'Slack action payload が不正です' };
  }

  const status =
    action.action_id === 'seo_approve'
      ? 'approved'
      : action.action_id === 'seo_reject'
        ? 'rejected'
        : 'revision_requested';

  const { data: proposal, error: proposalError } = await params.supabase
    .from('seo_proposals')
    .select('id,version,payload_hash')
    .eq('id', proposalId)
    .single();

  if (proposalError) throw proposalError;

  const { error } = await params.supabase
    .from('seo_approvals')
    .update({
      status,
      approver_id: payload.user?.id ?? null,
      approver_name: payload.user?.name ?? payload.user?.username ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq('proposal_id', proposal.id)
    .eq('proposal_version', proposal.version)
    .eq('proposal_payload_hash', proposal.payload_hash);

  if (error) throw error;

  const { error: proposalUpdateError } = await params.supabase
    .from('seo_proposals')
    .update({ status })
    .eq('id', proposal.id)
    .eq('version', proposal.version)
    .eq('payload_hash', proposal.payload_hash);
  if (proposalUpdateError) throw proposalUpdateError;

  const statusLabel =
    status === 'approved' ? '承認済み' : status === 'rejected' ? '却下' : '修正依頼';
  const actor = payload.user?.name ?? payload.user?.username ?? payload.user?.id ?? 'unknown';
  const confirmation = `*SEO提案を${statusLabel}にしました*\nAction proposal: \`${proposalId}\`\nby ${actor}\n（実行は \`SEO_LOOP_EXECUTION_ENABLED\` が true のときのみ）`;

  await replaceSlackOriginalMessage({
    responseUrl: payload.response_url,
    text: confirmation,
  });

  return { ok: true, message: `proposalを${status}に更新しました` };
}
