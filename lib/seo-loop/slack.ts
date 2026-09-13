import * as crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  existingInternalLinkCount,
  isStructuredTextAction,
  summarizeTextChange,
} from './content-change';
import { proposalPayloadV2Schema, type ProposalPayloadV2 } from './types';
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

function linkChangeLine(target: ProposalPayloadV2['targets'][number]): string {
  const existing = existingInternalLinkCount(target.currentValue);
  const countLabel =
    existing === null
      ? '既存リンク件数は不明です'
      : `内部リンク ${existing}件 → ${existing + 1}件`;
  return `• 追加リンク: ${safeSlackValue(target.proposedValue, 300)}\n  ${countLabel}`;
}

function textChangeLine(target: ProposalPayloadV2['targets'][number]): string {
  const change = summarizeTextChange(target.currentValue, target.proposedValue);
  const delta = change.proposedLength - change.currentLength;
  const percent =
    change.currentLength === 0 ? 0 : Math.round((delta / change.currentLength) * 100);
  const signed = (value: number): string => (value >= 0 ? `+${value}` : `${value}`);
  const lines = [
    `• 文字数: ${change.currentLength} → ${change.proposedLength} (${signed(delta)} / ${signed(percent)}%)`,
  ];
  if (change.removedHeadings.length > 0) {
    lines.push(
      `  削除される見出し: ${safeSlackValue(change.removedHeadings.join(' / '), 300)}`
    );
  }
  if (change.addedHeadings.length > 0) {
    lines.push(
      `  追加される見出し: ${safeSlackValue(change.addedHeadings.join(' / '), 300)}`
    );
  }
  if (change.removedBulletCount > 0 || change.addedBulletCount > 0) {
    lines.push(
      `  箇条書き: 削除${change.removedBulletCount}件 / 追加${change.addedBulletCount}件`
    );
  }
  lines.push(
    `  行単位: 削除${change.removedLineCount}行 / 追加${change.addedLineCount}行`
  );
  return lines.join('\n');
}

