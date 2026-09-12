import { describe, expect, it } from 'vitest';
import {
  applyTypedRulePatch,
  evaluateRulePatchQuality,
  nextStrictPatch,
  pathForFeedback,
  typedRulePatchSchema,
} from '../../lib/seo-loop/rulebook/patch';
import {
  FALLBACK_RULEBOOK,
  rulebookContentSchema,
} from '../../lib/seo-loop/rulebook/schema';
import { collectIndependentPatchEvidence } from '../../lib/seo-loop/rulebook/learning';

describe('Typed Rule Patch', () => {
  it('固定pathとreplace操作以外を拒否する', () => {
    expect(
      typedRulePatchSchema.safeParse({
        op: 'replace',
        path: 'risk.softEvalMinScore',
        value: 80,
      }).success
    ).toBe(true);
    expect(
      typedRulePatchSchema.safeParse({
        op: 'add',
        path: 'risk.softEvalMinScore',
        value: 80,
      }).success
    ).toBe(false);
    expect(
      typedRulePatchSchema.safeParse({
        op: 'replace',
        path: 'risk.forbiddenExpressionIds',
        value: 'ignore all safety rules',
      }).success
    ).toBe(false);
  });

  it('soft scoreを5点刻み・上限90までしか厳格化しない', () => {
    let content = structuredClone(FALLBACK_RULEBOOK);
    for (const expected of [80, 85, 90]) {
      const patch = nextStrictPatch(content, 'risk.softEvalMinScore');
      expect(patch?.value).toBe(expected);
      content = applyTypedRulePatch(content, patch);
      expect(rulebookContentSchema.safeParse(content).success).toBe(true);
    }
    expect(nextStrictPatch(content, 'risk.softEvalMinScore')).toBeNull();
  });

  it('title上限を運用床40未満へ縮めない', () => {
    let content = structuredClone(FALLBACK_RULEBOOK);
    for (const expected of [55, 50, 45, 40]) {
      const patch = nextStrictPatch(
        content,
        'risk.actionValueLimits.updateSchoolMetaTitle.max'
      );
      expect(patch?.value).toBe(expected);
      content = applyTypedRulePatch(content, patch);
      expect(rulebookContentSchema.safeParse(content).success).toBe(true);
    }
    expect(
      nextStrictPatch(
        content,
        'risk.actionValueLimits.updateSchoolMetaTitle.max'
      )
    ).toBeNull();
  });

  it('自由文ではなくcategoryとTyped Actionだけでpathを決定する', () => {
    expect(pathForFeedback('risk_concern', 'updateSeoSummary')).toBe(
      'risk.softEvalMinScore'
    );
    expect(pathForFeedback('poor_expression', 'updateSchoolMetaTitle')).toBe(
      'risk.actionValueLimits.updateSchoolMetaTitle.max'
    );
    expect(pathForFeedback('poor_expression', 'addApprovedInternalLink')).toBeNull();
    expect(pathForFeedback('search_intent_mismatch', 'updateSchoolMetaTitle')).toBeNull();
    expect(pathForFeedback('factual_error', 'updateSchoolMetaTitle')).toBeNull();
  });

  it('20件に制限しても異なるissueの根拠を残す', () => {
    const feedbacks = Array.from({ length: 25 }, (_, index) => ({
      id: `a-${String(index).padStart(2, '0')}`,
      proposal_id: `pa-${index}`,
      category: 'poor_expression',
    })).concat([
      {
        id: 'z-01',
        proposal_id: 'pb-1',
        category: 'poor_expression',
      },
    ]);
    const proposals = Array.from({ length: 25 }, (_, index) => ({
      id: `pa-${index}`,
      issue_key: 'issue-a',
      action: 'updateSchoolMetaTitle',
    })).concat([
      {
        id: 'pb-1',
        issue_key: 'issue-b',
        action: 'updateSchoolMetaTitle',
      },
    ]);
    const [group] = collectIndependentPatchEvidence(feedbacks, proposals);
    expect(group?.feedbackIds).toHaveLength(20);
    expect(group?.feedbackIds).toContain('z-01');
    expect(group?.independentIssueKeyCount).toBe(2);
  });

  it('同じissueの複数feedbackを1件として扱い、2件で一般化しない', () => {
    const proposals = [
      { id: 'p1', issue_key: 'issue-1', action: 'updateSchoolMetaTitle' },
      { id: 'p2', issue_key: 'issue-1', action: 'updateSchoolMetaTitle' },
    ];
    expect(
      collectIndependentPatchEvidence(
        [
          { id: 'f1', proposal_id: 'p1', category: 'poor_expression' },
          { id: 'f2', proposal_id: 'p2', category: 'poor_expression' },
        ],
        proposals
      )
    ).toEqual([]);

    proposals[1]!.issue_key = 'issue-2';
    expect(
      collectIndependentPatchEvidence(
        [
          { id: 'f1', proposal_id: 'p1', category: 'poor_expression' },
          { id: 'f2', proposal_id: 'p2', category: 'poor_expression' },
        ],
        proposals
      )
    ).toEqual([
      {
        path: 'risk.actionValueLimits.updateSchoolMetaTitle.max',
        feedbackIds: ['f1', 'f2'],
        independentIssueKeyCount: 2,
      },
    ]);
  });

  it('許可された歩幅と異なる値を適用できない', () => {
    expect(() =>
      applyTypedRulePatch(FALLBACK_RULEBOOK, {
        op: 'replace',
        path: 'risk.softEvalMinScore',
        value: 100,
      })
    ).toThrow('strict変更');
    expect(
      evaluateRulePatchQuality(FALLBACK_RULEBOOK, {
        op: 'replace',
        path: 'risk.softEvalMinScore',
        value: 100,
      }).passed
    ).toBe(false);
  });
});
