import { z } from 'zod';
import { payloadHash } from '../hash';
import { rulebookContentSchema, type RulebookContent } from './schema';

export const rulePatchPathSchema = z.enum([
  'risk.actionValueLimits.updateSchoolMetaTitle.max',
  'risk.actionValueLimits.updateFeatureMetaDescription.max',
  'risk.softEvalMinScore',
]);
export type RulePatchPath = z.infer<typeof rulePatchPathSchema>;

export const typedRulePatchSchema = z
  .object({
    op: z.literal('replace'),
    path: rulePatchPathSchema,
    value: z.number().int(),
  })
  .strict();
export type TypedRulePatch = z.infer<typeof typedRulePatchSchema>;

const policy: Record<
  RulePatchPath,
  { direction: 'increase' | 'decrease'; step: number; floor?: number; ceiling?: number }
> = {
  'risk.actionValueLimits.updateSchoolMetaTitle.max': {
    direction: 'decrease',
    step: 5,
    floor: 40,
  },
  'risk.actionValueLimits.updateFeatureMetaDescription.max': {
    direction: 'decrease',
    step: 10,
    floor: 100,
  },
  'risk.softEvalMinScore': {
    direction: 'increase',
    step: 5,
    ceiling: 90,
  },
};

export function currentPatchValue(
  content: RulebookContent,
  path: RulePatchPath
): number {
  switch (path) {
    case 'risk.actionValueLimits.updateSchoolMetaTitle.max':
      return content.risk.actionValueLimits.updateSchoolMetaTitle.max;
    case 'risk.actionValueLimits.updateFeatureMetaDescription.max':
      return content.risk.actionValueLimits.updateFeatureMetaDescription.max;
    case 'risk.softEvalMinScore':
      return content.risk.softEvalMinScore;
  }
}

export function nextStrictPatch(
  content: RulebookContent,
  path: RulePatchPath
): TypedRulePatch | null {
  const current = currentPatchValue(content, path);
  const rule = policy[path];
  const value =
    rule.direction === 'increase' ? current + rule.step : current - rule.step;
  if (rule.floor !== undefined && value < rule.floor) return null;
  if (rule.ceiling !== undefined && value > rule.ceiling) return null;
  return { op: 'replace', path, value };
}

export function applyTypedRulePatch(
  content: RulebookContent,
  patchInput: unknown
): RulebookContent {
  const patch = typedRulePatchSchema.parse(patchInput);
  const current = currentPatchValue(content, patch.path);
  const expected = nextStrictPatch(content, patch.path);
  if (!expected || expected.value !== patch.value || patch.value === current) {
    throw new Error('patchは許可された歩幅・運用床を満たすstrict変更ではありません');
  }

  const next = structuredClone(content);
  switch (patch.path) {
    case 'risk.actionValueLimits.updateSchoolMetaTitle.max':
      next.risk.actionValueLimits.updateSchoolMetaTitle.max = patch.value;
      break;
    case 'risk.actionValueLimits.updateFeatureMetaDescription.max':
      next.risk.actionValueLimits.updateFeatureMetaDescription.max = patch.value;
      break;
    case 'risk.softEvalMinScore':
      next.risk.softEvalMinScore = patch.value;
      break;
  }
  return rulebookContentSchema.parse(next);
}

export function rulePatchHash(patch: TypedRulePatch): string {
  return payloadHash(patch);
}

export function evaluateRulePatchQuality(
  content: RulebookContent,
  patchInput: unknown
): {
  passed: boolean;
  proposedContent: RulebookContent | null;
  checks: Record<string, boolean>;
} {
  const parsedPatch = typedRulePatchSchema.safeParse(patchInput);
  let proposedContent: RulebookContent | null = null;
  if (parsedPatch.success) {
    try {
      proposedContent = applyTypedRulePatch(content, parsedPatch.data);
    } catch {
      proposedContent = null;
    }
  }
  const checks = {
    typedPath: parsedPatch.success,
    strictDirection:
      parsedPatch.success &&
      nextStrictPatch(content, parsedPatch.data.path)?.value ===
        parsedPatch.data.value,
    operationalFloor: proposedContent !== null,
    schemaValid:
      proposedContent !== null &&
      rulebookContentSchema.safeParse(proposedContent).success,
    contentChanged:
      proposedContent !== null &&
      payloadHash(proposedContent) !== payloadHash(content),
  };
  return {
    passed: Object.values(checks).every(Boolean),
    proposedContent,
    checks,
  };
}

export function pathForFeedback(
  category: string,
  action: string
): RulePatchPath | null {
  if (
    category === 'risk_concern' ||
    category === 'weak_evidence' ||
    category === 'expected_impact_unclear'
  ) {
    return 'risk.softEvalMinScore';
  }
  if (category !== 'poor_expression') return null;
  if (action === 'updateSchoolMetaTitle') {
    return 'risk.actionValueLimits.updateSchoolMetaTitle.max';
  }
  if (action === 'updateFeatureMetaDescription') {
    return 'risk.actionValueLimits.updateFeatureMetaDescription.max';
  }
  return null;
}