/** 承認者が変更前後の差分を一目で判断できるよう、変更内容を要約する */
export function changeOverview(proposal: ProposalPayloadV2): string {
  return proposal.targets
    .map((target) => {
      if (proposal.action === 'addApprovedInternalLink') return linkChangeLine(target);
      if (isStructuredTextAction(proposal.action)) return textChangeLine(target);
      return `• 文字数: ${target.currentValue.trim().length} → ${target.proposedValue.trim().length}`;
    })
    .join('\n');
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
        `• \`${safeSlackValue(`${target.type}:${target.id}`, 150)}\`\n  対象URL: ${safeSlackValue(target.url, 200)}\n  変更前: ${safeSlackValue(target.currentValue, 300)}\n  変更後: ${safeSlackValue(target.proposedValue, 300)}`
    )
    .join('\n');
  const evidence = proposal.facts
    .slice(0, 3)
    .map((fact) => `• [${fact.source}] ${safeSlackValue(fact.statement, 250)}`)
    .join('\n');
  const warnings =
    evaluation.warnings.length > 0
      ? `\n*警告*\n${evaluation.warnings.map((warning) => `• ${safeSlackValue(warning, 250)}`).join('\n')}`
      : '';
  const hardGateWarnings = evaluation.hardGateResults
    .filter((result) => result.severity === 'warn' && !result.passed)
    .map((result) => `• ${safeSlackValue(result.message, 250)}`);
  const hardGateWarningText =
    hardGateWarnings.length > 0
      ? `\n*Hard Gate警告（承認は可能）*\n${hardGateWarnings.join('\n')}`
      : '';
  return truncateSlack(
    `*評価* ${evaluation.softEval.totalScore}/100 / Risk: \`${evaluation.riskLevel}\`${warnings}${hardGateWarningText}\n\n*変更内容*\n${changeOverview(proposal)}\n\n*変更前後の値*\n${targets}\n\n*根拠*\n${evidence}`,
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
              text: `*SEO Rulebook変更の第二承認（shadow開始）*\nBase: \`v${params.candidate.base_rulebook_version} ${params.candidate.base_rulebook_hash.slice(0, 12)}...\`\nPath: \`${safeSlackValue(params.candidate.patch_path, 180)}\`\nNew value: \`${safeSlackValue(String(patch.value), 100)}\`\nEvidence: \`${params.candidate.evidence_count} independent feedbacks\`\nPatch hash: \`${params.candidate.patch_hash.slice(0, 12)}...\`\nProposed content: \`${params.candidate.proposed_content_hash.slice(0, 12)}...\`\n承認後もactive版は変わらず、7 run以上の比較と最終昇格承認が必要です。`,
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Shadow開始を承認' },
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

function percent(value: number | null): string {
  return value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`;
}

export async function notifySlackRolloutPromotion(params: {
  supabase: SupabaseClient;
  rollout: {
    id: string;
    candidate_id: string;
    candidate_version: number;
    patch_hash: string;
    base_rulebook_version: number;
    base_rulebook_hash: string;
    shadow_content_hash: string;
    status: string;
    slack_message_ts: string | null;
    metrics: {
      metricsHash: string;
      samples: {
        runs: number;
        evaluatedProposals: number;
        mainObservedDecisions: number;
      };
      metrics: {
        proposalGenerationRate: {
          main: { rate: number | null };
          shadow: { rate: number | null };
        };
        slackReachabilityRate: {
          main: { rate: number | null };
          shadow: { rate: number | null };
        };
        hardGatePassRate: {
          main: { rate: number | null };
          shadow: { rate: number | null };
        };
        approvalRate: {
          main: { rate: number | null };
          shadowProjected: { rate: number | null };
        };
        revisionRate: {
          main: { rate: number | null };
          shadowProjected: { rate: number | null };
        };
        sameCorrectionRecurrenceRate: {
          main: { rate: number | null };
          shadowProjected: { rate: number | null };
        };
      };
    };
  };
}): Promise<boolean> {
  if (
    params.rollout.status !== 'ready' ||
    params.rollout.slack_message_ts
  ) {
    return false;
  }
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_SEO_CHANNEL_ID;
  if (!token || !channel) return false;

  const { data: claimed, error: claimError } = await params.supabase
    .from('seo_rulebook_rollouts')
    .update({ notify_attempted_at: new Date().toISOString() })
    .eq('id', params.rollout.id)
    .eq('status', 'ready')
    .is('notify_attempted_at', null)
    .select('id')
    .maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return false;

  const ref = JSON.stringify({
    kind: 'rulebook_rollout',
    id: params.rollout.id,
    candidateId: params.rollout.candidate_id,
    candidateVersion: params.rollout.candidate_version,
    patchHash: params.rollout.patch_hash,
    shadowHash: params.rollout.shadow_content_hash,
    metricsHash: params.rollout.metrics.metricsHash,
  });
  const metrics = params.rollout.metrics.metrics;
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      channel,
      text: 'SEO Rulebook shadow比較が昇格基準を満たしました',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*SEO Rulebook 最終昇格承認*\nBase: \`v${params.rollout.base_rulebook_version} ${params.rollout.base_rulebook_hash.slice(0, 12)}...\`\nShadow: \`${params.rollout.shadow_content_hash.slice(0, 12)}...\`\nSamples: ${params.rollout.metrics.samples.runs} runs / ${params.rollout.metrics.samples.evaluatedProposals} proposals / ${params.rollout.metrics.samples.mainObservedDecisions} decisions\n提案生成率: ${percent(metrics.proposalGenerationRate.main.rate)} → ${percent(metrics.proposalGenerationRate.shadow.rate)} (risk-only patchのため同一)\nSlack到達可能率: ${percent(metrics.slackReachabilityRate.main.rate)} → ${percent(metrics.slackReachabilityRate.shadow.rate)}\nHard Gate通過率: ${percent(metrics.hardGatePassRate.main.rate)} → ${percent(metrics.hardGatePassRate.shadow.rate)}\n承認率: ${percent(metrics.approvalRate.main.rate)} → ${percent(metrics.approvalRate.shadowProjected.rate)} (projected)\n修正率: ${percent(metrics.revisionRate.main.rate)} → ${percent(metrics.revisionRate.shadowProjected.rate)} (projected)\n同じ修正の再発率: ${percent(metrics.sameCorrectionRecurrenceRate.main.rate)} → ${percent(metrics.sameCorrectionRecurrenceRate.shadowProjected.rate)} (projected)\nこの操作で初めて新版がactiveになります。`,
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: '新版を主系へ昇格' },
              style: 'primary',
              action_id: 'seo_rulebook_rollout_promote',
              value: ref,
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Rolloutを却下' },
              style: 'danger',
              action_id: 'seo_rulebook_rollout_reject',
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
    await params.supabase
      .from('seo_rulebook_rollouts')
      .update({
        status: 'shadowing',
        notify_attempted_at: null,
        ready_at: null,
      })
      .eq('id', params.rollout.id)
      .eq('status', 'ready');
    throw new Error(
      `Rollout昇格Slack通知に失敗しました: ${json.error ?? response.statusText}`
    );
  }
  const { error: updateError } = await params.supabase
    .from('seo_rulebook_rollouts')
    .update({ slack_channel: channel, slack_message_ts: json.ts ?? null })
    .eq('id', params.rollout.id)
    .eq('status', 'ready');
  if (updateError) throw updateError;
  return true;
}
