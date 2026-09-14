import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FactContextSnapshot } from '../../lib/seo-loop/context/types';
import { runHardGate } from '../../lib/seo-loop/evaluation/hard-gate';
import { checkInternalLinkReachability } from '../../lib/seo-loop/evaluation/internal-link-reachability';
import { proposalPayloadV2Schema } from '../../lib/seo-loop/types';

const targetUrl = 'https://example.invalid/tsushin-kuchikomi/schools/anonymous';
const linkUrl = 'https://example.invalid/tsushin-kuchikomi/features/tuition';
const context: FactContextSnapshot = {
  version: 1,
  collectedAt: '2026-09-14T00:00:00.000Z',
  target: {
    pageType: 'school',
    id: 'school-anon-001',
    slug: 'anonymous',
    url: targetUrl,
  },
  html: {
    status: 200,
    title: '匿名校',
    description: null,
    canonical: targetUrl,
    robots: 'index,follow',
    h1: '匿名校',
    internalLinks: [],
  },
  database: {
    type: 'school',
    id: 'school-anon-001',
    name: '匿名校',
    slug: 'anonymous',
    isPublic: true,
    aiSummary: null,
  },
  currentValues: {
    addApprovedInternalLink: 'links:0:sha256:anonymous',
  },
};

const proposal = proposalPayloadV2Schema.parse({
  schemaVersion: 2,
  action: 'addApprovedInternalLink',
  targets: [
    {
      type: 'url',
      id: 'school-anon-001',
      url: targetUrl,
      currentValue: 'links:0:sha256:anonymous',
      proposedValue: linkUrl,
    },
  ],
  facts: [{ source: 'gsc', statement: 'Query: 匿名校 学費' }],
  assumptions: ['学費情報への導線が検索者の判断を助ける可能性がある'],
  diagnosis: '学費の検索意図に対する導線が不足している',
  targetMetric: 'clicks',
  confidence: 0.7,
  ruleIds: [],
  rollbackPlan: '追加した内部リンクを削除する',
  rationale: '学費クエリと直接関係する未設置リンクを追加する',
  expectedImpact: '学費情報への回遊を増やしクリック数の改善を期待する',
  evidence: ['Query: 匿名校 学費'],
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('内部リンク到達性Hard Gate', () => {
  it('404を確定的な不達として停止する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const reachability = await checkInternalLinkReachability(proposal, context);
    const result = runHardGate({
      payload: proposal,
      context,
      duplicateProposal: false,
      dailyProposalCount: 1,
      maxDailyProposals: 10,
      maxTargetsPerProposal: 3,
      internalLinkReachability: reachability,
    });

    expect(reachability.reachable).toBe(false);
    expect(result.results).toContainEqual(
      expect.objectContaining({ ruleId: 'internal_link_reachable', passed: false })
    );
    expect(result.passed).toBe(false);
  });

  it('HEAD非対応でもGETが200なら通す', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 405 }))
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
    );
    const reachability = await checkInternalLinkReachability(proposal, context);

    expect(reachability).toMatchObject({
      checked: true,
      reachable: true,
      checks: [{ status: 200, method: 'GET', reachable: true }],
    });
  });
});
