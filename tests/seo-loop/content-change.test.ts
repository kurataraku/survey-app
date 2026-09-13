import { describe, expect, it } from 'vitest';
import type { FactContextSnapshot } from '../../lib/seo-loop/context/types';
import { validateProposalAgainstContext } from '../../lib/seo-loop/context/validate';
import {
  contentChangeRegressions,
  structuredTextRegressions,
  summarizeTextChange,
} from '../../lib/seo-loop/content-change';
import { runHardGate } from '../../lib/seo-loop/evaluation/hard-gate';
import { runSoftEval } from '../../lib/seo-loop/evaluation/soft-eval';
import { QUALITY_EVALUATION_VERSION } from '../../lib/seo-loop/evaluation/evaluate';
import type { ProposalEvaluationResult } from '../../lib/seo-loop/evaluation/types';
import { approvalDetails, changeOverview } from '../../lib/seo-loop/slack';
import { proposalPayloadV2Schema } from '../../lib/seo-loop/types';

const targetUrl = 'https://example.invalid/tsushin-kuchikomi/schools/anonymous';
const existingLink = 'https://example.invalid/tsushin-kuchikomi/features/transfer';

const currentSummary = [
  '匿名通信制高校は、登校日数を週1〜5日から選べる柔軟な通学スタイルが特徴です。自分のペースで学習したい生徒に向いています。',
  '',
  '## この学校が合う人',
  '- 自分のペースで学習したい人',
  '- 資格取得や趣味に力を入れたい人',
  '',
  '## 学費・通学スタイルの注意点',
  '- 学費は公立高校より高く、年間負担は約2倍との声があります。',
].join('\n');

const context: FactContextSnapshot = {
  version: 1,
  collectedAt: '2026-09-12T00:00:00.000Z',
  target: {
    pageType: 'school',
    id: 'school-anon-001',
    slug: 'anonymous',
    url: targetUrl,
  },
  html: {
    status: 200,
    title: '匿名通信制高校の口コミ・評判',
    description: '匿名説明',
    canonical: targetUrl,
    robots: 'index,follow',
    h1: '匿名通信制高校',
    internalLinks: [existingLink],
  },
  database: {
    type: 'school',
    id: 'school-anon-001',
    name: '匿名通信制高校',
    slug: 'anonymous',
    isPublic: true,
    aiSummary: {
      summaryText: currentSummary,
      metaTitle: '匿名通信制高校の口コミ',
      metaDescription: null,
    },
  },
  currentValues: {
    updateSeoSummary: currentSummary,
    addApprovedInternalLink: `links:1:sha256:anonymous`,
  },
};

function summaryProposal(proposedValue: string): unknown {
  return {
    schemaVersion: 2,
    action: 'updateSeoSummary',
    targets: [
      {
        type: 'school',
        id: 'school-anon-001',
        url: targetUrl,
        currentValue: currentSummary,
        proposedValue,
      },
    ],
    facts: [
      { source: 'gsc', statement: 'Query: 匿名通信制高校 口コミ' },
      { source: 'gsc', statement: '平均掲載順位8.2位、表示回数1348' },
    ],
    assumptions: ['検索意図に対する情報が不足している可能性がある'],
    diagnosis: '5〜15位圏で表示回数が多いため、本文の情報充実で改善余地がある',
    targetMetric: 'clicks',
    confidence: 0.7,
    ruleIds: [],
    rollbackPlan: '保存済みの元要約へ戻す',
    rationale: 'GSCで平均順位8.2位、表示回数1348のため本文改善の余地がある',
    expectedImpact: '検索意図に合う情報を足すことでクリック数の増加を期待する',
    evidence: ['Query: 匿名通信制高校 口コミ', '平均掲載順位8.2位、表示回数1348'],
  };
}

function linkProposal(proposedValue: string): unknown {
  return {
    ...(summaryProposal('dummy') as Record<string, unknown>),
    action: 'addApprovedInternalLink',
    targets: [
      {
        type: 'url',
        id: 'school-anon-001',
        url: targetUrl,
        currentValue: 'links:1:sha256:anonymous',
        proposedValue,
      },
    ],
  };
}

function hardGate(payload: unknown) {
  return runHardGate({
    payload,
    context,
    duplicateProposal: false,
    dailyProposalCount: 1,
    maxDailyProposals: 10,
    maxTargetsPerProposal: 3,
  });
}

