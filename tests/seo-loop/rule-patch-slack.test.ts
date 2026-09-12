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
const rolloutRef = {
  kind: 'rulebook_rollout',
  id: '33333333-3333-4333-8333-333333333333',
  candidateId: ref.id,
  candidateVersion: ref.version,
  patchHash: ref.hash,
  shadowHash: payloadHash(FALLBACK_RULEBOOK),
  metricsHash: 'd'.repeat(64),
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

function rolloutBody(
  actionId:
    | 'seo_rulebook_rollout_promote'
    | 'seo_rulebook_rollout_reject'
) {
  return new URLSearchParams({
    payload: JSON.stringify({
      type: 'block_actions',
      user: { id: 'U-RULE', name: 'Rulebook Owner' },
      trigger_id: 'trigger',
      response_url: 'https://hooks.slack.com/actions/T/B/token',
      channel: { id: 'C123' },
      actions: [{ action_id: actionId, value: JSON.stringify(rolloutRef) }],
    }),
  }).toString();
}

function fakeSupabase(params?: {
  rpcError?: { code?: string; message: string };
  isCurrentlyActive?: boolean;
  legacyAppliedResult?: boolean;
  rolloutStatus?: 'promoted' | 'rolled_back';
  invalidActive?: boolean;
  calls?: Array<{ name: string; args: unknown }>;
}): SupabaseClient {
  const calls = params?.calls ?? [];
  return {
    async rpc(name: string, args: unknown) {
      calls.push({ name, args });
      if (params?.rpcError) return { data: null, error: params.rpcError };
      if (name === 'approve_seo_rule_patch') {
        if (!params?.legacyAppliedResult) {
          return {
            data: {
              status: 'shadowing',
              rolloutId: '33333333-3333-4333-8333-333333333333',
              contentHash: payloadHash(FALLBACK_RULEBOOK),
            },
            error: null,
          };
        }
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
      if (name === 'promote_seo_rulebook_rollout') {
        return {
          data: {
            status: params?.rolloutStatus ?? 'promoted',
            versionId: '22222222-2222-4222-8222-222222222222',
            contentHash: payloadHash(FALLBACK_RULEBOOK),
            isCurrentlyActive: true,
          },
          error: null,
        };
      }
      if (name === 'rollback_seo_rulebook') {
        return { data: { status: 'rolled_back' }, error: null };
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
              content_hash: params?.invalidActive
                ? 'invalid'
                : payloadHash(FALLBACK_RULEBOOK),
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
  vi.stubEnv('SEO_RULEBOOK_SHADOW_ENABLED', 'true');
});

describe('Rulebook rollout最終承認', () => {
  it('rollout/candidate/version/hashを固定して昇格RPCへ渡す', async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const result = await handleSlackInteraction({
      supabase: fakeSupabase({ calls }),
      rawBody: rolloutBody('seo_rulebook_rollout_promote'),
    });

    expect(result.body).toEqual({ ok: true });
    expect(calls[0]).toEqual({
      name: 'promote_seo_rulebook_rollout',
      args: expect.objectContaining({
        p_rollout_id: rolloutRef.id,
        p_candidate_id: rolloutRef.candidateId,
        p_candidate_version: rolloutRef.candidateVersion,
        p_patch_hash: rolloutRef.patchHash,
        p_shadow_content_hash: rolloutRef.shadowHash,
        p_metrics_hash: rolloutRef.metricsHash,
        p_approver_id: 'U-RULE',
      }),
    });
    expect(result.afterAction).toBeUndefined();
    expect(result.afterResponse?.text).toContain('主系へ昇格しました');
  });

  it('shadow switch停止中は昇格RPCを呼ばない', async () => {
    vi.stubEnv('SEO_RULEBOOK_SHADOW_ENABLED', 'false');
    const calls: Array<{ name: string; args: unknown }> = [];
    const result = await handleSlackInteraction({
      supabase: fakeSupabase({ calls }),
      rawBody: rolloutBody('seo_rulebook_rollout_promote'),
    });

    expect(result.body).toEqual({ ok: false });
    expect(calls).toHaveLength(0);
  });

  it('rollback済みカードの再クリックを昇格成功と表示しない', async () => {
    const result = await handleSlackInteraction({
      supabase: fakeSupabase({ rolloutStatus: 'rolled_back' }),
      rawBody: rolloutBody('seo_rulebook_rollout_promote'),
    });

    expect(result.body).toEqual({ ok: false });
    expect(result.afterResponse).toMatchObject({
      replaceOriginal: true,
      text: expect.stringContaining('rollback済み'),
    });
  });

  it('rollout却下RPCへ昇格専用metrics hashを渡さない', async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const result = await handleSlackInteraction({
      supabase: fakeSupabase({ calls }),
      rawBody: rolloutBody('seo_rulebook_rollout_reject'),
    });

    expect(result.body).toEqual({ ok: true });
    expect(calls[0]?.name).toBe('reject_seo_rulebook_rollout');
    expect(calls[0]?.args).not.toHaveProperty('p_metrics_hash');
  });

  it('昇格後検査失敗はrollback完了確認後だけrollback済みと表示する', async () => {
    const calls: Array<{ name: string; args: unknown }> = [];
    const result = await handleSlackInteraction({
      supabase: fakeSupabase({ calls, invalidActive: true }),
      rawBody: rolloutBody('seo_rulebook_rollout_promote'),
    });

    expect(calls.some((call) => call.name === 'rollback_seo_rulebook')).toBe(
      true
    );
    expect(result.body).toEqual({ ok: false });
    expect(result.afterResponse).toMatchObject({
      replaceOriginal: true,
      text: expect.stringContaining('rollbackしました'),
    });
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Rule Patch Slack第二承認', () => {
  it('一人運用者のcandidate version/hashを固定してshadow開始RPCへ渡す', async () => {
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
    expect(result.afterResponse?.text).toContain('active版は変更していません');
    expect(result.afterAction).toBeUndefined();
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

  it('shadow kill switchがfalseなら第二承認を実行しない', async () => {
    vi.stubEnv('SEO_RULEBOOK_SHADOW_ENABLED', 'false');
    const calls: Array<{ name: string; args: unknown }> = [];
    const result = await handleSlackInteraction({
      supabase: fakeSupabase({ calls }),
      rawBody: body('seo_rule_patch_approve'),
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
      supabase: fakeSupabase({
        isCurrentlyActive: false,
        legacyAppliedResult: true,
      }),
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
