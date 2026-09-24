import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeoLoopConfig } from '../../lib/seo-loop/config';

const { callLLMMock, collectFactContextMock } = vi.hoisted(() => ({
  callLLMMock: vi.fn(),
  collectFactContextMock: vi.fn(),
}));

vi.mock('../../lib/seo-loop/context/collector', () => ({
  collectFactContext: collectFactContextMock,
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
  awaitingApprovalInRun?: number;
  unfinishedProposals?: Array<Record<string, unknown>>;
  issueUpdates?: Record<string, unknown>[];
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
      const filters: Array<[string, unknown]> = [];
      const builder = {
        select(_columns?: string, options?: { head?: boolean }) {
          head = options?.head === true;
          return builder;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return builder;
        },
        neq: () => builder,
        in: () => builder,
        gte: () => builder,
        order: () => builder,
        insert: () => builder,
        update(values: unknown) {
          if (table === 'seo_loop_runs') {
            state.runUpdates.push(values as Record<string, unknown>);
          }
          if (table === 'seo_issues') {
            state.issueUpdates?.push(values as Record<string, unknown>);
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
            const awaitingApproval = filters.some(
              ([column, value]) =>
                column === 'status' && value === 'pending_approval'
            );
            return Promise.resolve({
              count:
                table === 'seo_issues'
                  ? state.openIssueCount
                  : awaitingApproval
                    ? (state.awaitingApprovalInRun ?? 0)
                    : state.proposalsToday,
              error: null,
            }).then(resolve);
          }
          const data =
            table === 'seo_issues'
              ? Array.from({ length: Math.min(limited, state.openIssueCount) }, (_, i) =>
                  openIssue(i)
                )
              : table === 'seo_proposals'
                ? (state.unfinishedProposals ?? [])
                : [];
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

function schoolContext(index: number) {
  const url = `https://example.invalid/tsushin-kuchikomi/schools/anon-${index}`;
  return {
    version: 1 as const,
    collectedAt: '2026-09-24T00:00:00.000Z',
    target: {
      pageType: 'school' as const,
      id: `school-${index}`,
      slug: `anon-${index}`,
      url,
    },
    html: {
      status: 200,
      title: '匿名通信制高校の口コミ・評判',
      description: '匿名説明',
      canonical: url,
      robots: 'index,follow',
      h1: '匿名通信制高校',
      internalLinks: [],
    },
    database: {
      type: 'school' as const,
      id: `school-${index}`,
      name: '匿名通信制高校',
      slug: `anon-${index}`,
      isPublic: true,
      aiSummary: {
        summaryText: '匿名の要約本文です。',
        metaTitle: '匿名通信制高校の口コミ・評判',
        metaDescription: null,
      },
    },
    currentValues: {
      updateSchoolMetaTitle: '匿名通信制高校の口コミ・評判',
      updateSeoSummary: '匿名の要約本文です。',
      addApprovedInternalLink: 'links:0:sha256:anonymous',
    },
  };
}

function unfinishedProposalFor(
  index: number,
  action: 'updateSchoolMetaTitle' | 'updateSeoSummary' | 'addApprovedInternalLink'
): Record<string, unknown> {
  const url = `https://example.invalid/tsushin-kuchikomi/schools/anon-${index}`;
  return {
    id: `proposal-${index}-${action}`,
    action,
    payload: {
      schemaVersion: 2,
      action,
      targets: [
        {
          type: action === 'addApprovedInternalLink' ? 'url' : 'school',
          id: `school-${index}`,
          url,
          currentValue:
            action === 'addApprovedInternalLink'
              ? 'links:0:sha256:anonymous'
              : '匿名通信制高校の口コミ・評判',
          proposedValue:
            action === 'addApprovedInternalLink'
              ? 'https://example.invalid/tsushin-kuchikomi/features/tuition'
              : '匿名通信制高校の口コミ・評判｜学費とコースを解説',
        },
      ],
      facts: [{ source: 'gsc', statement: 'Query: 匿名通信制高校 口コミ' }],
      assumptions: ['検索意図に対する情報が不足している可能性がある'],
      diagnosis: '5〜15位圏で表示回数が多い',
      targetMetric: 'clicks',
      confidence: 0.7,
      ruleIds: [],
      rollbackPlan: '元のtitleへ戻す',
      rationale: '平均順位8.2位のため改善余地がある',
      expectedImpact: 'クリック数の増加を期待する',
      evidence: ['Query: 匿名通信制高校 口コミ'],
    },
  };
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

  it('Slack承認待ちが残るrunをcompletedにしない', async () => {
    const state: FakeState = {
      openIssueCount: 0,
      proposalsToday: 10,
      awaitingApprovalInRun: 1,
      runUpdates: [],
    };
    const result = await analyzeIssuesToProposals({
      supabase: fakeSupabase(state),
      runId,
      config,
      deadlineAt: Date.now() + 60_000,
    });

    expect(result.proposalCount).toBe(0);
    expect(state.runUpdates.at(-1)).toMatchObject({
      status: 'pending_approval',
      current_step: 'approve',
    });
    expect(state.runUpdates.at(-1)).not.toHaveProperty('completed_at');
  });

  it('未完了提案がある対象はLLMを呼ばずに次の課題へ回す', async () => {
    collectFactContextMock.mockImplementation(
      async ({ targetUrl }: { targetUrl: string }) => {
        const index = Number(targetUrl.split('anon-')[1]);
        return schoolContext(index);
      }
    );
    const state: FakeState = {
      openIssueCount: 1,
      proposalsToday: 0,
      awaitingApprovalInRun: 0,
      unfinishedProposals: [
        unfinishedProposalFor(0, 'updateSchoolMetaTitle'),
        unfinishedProposalFor(0, 'updateSeoSummary'),
        unfinishedProposalFor(0, 'addApprovedInternalLink'),
      ],
      issueUpdates: [],
      runUpdates: [],
    };

    const result = await analyzeIssuesToProposals({
      supabase: fakeSupabase(state),
      runId,
      config,
      deadlineAt: Date.now() + 60_000,
    });

    expect(callLLMMock).not.toHaveBeenCalled();
    expect(result.proposalCount).toBe(0);
    expect(state.issueUpdates?.at(-1)).toMatchObject({ status: 'dismissed' });
    expect(
      JSON.stringify(state.issueUpdates?.at(-1)?.evidence)
    ).toContain('未完了提案');
  });
});
