import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { FactContextSnapshot } from '../../lib/seo-loop/context/types';
import {
  QUALITY_EVALUATION_VERSION,
  shouldSendProposalToSlack,
} from '../../lib/seo-loop/evaluation/evaluate';
import { runHardGate } from '../../lib/seo-loop/evaluation/hard-gate';
import { runSoftEval } from '../../lib/seo-loop/evaluation/soft-eval';
import type { ProposalEvaluationResult } from '../../lib/seo-loop/evaluation/types';
import { determineRiskLevel } from '../../lib/seo-loop/risk-rules';
import { approvalDetails } from '../../lib/seo-loop/slack';
import { proposalPayloadV2Schema } from '../../lib/seo-loop/types';

type QualityFixture = {
  id: string;
  mutation:
    | 'sameValue'
    | 'shortValue'
    | 'duplicateBrand'
    | 'forbiddenExpression'
    | 'staleCurrentValue'
    | 'unknownTarget';
  expectedRule: string;
};

const fixturePath = fileURLToPath(new URL('./fixtures/quality-cases.json', import.meta.url));
const qualityFixtures = JSON.parse(readFileSync(fixturePath, 'utf8')) as QualityFixture[];

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
  currentValues: {
    updateSchoolMetaTitle: currentValue,
  },
};

const goodProposal = proposalPayloadV2Schema.parse({
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
  rationale: 'GSCの対象クエリで表示回数が多い一方、クリック率が低いため',
  expectedImpact: '検索結果で内容が伝わりCTRが改善することを期待する',
  evidence: ['Query: 匿名通信制高校 口コミ', '表示回数1000、CTR1.0%'],
});

function mutateProposal(fixture: QualityFixture): unknown {
  const target = goodProposal.targets[0]!;
  if (fixture.mutation === 'sameValue') {
    return { ...goodProposal, targets: [{ ...target, proposedValue: currentValue }] };
  }
  if (fixture.mutation === 'shortValue') {
    return { ...goodProposal, targets: [{ ...target, proposedValue: '短い' }] };
  }
  if (fixture.mutation === 'duplicateBrand') {
    return {
      ...goodProposal,
      targets: [{ ...target, proposedValue: '匿名通信制高校｜匿名通信制高校の口コミ・評判' }],
    };
  }
  if (fixture.mutation === 'forbiddenExpression') {
    return {
      ...goodProposal,
      targets: [{ ...target, proposedValue: '匿名通信制高校なら必ず合格できる口コミ情報' }],
    };
  }
  if (fixture.mutation === 'staleCurrentValue') {
    return { ...goodProposal, targets: [{ ...target, currentValue: '古いtitle' }] };
  }
  return { ...goodProposal, targets: [{ ...target, id: 'missing-school' }] };
}

function hardGate(payload: unknown, overrides: {
  duplicateProposal?: boolean;
  dailyProposalCount?: number;
  maxDailyProposals?: number;
  maxTargetsPerProposal?: number;
} = {}) {
  return runHardGate({
    payload,
    context,
    duplicateProposal: overrides.duplicateProposal ?? false,
    dailyProposalCount: overrides.dailyProposalCount ?? 1,
    maxDailyProposals: overrides.maxDailyProposals ?? 10,
    maxTargetsPerProposal: overrides.maxTargetsPerProposal ?? 3,
  });
}

describe('Hard Gate', () => {
  it('正常なProposal v2を通す', () => {
    const result = hardGate(goodProposal);
    expect(result.passed).toBe(true);
    expect(result.results.every((item) => item.passed)).toBe(true);
  });

  it.each(qualityFixtures)('$idを$expectedRuleで停止する', (fixture) => {
    const result = hardGate(mutateProposal(fixture));
    expect(result.passed).toBe(false);
    expect(result.results.find((item) => item.ruleId === fixture.expectedRule)?.passed).toBe(false);
  });

  it('重複・対象件数・日次件数の上限を検査する', () => {
    expect(hardGate(goodProposal, { duplicateProposal: true }).results)
      .toContainEqual(expect.objectContaining({ ruleId: 'no_duplicate_proposal', passed: false }));
    expect(
      hardGate(
        {
          ...goodProposal,
          targets: [goodProposal.targets[0], goodProposal.targets[0]],
        },
        { maxTargetsPerProposal: 1 }
      ).results
    ).toContainEqual(expect.objectContaining({ ruleId: 'target_limit', passed: false }));
    expect(
      hardGate(goodProposal, { dailyProposalCount: 11, maxDailyProposals: 10 }).results
    ).toContainEqual(expect.objectContaining({ ruleId: 'daily_proposal_limit', passed: false }));
  });

  it('実行直前は生成件数ルールを再適用せず安全ルールだけを検査する', () => {
    const result = runHardGate({
      payload: goodProposal,
      context,
      phase: 'execution',
      duplicateProposal: true,
      dailyProposalCount: 999,
      maxDailyProposals: 1,
      maxTargetsPerProposal: 3,
    });
    expect(result.results).toContainEqual(
      expect.objectContaining({ ruleId: 'no_duplicate_proposal', passed: true })
    );
    expect(result.results).toContainEqual(
      expect.objectContaining({ ruleId: 'daily_proposal_limit', passed: true })
    );
    expect(result.passed).toBe(true);
  });

  it('Allowlist外actionとv1 payloadを拒否する', () => {
    const result = hardGate({
      action: 'executeSql',
      targets: [],
      rationale: 'x',
      expectedImpact: 'x',
    });
    expect(result.results).toContainEqual(
      expect.objectContaining({ ruleId: 'allowlisted_action', passed: false })
    );
    expect(result.results).toContainEqual(
      expect.objectContaining({ ruleId: 'schema_v2', passed: false })
    );
  });

  it('外部originへの内部リンクを拒否する', () => {
    const linkProposal = {
      ...goodProposal,
      action: 'addApprovedInternalLink',
      targets: [
        {
          type: 'url',
          id: 'school-anon-001',
          url: targetUrl,
          currentValue: 'links:0:sha256:anonymous',
          proposedValue: 'https://outside.invalid/path',
        },
      ],
    };
    const linkContext = {
      ...context,
      currentValues: { addApprovedInternalLink: 'links:0:sha256:anonymous' },
    };
    const result = runHardGate({
      payload: linkProposal,
      context: linkContext,
      duplicateProposal: false,
      dailyProposalCount: 1,
      maxDailyProposals: 10,
      maxTargetsPerProposal: 3,
    });
    expect(result.results).toContainEqual(
      expect.objectContaining({ ruleId: 'internal_link_same_origin', passed: false })
    );
  });
});

