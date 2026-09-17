import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { FactContextSnapshot } from '../../lib/seo-loop/context/types';
import {
  buildFactInventory,
  minimumFactErrors,
  validateAnalystGrounding,
} from '../../lib/seo-loop/analysis/facts';
import { candidateActionsForIssue } from '../../lib/seo-loop/analysis/policy';
import {
  STRATEGIST_CONTENT_POLICY,
  STRATEGIST_NULL_CONDITIONS,
  strategistInput,
} from '../../lib/seo-loop/analysis/prompts';
import {
  assembleProposalV2,
  validateStrategistAction,
} from '../../lib/seo-loop/analysis/strategy';
import { runStructuredStage } from '../../lib/seo-loop/analysis/structured';
import { analystOutputSchema } from '../../lib/seo-loop/analysis/types';
import {
  type TypedAction,
} from '../../lib/seo-loop/types';

type PolicyFixture = {
  id: string;
  issueType: string;
  pageType: FactContextSnapshot['target']['pageType'];
  currentValues: Partial<Record<TypedAction, string>>;
  expectedActions: TypedAction[];
};

const fixturePath = fileURLToPath(new URL('./fixtures/analysis-cases.json', import.meta.url));
const fixtures = JSON.parse(readFileSync(fixturePath, 'utf8')) as PolicyFixture[];

function contextFor(fixture: PolicyFixture): FactContextSnapshot {
  return {
    version: 1,
    collectedAt: '2026-09-10T00:00:00.000Z',
    target: {
      pageType: fixture.pageType,
      id: 'target-anon-001',
      slug: 'anonymous',
      url: 'https://example.invalid/tsushin-kuchikomi/schools/anonymous',
    },
    html: {
      status: 200,
      title: '匿名ページ',
      description: '匿名ページの説明',
      canonical: 'https://example.invalid/tsushin-kuchikomi/schools/anonymous',
      robots: 'index,follow',
      h1: '匿名ページ',
      internalLinks: [],
    },
    database: null,
    currentValues: fixture.currentValues,
  };
}

describe('issue typeから候補actionへの固定mapping', () => {
  it.each(fixtures)('$id', (fixture) => {
    expect(candidateActionsForIssue(fixture.issueType, contextFor(fixture))).toEqual(
      fixture.expectedActions
    );
  });

  it('旧一段方式の全action許可と比べて対象/action誤りを減らす', () => {
    const allActions: TypedAction[] = [
      'updateSchoolMetaTitle',
      'updateFeatureMetaDescription',
      'updateSeoSummary',
      'addApprovedInternalLink',
    ];
    const legacyWrongCandidates = fixtures.reduce(
      (total, fixture) =>
        total + allActions.filter((action) => !fixture.expectedActions.includes(action)).length,
      0
    );
    const mappedWrongCandidates = fixtures.reduce((total, fixture) => {
      const actual = candidateActionsForIssue(fixture.issueType, contextFor(fixture));
      return total + actual.filter((action) => !fixture.expectedActions.includes(action)).length;
    }, 0);

    expect(legacyWrongCandidates).toBeGreaterThan(0);
    expect(mappedWrongCandidates).toBe(0);
  });
});

describe('AnalystのFact grounding', () => {
  const context = contextFor(fixtures[0]!);
  const inventory = buildFactInventory(
    {
      issueType: 'low_ctr_high_impressions',
      title: 'CTRが低い',
      description: '表示回数1000、CTR1%',
      query: '匿名校 口コミ',
      gscSnapshot: { impressions: 1000, ctr: 0.01 },
      scores: { confidence: 0.75 },
    },
    context,
    {
      pageTopQueries: [
        {
          query: '匿名校 口コミ',
          clicks: 2,
          impressions: 400,
          ctr: 0.005,
          position: 9.2,
          deltaClicks: -1,
        },
        {
          query: '匿名校 学費',
          clicks: 1,
          impressions: 220,
          ctr: 0.0045,
          position: 11.0,
          deltaClicks: 0,
        },
      ],
    }
  );

  it('ページ上位クエリ内訳をFact inventoryへ載せる', () => {
    expect(inventory.some((fact) => fact.id === 'gsc.page_queries')).toBe(true);
    expect(
      inventory.find((fact) => fact.id === 'gsc.page_queries')?.statement
    ).toContain('匿名校 学費');
  });

  it('取得失敗時はunavailable Factを載せる', () => {
    const withError = buildFactInventory(
      {
        issueType: 'low_ctr_high_impressions',
        title: 'CTRが低い',
        description: null,
        query: null,
        gscSnapshot: { impressions: 1000, ctr: 0.01 },
        scores: null,
      },
      context,
      { pageTopQueriesError: 'GSC timeout' }
    );
    expect(
      withError.find((fact) => fact.id === 'gsc.page_queries_unavailable')?.statement
    ).toContain('GSC timeout');
  });

  it('inventoryにないFact IDを拒否する', () => {
    const analyst = analystOutputSchema.parse({
      sufficient: true,
      selectedFactIds: ['gsc.snapshot', 'invented.fact'],
      hypotheses: ['タイトルが検索意図を示していない'],
      missingInformation: [],
      diagnosis: 'CTR低下の原因候補がタイトルにある',
      targetMetric: 'ctr',
      confidence: 0.7,
    });
    expect(validateAnalystGrounding(analyst, inventory)).toEqual([
      'Fact inventoryに存在しないIDです: invented.fact',
    ]);
  });

  it('事実不足時に診断・指標を要求しない', () => {
    expect(
      analystOutputSchema.safeParse({
        sufficient: false,
        selectedFactIds: [],
        hypotheses: [],
        missingInformation: ['対象queryが不明'],
        diagnosis: null,
        targetMetric: null,
        confidence: 0,
      }).success
    ).toBe(true);
  });

  it('課題条件を裏付けないGSC snapshotを事前に拒否する', () => {
    expect(
      minimumFactErrors(
        {
          issueType: 'low_ctr_high_impressions',
          gscSnapshot: { impressions: 20, ctr: 0.1, position: 30 },
        },
        context
      )
    ).toContain('低CTR課題を裏付けるGSC実測値が不足しています');
    expect(
      minimumFactErrors(
        {
          issueType: 'low_ctr_high_impressions',
          gscSnapshot: { impressions: 1000, ctr: 0.01, position: 8 },
        },
        context
      )
    ).toEqual([]);
  });
});

