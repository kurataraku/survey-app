import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeoLoopConfig } from '../../lib/seo-loop/config';
import type { FactContextSnapshot } from '../../lib/seo-loop/context/types';
import { payloadHash } from '../../lib/seo-loop/hash';
import { proposalPayloadV2Schema } from '../../lib/seo-loop/types';

const { callLLMMock, collectFactContextMock } = vi.hoisted(() => ({
  callLLMMock: vi.fn(),
  collectFactContextMock: vi.fn(),
}));

vi.mock('@/lib/seo-generation/llm-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/seo-generation/llm-client')>();
  return {
    ...actual,
    callLLM: callLLMMock,
    resolveModel: () => ({ provider: 'openai' as const, model: 'test-model' }),
  };
});

vi.mock('../../lib/seo-loop/context/collector', () => ({
  collectFactContext: collectFactContextMock,
}));

import {
  findNextRevisionRunId,
  reviseRequestedProposal,
} from '../../lib/seo-loop/revision/service';

const runId = '11111111-1111-4111-8111-111111111111';
const issueId = '22222222-2222-4222-8222-222222222222';
const parentId = '33333333-3333-4333-8333-333333333333';
const feedbackId = '44444444-4444-4444-8444-444444444444';
const targetUrl = 'https://example.invalid/tsushin-kuchikomi/schools/anonymous';
const currentValue = '匿名通信制高校の口コミ';

const context: FactContextSnapshot = {
  version: 1,
  collectedAt: '2026-09-11T00:00:00.000Z',
  target: {
    pageType: 'school',
    id: 'school-anon-001',
    slug: 'anonymous',
    url: targetUrl,
  },
  html: {
    status: 200,
    title: currentValue,
    description: '匿名説明',
    canonical: targetUrl,
    robots: 'index,follow',
    h1: '匿名通信制高校',
    internalLinks: [],
  },
  database: {
    type: 'school',
    id: 'school-anon-001',
    name: '匿名通信制高校',
    slug: 'anonymous',
    isPublic: true,
    aiSummary: {
      summaryText: '学校生活に関する口コミと評判をまとめた匿名化された現在の要約です。',
      metaTitle: currentValue,
      metaDescription: null,
    },
  },
  currentValues: { updateSchoolMetaTitle: currentValue },
};

const parentPayload = proposalPayloadV2Schema.parse({
  schemaVersion: 2,
  action: 'updateSchoolMetaTitle',
  targets: [
    {
      type: 'school',
      id: 'school-anon-001',
      url: targetUrl,
      currentValue,
      proposedValue: '匿名通信制高校の口コミ・評判と学校生活',
    },
  ],
  facts: [
    { source: 'gsc', statement: 'Query: 匿名通信制高校 口コミ' },
    { source: 'gsc', statement: '表示回数1000、CTR1.0%' },
  ],
  assumptions: ['検索意図がtitleから伝わりにくい可能性がある'],
  diagnosis: '表示回数が多い一方でCTRが低いため、検索意図を示す語が不足している',
  targetMetric: 'ctr',
  confidence: 0.75,
  ruleIds: [],
  rollbackPlan: '問題があれば保存済みの元titleへ戻す',
  rationale: '対象クエリの表示回数が多い一方、クリック率が低いため',
  expectedImpact: '検索結果で内容が伝わりCTRが改善することを期待する',
  evidence: ['Query: 匿名通信制高校 口コミ', '表示回数1000、CTR1.0%'],
});

const config: SeoLoopConfig = {
  enabled: true,
  executionEnabled: false,
  maxDailyProposals: 10,
  maxDailyExecutions: 3,
  maxTargetsPerProposal: 3,
  lockTtlSeconds: 240,
  gscDays: 28,
  gscRowLimit: 50,
  softEvalMinScore: 75,
};

type RecordedCall = {
  table: string;
  operation: string;
  value?: unknown;
};

