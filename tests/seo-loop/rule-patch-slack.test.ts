import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleSlackInteraction } from '../../lib/seo-loop/slack-interactions/handler';
import { payloadHash } from '../../lib/seo-loop/hash';
import { FALLBACK_RULEBOOK } from '../../lib/seo-loop/rulebook/schema';

const ref = {
  kind: 'rulebook_patch',
  id: '11111111-1111-4111-8111-111111111111',
  version: 1,
  hash: 'a'.repeat(64),
};

function body(actionId: 'seo_rule_patch_approve' | 'seo_rule_patch_reject') {
  return new URLSearchParams({
    payload: JSON.stringify({
      type: 'block_actions',
      user: { id: 'U-RULE', name: 'Rulebook Owner' },
      trigger_id: 'trigger',
      response_url: 'https://hooks.slack.com/actions/T/B/token',
      channel: { id: 'C123' },
      actions: [{ action_id: actionId, value: JSON.stringify(ref) }],
    }),
  }).toString();
}

function fakeSupabase(params?: {
  rpcError?: { code?: string; message: string };
  isCurrentlyActive?: boolean;
  calls?: Array<{ name: string; args: unknown }>;
}): SupabaseClient {
  const calls = params?.calls ?? [];
  return {
    async rpc(name: string, args: unknown) {
      calls.push({ name, args });
      if (params?.rpcError) return { data: null, error: params.rpcError };
      if (name === 'approve_seo_rule_patch') {
        return {
          data: {
            status: 'applied',
            versionId: '22222222-2222-4222-8222-222222222222',
            contentHash: payloadHash(FALLBACK_RULEBOOK),
            isCurrentlyActive: params?.isCurrentlyActive ?? true,
          },
          error: null,
        };
      }
      return {
        data: '11111111-1111-4111-8111-111111111111',
        error: null,
      };
    },
    from() {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        async maybeSingle() {
          return {
            data: {
              id: '22222222-2222-4222-8222-222222222222',
              content: FALLBACK_RULEBOOK,
              content_hash: payloadHash(FALLBACK_RULEBOOK),
              status: 'active',
            },
            error: null,
          };
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

beforeEach(() => {
  vi.stubEnv('SLACK_SEO_CHANNEL_ID', 'C123');
  vi.stubEnv('SLACK_SEO_RULEBOOK_APPROVER_IDS', 'U-RULE');
  vi.stubEnv('SEO_RULEBOOK_PATCH_ENABLED', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Rule Patch Slack第二承認', () => {
  it('一人運用者のcandidate version/hashを固定してactive化RPCへ渡す', async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const result = await handleSlackInteraction({
      supabase: fakeSupabase({ calls }),
      rawBody: body('seo_rule_patch_approve'),
    });
    expect(result.body).toEqual({ ok: true });
    expect(calls[0]).toEqual({
      name: 'approve_seo_rule_patch',
      args: expect.objectContaining({
        p_candidate_id: ref.id,
        p_candidate_version: ref.version,
        p_patch_hash: ref.hash,
        p_approver_id: 'U-RULE',
      }),
    });
  });

  it('専用kill switchがfalseならRPCを呼ばない', async () => {
    vi.stubEnv('SEO_RULEBOOK_PATCH_ENABLED', 'false');
    const calls: Array<{ name: string; args: unknown }> = [];
    const result = await handleSlackInteraction({
      supabase: fakeSupabase({ calls }),
      rawBody: body('seo_rule_patch_approve'),
    });
    expect(result.body).toEqual({ ok: false });
    expect(calls).toHaveLength(0);
  });

  it('専用承認者以外を拒否する', async () => {
    vi.stubEnv('SLACK_SEO_RULEBOOK_APPROVER_IDS', 'U-OTHER');
    const calls: Array<{ name: string; args: unknown }> = [];
    const result = await handleSlackInteraction({
      supabase: fakeSupabase({ calls }),
      rawBody: body('seo_rule_patch_reject'),
    });
    expect(result.body).toEqual({ ok: false });
    expect(calls).toHaveLength(0);
  });

  it('DBがstale候補を拒否したら適用済みにしない', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await handleSlackInteraction({
      supabase: fakeSupabase({
        rpcError: {
          code: 'P0001',
          message: 'stale rule patch candidate',
        },
      }),
      rawBody: body('seo_rule_patch_approve'),
    });
    expect(result.body).toEqual({ ok: false });
    expect(result.afterResponse?.replaceOriginal).toBe(false);
  });

  it('rollback済み候補のカード再クリックを再適用成功と表示しない', async () => {
    const result = await handleSlackInteraction({
      supabase: fakeSupabase({ isCurrentlyActive: false }),
      rawBody: body('seo_rule_patch_approve'),
    });
    expect(result.body).toEqual({ ok: false });
    expect(result.afterResponse).toMatchObject({
      replaceOriginal: true,
      text: expect.stringContaining('rollbackされています'),
    });
    expect(result.afterAction).toBeUndefined();
  });
});