describe('Strategistのgrounding', () => {
  const analyst = analystOutputSchema.parse({
    sufficient: true,
    selectedFactIds: ['gsc.snapshot'],
    hypotheses: ['タイトルが検索意図を示していない'],
    missingInformation: [],
    diagnosis: 'CTR低下の原因候補がタイトルにある',
    targetMetric: 'ctr',
    confidence: 0.7,
  });
  const fact = {
    id: 'gsc.snapshot',
    source: 'gsc' as const,
    statement: 'GSC snapshot: {"ctr":0.01,"impressions":1000}',
  };
  const strategy = {
    proposal: {
      action: 'updateSchoolMetaTitle' as const,
      proposedValue: '匿名校の口コミ・評判',
      rollbackPlan: '元のtitleへ戻す',
      rationale: '実測CTRと検索意図に基づく',
      expectedImpact: 'CTR改善',
    },
  };

  it('固定候補外actionを拒否する', () => {
    const wrongAction = {
      proposal: {
        ...strategy.proposal,
        action: 'updateSeoSummary' as const,
      },
    };

    expect(validateStrategistAction(wrongAction, ['updateSchoolMetaTitle'])).toContain(
      'issue typeの候補外actionです: updateSeoSummary'
    );
  });

  it('ID・URL・currentValue・Factをアプリ側で組み立てる', () => {
    const context = contextFor(fixtures[0]!);
    const proposal = assembleProposalV2({
      strategist: strategy,
      analyst,
      selectedFacts: [fact],
      context,
    });

    expect(proposal).toMatchObject({
      schemaVersion: 2,
      action: 'updateSchoolMetaTitle',
      targets: [
        {
          type: 'school',
          id: context.target.id,
          url: context.target.url,
          currentValue: context.currentValues.updateSchoolMetaTitle,
          proposedValue: '匿名校の口コミ・評判',
        },
      ],
      facts: [{ source: fact.source, statement: fact.statement }],
      diagnosis: analyst.diagnosis,
      targetMetric: analyst.targetMetric,
      confidence: analyst.confidence,
    });
  });
});

describe('Strategistへ渡す生成ポリシー', () => {
  it('言い換え・短縮・構造破壊を禁止し、null条件を明示する', () => {
    expect(STRATEGIST_CONTENT_POLICY.forbidden).toContain(
      '見出しや箇条書きを<br>や<br />に置き換えて構造を潰すこと'
    );
    expect(STRATEGIST_CONTENT_POLICY.forbidden).toContain(
      'currentValueよりproposedValueの文字数が減るだけのupdateSeoSummary'
    );
    expect(
      STRATEGIST_CONTENT_POLICY.required.some((rule) =>
        rule.includes('具体的比較軸')
      )
    ).toBe(true);
    expect(
      STRATEGIST_CONTENT_POLICY.required.some((rule) =>
        rule.includes('既出の地名・固有名詞の並べ替え')
      )
    ).toBe(true);
    expect(STRATEGIST_NULL_CONDITIONS).toContain(
      'currentValueの言い換え・語順入れ替え・語尾調整しか思いつかないとき'
    );
  });

  it('issue typeとaction優先順をStrategist入力に含める', () => {
    const input = strategistInput({
      analyst: analystOutputSchema.parse({
        sufficient: true,
        selectedFactIds: ['gsc.snapshot'],
        hypotheses: ['タイトルが検索意図を示していない'],
        missingInformation: [],
        diagnosis: 'CTR低下の原因候補がタイトルにある',
        targetMetric: 'ctr',
        confidence: 0.7,
      }),
      selectedFacts: [],
      candidateActions: ['updateSchoolMetaTitle', 'updateSeoSummary'],
      context: contextFor(fixtures[0]!),
      issueType: 'striking_distance',
      retryError: null,
    }) as Record<string, unknown>;

    expect(input.issueType).toBe('striking_distance');
    expect(input.candidateActionsAreOrderedByPriority).toBe(true);
    expect(input.nullConditions).toBe(STRATEGIST_NULL_CONDITIONS);
  });
});

describe('構造化出力の再試行', () => {
  it('不正JSONを記録し、2回目の有効JSONを採用する', async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({
        content: 'not-json',
        tokensUsed: { prompt: 1, completion: 1, total: 2 },
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          sufficient: false,
          selectedFactIds: [],
          hypotheses: [],
          missingInformation: ['データ不足'],
          diagnosis: null,
          targetMetric: null,
          confidence: 0,
        }),
        tokensUsed: { prompt: 2, completion: 2, total: 4 },
      });

    const result = await runStructuredStage({
      schema: analystOutputSchema,
      maxAttempts: 2,
      makeInput: (attempt, previousError) => ({ attempt, previousError }),
      call,
    });

    expect(result.data?.sufficient).toBe(false);
    expect(result.attempts.map((attempt) => attempt.status)).toEqual([
      'invalid_output',
      'succeeded',
    ]);
    expect(result.attempts[0]?.inputHash).not.toBe(result.attempts[1]?.inputHash);
    expect(call).toHaveBeenCalledTimes(2);
  });
});