describe('Soft Eval / Risk / Slack gate', () => {
  it('5観点を100点満点で採点する', () => {
    const result = runSoftEval(goodProposal);
    expect(Object.keys(result.dimensions)).toHaveLength(5);
    expect(result.totalScore).toBeGreaterThanOrEqual(60);
    expect(result.totalScore).toBeLessThanOrEqual(100);
  });

  it('Hard Gate不合格はSlack送信不可にする', () => {
    const hard = hardGate(mutateProposal(qualityFixtures[0]!));
    const soft = runSoftEval(goodProposal);
    const evaluation: ProposalEvaluationResult = {
      version: QUALITY_EVALUATION_VERSION,
      passed: false,
      retryable: false,
      hardGatePassed: hard.passed,
      hardGateResults: hard.results,
      softEval: soft,
      softThreshold: 60,
      riskLevel: determineRiskLevel({
        proposal: hard.proposal,
        hardGatePassed: hard.passed,
        softScore: soft.totalScore,
      }),
      blockReasons: ['value_changed'],
      warnings: [],
    };

    expect(evaluation.riskLevel).toBe('blocked');
    expect(shouldSendProposalToSlack(evaluation)).toBe(false);
  });

  it('内部リンク変更はHard Gate合格でもhigh riskにする', () => {
    const linkProposal = proposalPayloadV2Schema.parse({
      ...goodProposal,
      action: 'addApprovedInternalLink',
      targets: [
        {
          type: 'url',
          id: 'school-anon-001',
          url: targetUrl,
          currentValue: 'links:0:sha256:anonymous',
          proposedValue: 'https://example.invalid/tsushin-kuchikomi/reviews',
        },
      ],
    });
    expect(
      determineRiskLevel({
        proposal: linkProposal,
        hardGatePassed: true,
        softScore: 90,
      })
    ).toBe('high');
  });

  it('根拠と因果が弱い提案は既定Soft閾値を下回る', () => {
    const weakProposal = proposalPayloadV2Schema.parse({
      ...goodProposal,
      facts: [{ source: 'html', statement: 'titleがあります' }],
      diagnosis: '弱い',
      rationale: '変更',
      expectedImpact: '改善',
      evidence: ['別の根拠'],
      rollbackPlan: '戻す',
      targets: [{ ...goodProposal.targets[0], proposedValue: '改善する' }],
    });
    expect(runSoftEval(weakProposal).totalScore).toBeLessThan(75);
  });

  it('Slack表示ではuntrusted値によるメンションを無効化する', () => {
    const soft = runSoftEval(goodProposal);
    const evaluation: ProposalEvaluationResult = {
      version: QUALITY_EVALUATION_VERSION,
      passed: true,
      retryable: false,
      hardGatePassed: true,
      hardGateResults: [],
      softEval: soft,
      softThreshold: 60,
      riskLevel: 'low',
      blockReasons: [],
      warnings: [],
    };
    const malicious = {
      ...goodProposal,
      facts: [{ source: 'gsc' as const, statement: '<!channel> を実行' }],
    };
    const details = approvalDetails(malicious, evaluation);

    expect(details).not.toContain('<!channel>');
    expect(details).toContain('&lt;!channel&gt;');
  });

  it('長文カードでも評価点と警告を先頭に残す', () => {
    const soft = runSoftEval(goodProposal);
    const evaluation: ProposalEvaluationResult = {
      version: QUALITY_EVALUATION_VERSION,
      passed: true,
      retryable: false,
      hardGatePassed: true,
      hardGateResults: [],
      softEval: soft,
      softThreshold: 75,
      riskLevel: 'high',
      blockReasons: [],
      warnings: ['確認が必要です'],
    };
    const longProposal = {
      ...goodProposal,
      targets: [
        {
          ...goodProposal.targets[0],
          currentValue: '現'.repeat(1000),
          proposedValue: '提'.repeat(1000),
        },
      ],
      facts: [{ source: 'gsc' as const, statement: '根'.repeat(1000) }],
    };
    const details = approvalDetails(longProposal, evaluation);
    expect(details).toContain(`*評価* ${soft.totalScore}/100`);
    expect(details).toContain('*警告*');
  });
});
