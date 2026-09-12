import * as crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  handleSlackInteraction,
} from '../../lib/seo-loop/slack-interactions/handler';
import {
  buildFeedbackModal,
  extractFeedbackInput,
  parseModalMetadata,
} from '../../lib/seo-loop/slack-interactions/modal';
import {
  parseProposalRef,
  slackBlockActionPayloadSchema,
  slackViewSubmissionPayloadSchema,
  type SlackModalMetadata,
} from '../../lib/seo-loop/slack-interactions/types';
import { verifySlackSignature } from '../../lib/seo-loop/slack';

const proposalRef = {
  id: '11111111-1111-4111-8111-111111111111',
  version: 2,
  hash: 'a'.repeat(64),
};
const metadata: SlackModalMetadata = {
  proposal: proposalRef,
  decision: 'revision_requested',
  responseUrl: 'https://hooks.slack.com/actions/T/B/token',
  channelId: 'C123',
  messageTs: '123.456',
};

function formBody(payload: unknown): string {
  return new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
}

function blockPayload(actionId: 'seo_approve' | 'seo_reject' | 'seo_revision_requested') {
  return {
    type: 'block_actions',
    user: { id: 'U123', name: '匿名管理者' },
    trigger_id: 'trigger-123',
    response_url: 'https://hooks.slack.com/actions/T/B/token',
    channel: { id: 'C123' },
    message: { ts: '123.456' },
    actions: [{ action_id: actionId, value: JSON.stringify(proposalRef) }],
  };
}

function viewPayload(overrides?: {
  reason?: string;
  desiredChange?: string;
  category?: string;
}) {
  return {
    type: 'view_submission',
    user: { id: 'U123', name: '匿名管理者' },
    view: {
      id: 'V123',
      callback_id: 'seo_feedback_modal',
      private_metadata: JSON.stringify(metadata),
      state: {
        values: {
          feedback_reason: {
            reason_input: {
              type: 'plain_text_input',
              value: overrides?.reason ?? '検索意図との対応が弱いため修正が必要です',
            },
          },
          feedback_category: {
            category_select: {
              type: 'static_select',
              selected_option: {
                value: overrides?.category ?? 'search_intent_mismatch',
              },
            },
          },
          desired_change: {
            desired_change_input: {
              type: 'plain_text_input',
              value: overrides?.desiredChange ?? '対象クエリを自然に含む表現へ変更してください',
            },
          },
          general_rule: {
            general_rule_check: {
              type: 'checkboxes',
              selected_options: [{ value: 'yes' }],
            },
          },
        },
      },
    },
  };
}