function fakeSupabase(params?: {
  consumedFeedback?: boolean;
  feedbackCategory?: string;
  runStatus?: string;
  calls?: RecordedCall[];
}): SupabaseClient {
  const calls = params?.calls ?? [];
  const parent = {
    id: parentId,
    run_id: runId,
    issue_id: issueId,
    version: 1,
    payload_hash: payloadHash(parentPayload),
    payload: parentPayload,
    baseline: { gsc_snapshot: { ctr: 0.01 } },
    revision_number: 0,
    revision_retry_count: 0,
    schema_version: 2,
  };
  const feedback = {
    id: feedbackId,
    proposal_id: parentId,
    proposal_version: 1,
    proposal_payload_hash: parent.payload_hash,
    reason: '検索意図に対して表現が抽象的なので修正してください',
    category: params?.feedbackCategory ?? 'search_intent_mismatch',
    desired_change: '検索クエリとの対応が分かる表現へ変更してください',
    general_rule_candidate: true,
  };

  return {
    from(table: string) {
      let operation = 'select';
      let selected = '';
      let head = false;
      let value: unknown;
      const response = () => {
        if (table === 'seo_proposals' && operation === 'select') {
          if (head) return { count: 1, data: null, error: null };
          if (selected === 'revision_feedback_id') {
            return {
              data: params?.consumedFeedback
                ? [{ revision_feedback_id: feedbackId }]
                : [],
              error: null,
            };
          }
          return { data: [parent], error: null };
        }
        if (table === 'seo_feedback' && operation === 'select') {
          return { data: [feedback], error: null };
        }
        if (table === 'seo_loop_runs' && operation === 'select') {
          return {
            data: [
              {
                id: runId,
                status: params?.runStatus ?? 'completed',
                retry_count: 0,
                max_retries: 3,
              },
            ],
            error: null,
          };
        }
        return { data: null, error: null };
      };
      const builder = {
        select(columns = '', options?: { head?: boolean }) {
          selected = columns;
          head = options?.head === true;
          return builder;
        },
        insert(insertValue: unknown) {
          operation = 'insert';
          value = insertValue;
          calls.push({ table, operation, value: insertValue });
          return builder;
        },
        update(updateValue: unknown) {
          operation = 'update';
          value = updateValue;
          calls.push({ table, operation, value: updateValue });
          return builder;
        },
        upsert(upsertValue: unknown) {
          operation = 'upsert';
          value = upsertValue;
          calls.push({ table, operation, value: upsertValue });
          return builder;
        },
        eq() {
          return builder;
        },
        in() {
          return builder;
        },
        is() {
          return builder;
        },
        not() {
          return builder;
        },
        lt() {
          return builder;
        },
        lte() {
          return builder;
        },
        gte() {
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        async single() {
          if (operation === 'insert') {
            return {
              data: { id: '55555555-5555-4555-8555-555555555555' },
              error: null,
            };
          }
          return response();
        },
        async maybeSingle() {
          return response();
        },
        then<TResult1 = unknown, TResult2 = never>(
          onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
        ) {
          void value;
          return Promise.resolve(response()).then(onfulfilled, onrejected);
        },
      };
      return builder;
    },
    async rpc(name: string, args: unknown) {
      calls.push({ table: `rpc:${name}`, operation: 'rpc', value: args });
      return {
        data: '55555555-5555-4555-8555-555555555555',
        error: null,
      };
    },
  } as unknown as SupabaseClient;
}

function llmResponse(action = 'updateSchoolMetaTitle') {
  return {
    content: JSON.stringify({
      proposal: {
        action,
        proposedValue: '匿名通信制高校の評判・口コミと学校生活',
        rationale: '検索意図との対応を明確にするよう人間の修正理由を反映した',
        expectedImpact: '検索結果で内容が伝わりCTRの改善が期待できる',
        rollbackPlan: '問題があれば最新の元titleへ戻す',
      },
    }),
    tokensUsed: { prompt: 100, completion: 50, total: 150 },
  };
}

beforeEach(() => {
  callLLMMock.mockReset();
  collectFactContextMock.mockReset();
  collectFactContextMock.mockResolvedValue(context);
});

describe('revision proposal service', () => {
  it('feedbackから旧行を上書きせず子proposalを生成する', async () => {
    const calls: RecordedCall[] = [];
    callLLMMock.mockResolvedValue(llmResponse());
    const result = await reviseRequestedProposal({
      supabase: fakeSupabase({ calls }),
      runId,
      config,
    });

    expect(result.proposalCount).toBe(1);
    const createCall = calls.find(
      (call) =>
        call.table === 'rpc:create_seo_proposal_revision' &&
        call.operation === 'rpc'
    );
    expect(createCall?.value).toMatchObject({
      p_parent_proposal_id: parentId,
      p_feedback_id: feedbackId,
    });
    const child = createCall?.value as {
      p_payload_hash: string;
      p_payload: unknown;
    };
    expect(child.p_payload_hash).not.toBe(payloadHash(parentPayload));
    expect(proposalPayloadV2Schema.safeParse(child.p_payload).success).toBe(true);

    const llmCall = callLLMMock.mock.calls[0]?.[0] as {
      systemPrompt: string;
      userPrompt: string;
    };
    const input = JSON.parse(llmCall.userPrompt) as {
      trustedPolicy: { fixedAction: string; arbitrarySqlAllowed: boolean };
      untrustedData: { feedback: { reason: string } };
    };
    expect(input.trustedPolicy).toMatchObject({
      fixedAction: 'updateSchoolMetaTitle',
      arbitrarySqlAllowed: false,
    });
    expect(input.untrustedData.feedback.reason).toContain('検索意図');
    expect(llmCall.systemPrompt).toContain('untrusted data');
  });

  it('feedback中の指示でもaction変更を許可しない', async () => {
    const calls: RecordedCall[] = [];
    callLLMMock.mockResolvedValue(llmResponse('updateSeoSummary'));
    const result = await reviseRequestedProposal({
      supabase: fakeSupabase({ calls }),
      runId,
      config,
    });

    expect(result.proposalCount).toBe(0);
    expect(result.notify).toBe(false);
    expect(callLLMMock).toHaveBeenCalledTimes(3);
    expect(
      calls.some(
        (call) => call.table === 'rpc:create_seo_proposal_revision'
      )
    ).toBe(false);
    expect(calls).toContainEqual(
      expect.objectContaining({
        table: 'seo_proposals',
        operation: 'update',
        value: expect.objectContaining({ revision_retry_count: 1 }),
      })
    );
  });

  it('wrong_targetの改訂要求はaction固定レーンで打ち切る', async () => {
    const calls: RecordedCall[] = [];
    const result = await reviseRequestedProposal({
      supabase: fakeSupabase({ calls, feedbackCategory: 'wrong_target' }),
      runId,
      config,
    });

    expect(result.outcome).toBe('abandoned');
    expect(result.notify).toBe(true);
    expect(callLLMMock).not.toHaveBeenCalled();
    expect(calls).toContainEqual(
      expect.objectContaining({
        table: 'seo_proposals',
        operation: 'update',
        value: expect.objectContaining({
          status: 'rejected',
          revision_resolved_at: expect.any(String),
        }),
      })
    );
  });

  it('同じfeedbackに子proposalがあれば再生成しない', async () => {
    const nextRunId = await findNextRevisionRunId({
      supabase: fakeSupabase({ consumedFeedback: true }),
    });
    expect(nextRunId).toBeNull();
    expect(callLLMMock).not.toHaveBeenCalled();
  });

  it('日次上限到達時はLLMを呼ばず改訂retryへ記録する', async () => {
    const calls: RecordedCall[] = [];
    const result = await reviseRequestedProposal({
      supabase: fakeSupabase({ calls }),
      runId,
      config: { ...config, maxDailyProposals: 1 },
    });
    expect(result.proposalCount).toBe(0);
    expect(result.message).toContain('上限チェック失敗');
    expect(callLLMMock).not.toHaveBeenCalled();
    expect(calls).toContainEqual(
      expect.objectContaining({
        table: 'seo_proposals',
        operation: 'update',
        value: expect.objectContaining({ revision_retry_count: 1 }),
      })
    );
  });

  it('failed runを改訂処理で復活させない', async () => {
    const nextRunId = await findNextRevisionRunId({
      supabase: fakeSupabase({ runStatus: 'failed' }),
    });
    expect(nextRunId).toBeNull();
  });
});
