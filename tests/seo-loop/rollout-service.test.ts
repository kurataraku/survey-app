import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeoLoopConfig } from '../../lib/seo-loop/config';
import type { ProposalEvaluationResult } from '../../lib/seo-loop/evaluation/types';
import { payloadHash } from '../../lib/seo-loop/hash';
import { FALLBACK_RULEBOOK } from '../../lib/seo-loop/rulebook/schema';

const { evaluateMock, collectFactContextMock } = vi.hoisted(() => ({
  evaluateMock: vi.fn(),
  collectFactContextMock: vi.fn(),
}));
vi.mock('../../lib/seo-loop/context/collector', () => ({
  collectFactContext: collectFactContextMock,
}));
vi.mock('../../lib/seo-loop/evaluation/evaluate', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../../lib/seo-loop/evaluation/evaluate')
    >();
  return {
    ...actual,
    evaluateProposalForApproval: evaluateMock,
  };
});

import {
  evaluateProposalWithShadow,
  recordShadowEvaluation,
} from '../../lib/seo-loop/rollout/service';

const passedEvaluation: ProposalEvaluationResult = {
  version: 'quality-v3',
  passed: true,
  retryable: false,
  hardGatePassed: true,
  hardGateResults: [],
  softEval: {
    version: 'soft-v1',
    dimensions: {
      evidence: 20,
      searchIntent: 20,
      causality: 20,
      expressionQuality: 20,
      expectedImpact: 20,
    },
    totalScore: 100,
    warnings: [],
  },
  softThreshold: 75,
  riskLevel: 'low',
  blockReasons: [],
  warnings: [],
};

const config: SeoLoopConfig = {
  enabled: true,
  executionEnabled: false,
  shadowRolloutEnabled: true,
  maxDailyProposals: 10,
  maxDailyExecutions: 3,
  maxTargetsPerProposal: 3,
  lockTtlSeconds: 240,
  gscDays: 28,
  gscRowLimit: 50,
  softEvalMinScore: 75,
};

const proposal = {
  id: '11111111-1111-4111-8111-111111111111',
  run_id: '22222222-2222-4222-8222-222222222222',
  version: 1,
  payload_hash: 'a'.repeat(64),
  action: 'updateSchoolMetaTitle',
  payload: {},
  context_snapshot: {},
  rulebook_version: 1,
  rulebook_hash: 'b'.repeat(64),
};

const context = {
  version: 1 as const,
  collectedAt: '2026-09-12T00:00:00.000Z',
  target: {
    pageType: 'school' as const,
    id: 'school-1',
    slug: 'school-1',
    url: 'https://example.invalid/schools/school-1',
  },
  html: {
    status: 200,
    title: '現在のtitle',
    description: '説明',
    canonical: 'https://example.invalid/schools/school-1',
    robots: 'index,follow',
    h1: '学校',
    internalLinks: [],
  },
  database: {
    type: 'school' as const,
    id: 'school-1',
    name: '学校',
    slug: 'school-1',
    isPublic: true,
    aiSummary: {
      summaryText: null,
      metaTitle: '現在のtitle',
      metaDescription: null,
    },
  },
  currentValues: { updateSchoolMetaTitle: '現在のtitle' },
};

function builderWithSingle(data: unknown) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };
  return builder;
}