function fakeSupabase(params?: {
  rpcError?: { message: string } | null;
  stale?: boolean;
  calls?: Array<{ kind: string; value: unknown }>;
}): SupabaseClient {
  const calls = params?.calls ?? [];
  return {
    from(table: string) {
      let operation: 'select' | 'update' = 'select';
      let updateValue: unknown;
      const builder = {
        select() {
          return builder;
        },
        update(value: unknown) {
          operation = 'update';
          updateValue = value;
          calls.push({ kind: `update:${table}`, value });
          return builder;
        },
        eq() {
          return builder;
        },
        async maybeSingle() {
          if (table === 'seo_proposals' && operation === 'select') {
            return params?.stale
              ? { data: null, error: null }
              : {
                  data: {
                    ...proposalRef,
                    payload_hash: proposalRef.hash,
                    status: 'pending_approval',
                    seo_approvals: [
                      {
                        id: '22222222-2222-4222-8222-222222222222',
                        status: 'pending',
                        proposal_version: proposalRef.version,
                        proposal_payload_hash: proposalRef.hash,
                      },
                    ],
                  },
                  error: null,
                };
          }
          if (operation === 'update') {
            return {
              data: { id: table === 'seo_approvals' ? 'approval-id' : 'proposal-id' },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      };
      void updateValue;
      return builder;
    },
    async rpc(name: string, args: unknown) {
      calls.push({ kind: `rpc:${name}`, value: args });
      return params?.rpcError || params?.stale
        ? { data: null, error: params?.rpcError ?? { message: 'stale proposal' } }
        : { data: '33333333-3333-4333-8333-333333333333', error: null };
    },
  } as unknown as SupabaseClient;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.stubEnv('SLACK_SEO_APPROVER_IDS', 'U123,U999');
  vi.stubEnv('SLACK_SEO_CHANNEL_ID', 'C123');
});

describe('Slack Modal schema', () => {
  it('proposal id/version/hashを固定してModalを構築する', () => {
    const modal = buildFeedbackModal(metadata);
    expect(modal.callback_id).toBe('seo_feedback_modal');
    expect(JSON.parse(modal.private_metadata)).toEqual(metadata);
    expect(modal.blocks.find((block) => block.block_id === 'desired_change')).toMatchObject({
      optional: false,
    });
    expect(parseProposalRef(JSON.stringify(proposalRef))).toEqual(proposalRef);
    expect(parseProposalRef(proposalRef.id)).toBeNull();
  });

  it('修正依頼では理由・分類・望ましい修正を必須にする', () => {
    const payload = slackViewSubmissionPayloadSchema.parse(
      viewPayload({ reason: '短', desiredChange: '' })
    );
    const result = extractFeedbackInput(payload, metadata);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toHaveProperty('feedback_reason');
      expect(result.errors).toHaveProperty('desired_change');
    }
  });

  it('有効な入力をtrimし、一般ルール候補を読み取る', () => {
    const payload = slackViewSubmissionPayloadSchema.parse(viewPayload());
    const result = extractFeedbackInput(payload, metadata);
    expect(result).toMatchObject({
      success: true,
      data: {
        category: 'search_intent_mismatch',
        generalRuleCandidate: true,
      },
    });
    expect(parseModalMetadata(payload.view.private_metadata)).toEqual(metadata);
  });

  it('却下では望ましい修正を任意にする', () => {
    const rejectedMetadata: SlackModalMetadata = {
      ...metadata,
      decision: 'rejected',
    };
    const payload = slackViewSubmissionPayloadSchema.parse(
      viewPayload({ desiredChange: '' })
    );
    expect(extractFeedbackInput(payload, rejectedMetadata)).toMatchObject({
      success: true,
      data: { desiredChange: undefined },
    });
  });
});

describe('Slack署名検証', () => {
  it('正しい署名だけを受理し、5分超過を拒否する', () => {
    const signingSecret = 'test-signing-secret';
    const rawBody = formBody(blockPayload('seo_approve'));
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = `v0=${crypto
      .createHmac('sha256', signingSecret)
      .update(`v0:${timestamp}:${rawBody}`)
      .digest('hex')}`;
    expect(
      verifySlackSignature({ signingSecret, timestamp, signature, rawBody })
    ).toBe(true);
    expect(
      verifySlackSignature({
        signingSecret,
        timestamp: String(Number(timestamp) - 301),
        signature,
        rawBody,
      })
    ).toBe(false);
  });
});

describe('Slack interaction handler', () => {
  it('却下ボタンでは状態を変更せずModalを開く', async () => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'test-token');
    const calls: Array<{ kind: string; value: unknown }> = [];
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true }),
      statusText: 'OK',
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await handleSlackInteraction({
      supabase: fakeSupabase({ calls }),
      rawBody: formBody(slackBlockActionPayloadSchema.parse(blockPayload('seo_reject'))),
    });

    expect(result).toMatchObject({ status: 200, body: { ok: true } });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://slack.com/api/views.open');
    expect(calls.some((call) => call.kind.startsWith('update:'))).toBe(false);
    expect(calls.some((call) => call.kind.startsWith('rpc:'))).toBe(false);
  });

  it('Slack APIがJSON以外を返しても利用者へephemeralエラーを返す', async () => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'test-token');
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => {
          throw new Error('not json');
        },
        statusText: 'Bad Gateway',
      })
    );
    const result = await handleSlackInteraction({
      supabase: fakeSupabase(),
      rawBody: formBody(blockPayload('seo_reject')),
    });
    expect(result.body).toEqual({ ok: false });
    expect(result.afterResponse).toMatchObject({
      replaceOriginal: false,
      responseUrl: 'https://hooks.slack.com/actions/T/B/token',
    });
  });

  it('Modal送信を原子的feedback保存RPCへ渡す', async () => {
    const calls: Array<{ kind: string; value: unknown }> = [];
    const result = await handleSlackInteraction({
      supabase: fakeSupabase({ calls }),
      rawBody: formBody(viewPayload()),
    });

    expect(result.body).toEqual({ response_action: 'clear' });
    expect(result.afterResponse?.responseUrl).toBe(metadata.responseUrl);
    expect(calls).toContainEqual(
      expect.objectContaining({
        kind: 'rpc:record_seo_feedback',
        value: expect.objectContaining({
          p_proposal_id: proposalRef.id,
          p_proposal_version: proposalRef.version,
          p_proposal_payload_hash: proposalRef.hash,
          p_decision: 'revision_requested',
          p_general_rule_candidate: true,
          p_idempotency_key: 'slack-view:V123',
        }),
      })
    );
  });

  it('承認をversion/hash固定の原子的RPCへ渡す', async () => {
    const calls: Array<{ kind: string; value: unknown }> = [];
    const result = await handleSlackInteraction({
      supabase: fakeSupabase({ calls }),
      rawBody: formBody(blockPayload('seo_approve')),
    });
    expect(result.body).toEqual({ ok: true });
    expect(calls).toContainEqual(
      expect.objectContaining({
        kind: 'rpc:approve_seo_proposal',
        value: expect.objectContaining({
          p_proposal_id: proposalRef.id,
          p_proposal_version: proposalRef.version,
          p_proposal_payload_hash: proposalRef.hash,
        }),
      })
    );
  });

  it('古いカードと二重操作を拒否する', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const staleResult = await handleSlackInteraction({
      supabase: fakeSupabase({ stale: true }),
      rawBody: formBody(blockPayload('seo_approve')),
    });
    expect(staleResult.body).toMatchObject({ ok: false });

    const duplicateResult = await handleSlackInteraction({
      supabase: fakeSupabase({ rpcError: { message: 'stale proposal' } }),
      rawBody: formBody(viewPayload()),
    });
    expect(duplicateResult.body).toMatchObject({
      response_action: 'errors',
      errors: { feedback_reason: expect.any(String) },
    });
  });

  it('許可されていない利用者とチャンネルの操作を拒否する', async () => {
    const calls: Array<{ kind: string; value: unknown }> = [];
    const unauthorized = {
      ...blockPayload('seo_approve'),
      user: { id: 'U-NOT-ALLOWED' },
    };
    const result = await handleSlackInteraction({
      supabase: fakeSupabase({ calls }),
      rawBody: formBody(unauthorized),
    });
    expect(result.body).toEqual({ ok: false });
    expect(result.afterResponse).toMatchObject({ replaceOriginal: false });
    expect(calls).toHaveLength(0);
  });

  it('Slack以外のresponse_urlへは送信しない', async () => {
    const calls: Array<{ kind: string; value: unknown }> = [];
    const payload = {
      ...blockPayload('seo_approve'),
      response_url: 'https://attacker.invalid/callback',
    };
    const result = await handleSlackInteraction({
      supabase: fakeSupabase({ calls }),
      rawBody: formBody(payload),
    });
    expect(result.body).toEqual({ ok: true });
    expect(result.afterResponse).toBeUndefined();
  });
});
