import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeoLoopConfig } from '../../lib/seo-loop/config';

const { callLLMMock } = vi.hoisted(() => ({ callLLMMock: vi.fn() }));

vi.mock('@/lib/seo-generation/llm-client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/seo-generation/llm-client')>();
  return {
    ...actual,
    callLLM: callLLMMock,
    resolveModel: () => ({ provider: 'openai' as const, model: 'test-model' }),
  };
});

import { analyzeIssuesToProposals } from '../../lib/seo-loop/analyzer';
import { issueCapForRun } from '../../lib/seo-loop/observer';

const runId = '55555555-5555-4555-8555-555555555555';

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

type FakeState = {
  openIssueCount: number;
  proposalsToday: number;
  runUpdates: Record<string, unknown>[];
};

function openIssue(index: number): Record<string, unknown> {
  return {
    id: `issue-${index}`,
    issue_type: 'striking_distance',
    title: '5〜15位圏で改善余地がある',
    description: null,
    target_url: `https://example.invalid/tsushin-kuchikomi/schools/anon-${index}`,
    query: '匿名クエリ',
    gsc_snapshot: { impressions: 1000, position: 8 },
    evidence: {},
    scores: { opportunity: 0.5 },
  };
}

function fakeSupabase(state: FakeState): SupabaseClient {
  return {
    from(table: string) {
      let head = false;
      let limited = 5;
      const builder = {
        select(_columns?: string, options?: { head?: boolean }) {
          head = options?.head === true;
          return builder;
        },
        eq: () => builder,
        gte: () => builder,
        order: () => builder,
        insert: () => builder,
        update(values: unknown) {
          if (table === 'seo_loop_runs') {
            state.runUpdates.push(values as Record<string, unknown>);
          }
          return builder;
        },
        upsert: async () => ({ error: null }),
        limit(value: number) {
          limited = value;
          return builder;
        },
        maybeSingle: async () => ({ data: null, error: null }),
        then(resolve: (value: unknown) => unknown) {
          if (head) {
            return Promise.resolve({
              count:
                table === 'seo_issues' ? state.openIssueCount : state.proposalsToday,
              error: null,
            }).then(resolve);
          }
          const data =
            table === 'seo_issues'
              ? Array.from({ length: Math.min(limited, state.openIssueCount) }, (_, i) =>
                  openIssue(i)
                )
              : [];
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

describe('分析スループット', () => {
  beforeEach(() => {
    callLLMMock.mockReset();
  });

  it('検出する課題数はproposal上限の2倍にする', () => {
    expect(issueCapForRun(10)).toBe(20);
    expect(issueCapForRun(1)).toBe(2);
  });

  it('時間上限を超えたらLLMを呼ばず、課題をopenのまま次tickへ残す', async () => {
    const state: FakeState = { openIssueCount: 6, proposalsToday: 0, runUpdates: [] };
    const result = await analyzeIssuesToProposals({
      supabase: fakeSupabase(state),
      runId,
      config,
      deadlineAt: Date.now() - 1,
    });

    expect(callLLMMock).not.toHaveBeenCalled();
    expect(result.proposalCount).toBe(0);
    expect(result.message).toContain('実行時間上限で中断');
    expect(state.runUpdates.at(-1)).toMatchObject({ status: 'analyzing' });
  });

  it('当日proposal上限に達したら分析を止めて完了させる', async () => {
    const state: FakeState = { openIssueCount: 6, proposalsToday: 10, runUpdates: [] };
    const result = await analyzeIssuesToProposals({
      supabase: fakeSupabase(state),
      runId,
      config,
      deadlineAt: Date.now() + 60_000,
    });

    expect(callLLMMock).not.toHaveBeenCalled();
    expect(result.proposalCount).toBe(0);
    expect(result.message).toContain('当日proposal上限に到達');
    expect(state.runUpdates.at(-1)).toMatchObject({ status: 'completed' });
  });
});