describe('Rulebook shadow evaluation service', () => {
  beforeEach(() => {
    evaluateMock.mockReset();
    evaluateMock.mockResolvedValue(passedEvaluation);
    collectFactContextMock.mockReset();
    collectFactContextMock.mockResolvedValue(context);
  });

  it('kill switch停止時はDBにも評価器にも触れない', async () => {
    const from = vi.fn();
    await recordShadowEvaluation({
      supabase: { from } as unknown as SupabaseClient,
      config: { ...config, shadowRolloutEnabled: false },
      proposal,
      mainEvaluation: passedEvaluation,
    });
    expect(from).not.toHaveBeenCalled();
    expect(evaluateMock).not.toHaveBeenCalled();
  });

  it('同一proposalを新版Rulebookで評価しshadow専用表だけへ保存する', async () => {
    const shadowHash = payloadHash(FALLBACK_RULEBOOK);
    const rolloutBuilder = builderWithSingle({
      id: '33333333-3333-4333-8333-333333333333',
      candidate_id: '44444444-4444-4444-8444-444444444444',
      candidate_version: 1,
      patch_hash: 'c'.repeat(64),
      base_rulebook_version_id: '55555555-5555-4555-8555-555555555555',
      base_rulebook_version: proposal.rulebook_version,
      base_rulebook_hash: proposal.rulebook_hash,
      shadow_content: FALLBACK_RULEBOOK,
      shadow_content_hash: shadowHash,
      status: 'shadowing',
      started_at: '2026-09-12T00:00:00.000Z',
      slack_message_ts: null,
    });
    const existingBuilder = builderWithSingle(null);
    const upsert = vi.fn(async () => ({ error: null }));
    const touchedTables: string[] = [];
    const supabase = {
      from(table: string) {
        touchedTables.push(table);
        if (table === 'seo_rulebook_rollouts') return rolloutBuilder;
        if (
          table === 'seo_rulebook_shadow_evaluations' &&
          touchedTables.filter((value) => value === table).length === 1
        ) {
          return existingBuilder;
        }
        return { upsert };
      },
    } as unknown as SupabaseClient;

    await recordShadowEvaluation({
      supabase,
      config,
      proposal,
      mainEvaluation: passedEvaluation,
    });

    expect(evaluateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        persist: false,
        forceFresh: true,
        ignoreProposalRulebookStamp: true,
        rulebookOverride: expect.objectContaining({
          contentHash: shadowHash,
        }),
      })
    );
    expect(upsert).toHaveBeenCalledOnce();
    expect(touchedTables).toEqual([
      'seo_rulebook_rollouts',
      'seo_rulebook_shadow_evaluations',
      'seo_rulebook_shadow_evaluations',
    ]);
    expect(touchedTables).not.toContain('seo_approvals');
    expect(touchedTables).not.toContain('seo_proposals');
  });

  it('主系とshadowへ同じfresh contextを渡して比較条件を固定する', async () => {
    const shadowHash = payloadHash(FALLBACK_RULEBOOK);
    const rollout = {
      id: '33333333-3333-4333-8333-333333333333',
      candidate_id: '44444444-4444-4444-8444-444444444444',
      candidate_version: 1,
      patch_hash: 'c'.repeat(64),
      base_rulebook_version_id: '55555555-5555-4555-8555-555555555555',
      base_rulebook_version: proposal.rulebook_version,
      base_rulebook_hash: proposal.rulebook_hash,
      shadow_content: FALLBACK_RULEBOOK,
      shadow_content_hash: shadowHash,
      status: 'shadowing',
      started_at: '2026-09-12T00:00:00.000Z',
      slack_message_ts: null,
    };
    const upsert = vi.fn(async () => ({ error: null }));
    let shadowTableCalls = 0;
    const supabase = {
      from(table: string) {
        if (table === 'seo_rulebook_rollouts') {
          return builderWithSingle(rollout);
        }
        if (table === 'seo_rulebook_shadow_evaluations') {
          shadowTableCalls += 1;
          return shadowTableCalls <= 2
            ? builderWithSingle(null)
            : { upsert };
        }
        throw new Error(`unexpected table: ${table}`);
      },
    } as unknown as SupabaseClient;

    const result = await evaluateProposalWithShadow({
      supabase,
      config,
      proposal: { ...proposal, context_snapshot: context },
    });

    expect(result).toBe(passedEvaluation);
    expect(collectFactContextMock).toHaveBeenCalledOnce();
    expect(evaluateMock).toHaveBeenCalledTimes(2);
    const mainOptions = evaluateMock.mock.calls[0]![0];
    const shadowOptions = evaluateMock.mock.calls[1]![0];
    expect(mainOptions.forceFresh).toBe(true);
    expect(mainOptions.persist).toBeUndefined();
    expect(shadowOptions.persist).toBe(false);
    expect(shadowOptions.freshContextOverride).toBe(
      mainOptions.freshContextOverride
    );
    expect(upsert).toHaveBeenCalledOnce();
  });
});