describe('本文の情報削減を止める', () => {
  const shortened =
    '匿名通信制高校は、登校日数を週1〜5日から選べる柔軟な通学スタイルが特徴です。自分のペースで学習したい生徒や、資格取得を重視する家庭に向いています。学費は公立高校より高い点に注意が必要です。';

  it('見出しと箇条書きの削除、短文化を検出する', () => {
    const change = summarizeTextChange(currentSummary, shortened);
    expect(change.removedHeadings).toEqual([
      'この学校が合う人',
      '学費・通学スタイルの注意点',
    ]);
    expect(change.removedBulletCount).toBe(3);
    expect(change.retainedRatio).toBeLessThan(0.8);
    expect(structuredTextRegressions(currentSummary, shortened)).toHaveLength(3);
  });

  it('Hard Gateはcontent_structure_preservedを警告として通す', () => {
    const result = hardGate(summaryProposal(shortened));
    expect(result.passed).toBe(true);
    expect(result.results).toContainEqual(
      expect.objectContaining({
        ruleId: 'content_structure_preserved',
        passed: false,
        severity: 'warn',
      })
    );
  });

  it('生成時の検証では構造退行を差し戻さない', () => {
    const proposal = proposalPayloadV2Schema.parse(summaryProposal(shortened));
    expect(validateProposalAgainstContext(proposal, context)).toEqual([]);
  });

  it('見出しと箇条書きを保ったまま情報を足す案は通す', () => {
    const improved = `${currentSummary}\n- スクーリングは年数回のため、通学負担を抑えたい人にも向いています。`;
    expect(structuredTextRegressions(currentSummary, improved)).toEqual([]);
    expect(hardGate(summaryProposal(improved)).results).toContainEqual(
      expect.objectContaining({
        ruleId: 'content_structure_preserved',
        passed: true,
        severity: 'warn',
      })
    );
  });
});

describe('重複する内部リンク追加を止める', () => {
  it('既存リンクと同じURLをHard Gateで停止する', () => {
    const result = hardGate(linkProposal(`${existingLink}/`));
    expect(result.passed).toBe(false);
    expect(result.results).toContainEqual(
      expect.objectContaining({ ruleId: 'internal_link_not_duplicated', passed: false })
    );
  });

  it('対象ページ自身へのリンク追加を停止する', () => {
    expect(
      contentChangeRegressions(
        proposalPayloadV2Schema.parse(linkProposal(targetUrl)),
        context
      )
    ).toContainEqual('対象ページ自身へのリンク追加は効果がありません');
  });

  it('未設置の内部リンクは通す', () => {
    const result = hardGate(
      linkProposal('https://example.invalid/tsushin-kuchikomi/features/tuition')
    );
    expect(result.results).toContainEqual(
      expect.objectContaining({ ruleId: 'internal_link_not_duplicated', passed: true })
    );
    expect(result.passed).toBe(true);
  });
});

describe('Slackの変更前後表示', () => {
  const evaluation: ProposalEvaluationResult = {
    version: QUALITY_EVALUATION_VERSION,
    passed: true,
    retryable: false,
    hardGatePassed: true,
    hardGateResults: [
      {
        ruleId: 'content_structure_preserved',
        passed: false,
        severity: 'warn',
        message: '既存の見出し・箇条書き・情報量を削減しています',
      },
    ],
    softEval: runSoftEval(
      proposalPayloadV2Schema.parse(summaryProposal(`${currentSummary}\n- 追加情報`))
    ),
    softThreshold: 75,
    riskLevel: 'medium',
    blockReasons: [],
    warnings: [],
  };

  it('文字数と削除される見出しを明示する', () => {
    const proposal = proposalPayloadV2Schema.parse(
      summaryProposal('匿名通信制高校は自分のペースで学べる通信制高校です。'.repeat(3))
    );
    const overview = changeOverview(proposal);
    expect(overview).toContain('文字数:');
    expect(overview).toContain('削除される見出し: この学校が合う人 / 学費・通学スタイルの注意点');
    const details = approvalDetails(proposal, evaluation);
    expect(details).toContain('*変更内容*');
    expect(details).toContain('*Hard Gate警告（承認は可能）*');
    expect(details).toContain(`対象URL: ${targetUrl}`);
  });

  it('内部リンク追加では追加先と件数の増減を示す', () => {
    const proposal = proposalPayloadV2Schema.parse(
      linkProposal('https://example.invalid/tsushin-kuchikomi/features/tuition')
    );
    expect(changeOverview(proposal)).toContain('内部リンク 1件 → 2件');
  });
});
