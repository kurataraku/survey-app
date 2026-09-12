import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeoLoopConfig } from '../../lib/seo-loop/config';
import type { FactContextSnapshot } from '../../lib/seo-loop/context/types';
import { proposalPayloadV2Schema } from '../../lib/seo-loop/types';

const { collectFactContextMock } = vi.hoisted(() => ({
  collectFactContextMock: vi.fn(),
}));

vi.mock('../../lib/seo-loop/context/collector', () => ({
  collectFactContext: collectFactContextMock,
}));

import {
  evaluateProposalForApproval,
  shouldSendProposalToSlack,
} from '../../lib/seo-loop/evaluation/evaluate';

const targetUrl = 'https://example.invalid/tsushin-kuchikomi/schools/anonymous';
const currentValue = '匿名通信制高校の口コミ';
const context: FactContextSnapshot = {
  version: 1,
  collectedAt: '2026-09-10T00:00:00.000Z',
  target: {
    pageType: 'school',
    id: 'school-anon-001',
    slug: 'anonymous',
    url: targetUrl,
  },
  html: {
    status: 200,
    title: currentValue,
    description: '説明',
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
      summaryText: '現在の匿名要約',
      metaTitle: currentValue,
      metaDescription: null,
    },
  },
  currentValues: { updateSchoolMetaTitle: currentValue },
};
const proposal = proposalPayloadV2Schema.parse({
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
  softEvalMinScore: 60,
};

function fakeSupabase(savedRows: unknown[]): SupabaseClient {
  return {
    from(table: string) {
      let head = false;
      const builder = {
        select(_columns?: string, options?: { head?: boolean }) {
          head = options?.head === true;
          return builder;
        },
        eq() {
          return builder;
        },
        neq() {
          return builder;
        },
        in() {
          return builder;
        },
        order() {
          return builder;
        },
        async maybeSingle() {
          return { data: null, error: null };
        },
        async limit() {
          return { data: [], error: null };
        },
        gte() {
          return head ? Promise.resolve({ count: 1, error: null }) : builder;
        },
        async upsert(rows: unknown) {
          if (table === 'seo_proposal_evaluations') savedRows.push(rows);
          return { error: null };
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

describe('evaluateProposalForApproval', () => {
  beforeEach(() => {
    collectFactContextMock.mockReset();
    collectFactContextMock.mockResolvedValue(context);
  });

  it('評価結果をDBへ保存し、合格時だけSlack送信可能にする', async () => {
    const savedRows: unknown[] = [];
    const result = await evaluateProposalForApproval({
      supabase: fakeSupabase(savedRows),
      config,
      proposal: {
        id: 'proposal-anon-001',
        run_id: 'run-anon-001',
        version: 1,
        payload_hash: 'hash-anon-001',
        action: proposal.action,
        payload: proposal,
        context_snapshot: context,
      },
    });

    expect(result.hardGatePassed).toBe(true);
    expect(result.passed).toBe(true);
    expect(shouldSendProposalToSlack(result)).toBe(true);
    expect(savedRows).toHaveLength(1);
    expect(savedRows[0]).toMatchObject({
      proposal_id: 'proposal-anon-001',
      hard_gate_passed: true,
      passed: true,
      evaluation_version: 'quality-v1@rb0:ac0f3b6225ef',
    });
  });

  it('currentValue不一致の理由をDBへ保存する', async () => {
    const savedRows: unknown[] = [];
    collectFactContextMock.mockResolvedValue({
      ...context,
      currentValues: { updateSchoolMetaTitle: '管理画面で変更されたtitle' },
    });
    const result = await evaluateProposalForApproval({
      supabase: fakeSupabase(savedRows),
      config,
      proposal: {
        id: 'proposal-stale-001',
        run_id: 'run-anon-001',
        version: 1,
        payload_hash: 'hash-stale-001',
        action: proposal.action,
        payload: proposal,
        context_snapshot: context,
      },
    });

    expect(result.passed).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.blockReasons).toContain(
      'current_value_match: currentValueが最新実測値と一致しません'
    );
    expect(savedRows[0]).toMatchObject({
      hard_gate_passed: false,
      retryable: false,
      passed: false,
    });
  });

  it('一時的なFact Context取得失敗は恒久ブロックせず再試行可能にする', async () => {
    const savedRows: unknown[] = [];
    collectFactContextMock.mockRejectedValue(new Error('temporary fetch failure'));
    const result = await evaluateProposalForApproval({
      supabase: fakeSupabase(savedRows),
      config,
      proposal: {
        id: 'proposal-retry-001',
        run_id: 'run-anon-001',
        version: 1,
        payload_hash: 'hash-retry-001',
        action: proposal.action,
        payload: proposal,
        context_snapshot: context,
      },
    });

    expect(result.passed).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.blockReasons[0]).toContain('infrastructure:');
    expect(savedRows[0]).toMatchObject({
      hard_gate_passed: false,
      retryable: true,
      passed: false,
    });
  });

  it('実行直前評価を承認時評価とは別versionで保存する', async () => {
    const savedRows: unknown[] = [];
    const result = await evaluateProposalForApproval({
      supabase: fakeSupabase(savedRows),
      config,
      proposal: {
        id: 'proposal-execution-001',
        run_id: 'run-anon-001',
        version: 1,
        payload_hash: 'hash-execution-001',
        action: proposal.action,
        payload: proposal,
        context_snapshot: context,
      },
      forceFresh: true,
      phase: 'execution',
    });

    expect(result.passed).toBe(true);
    expect(savedRows[0]).toMatchObject({
      evaluation_version: 'quality-v1-execution@rb0:ac0f3b6225ef',
      passed: true,
    });
  });

  it('proposalとrun固定Rulebookのhash不一致を安全側で停止する', async () => {
    const savedRows: unknown[] = [];
    const result = await evaluateProposalForApproval({
      supabase: fakeSupabase(savedRows),
      config,
      proposal: {
        id: 'proposal-rulebook-mismatch',
        run_id: 'run-anon-001',
        version: 1,
        payload_hash: 'hash-rulebook-mismatch',
        action: proposal.action,
        payload: proposal,
        context_snapshot: context,
        rulebook_version: 2,
        rulebook_hash: 'different-rulebook-hash',
      },
    });

    expect(result.passed).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.blockReasons[0]).toContain('infrastructure:');
    expect(collectFactContextMock).not.toHaveBeenCalled();
  });
});
