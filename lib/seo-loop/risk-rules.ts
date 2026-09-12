import type { FactContextSnapshot } from './context/types';
import type { ProposalPayloadV2, TypedAction } from './types';
import type {
  RulebookContent,
} from './rulebook/schema';

export type RiskLevel = 'low' | 'medium' | 'high' | 'blocked';

export const ACTION_VALUE_LIMITS: Record<
  TypedAction,
  { min: number; max: number }
> = {
  updateSchoolMetaTitle: { min: 10, max: 60 },
  updateFeatureMetaDescription: { min: 30, max: 160 },
  updateSeoSummary: { min: 80, max: 3000 },
  addApprovedInternalLink: { min: 10, max: 2048 },
};

export const FORBIDDEN_SEO_EXPRESSIONS: RegExp[] = [
  /絶対に?合格/u,
  /必ず合格/u,
  /確実に(?:合格|卒業)/u,
  /(?:日本一|業界\s*No\.?\s*1)/iu,
  /100\s*%/u,
  /(?:合格|卒業)を保証/u,
  /最安(?:値)?/u,
];

const FORBIDDEN_EXPRESSION_REGISTRY: Record<
  RulebookContent['risk']['forbiddenExpressionIds'][number],
  RegExp[]
> = {
  guaranteed_acceptance: [/絶対に?合格/u, /必ず合格/u],
  number_one_claim: [/(?:日本一|業界\s*No\.?\s*1)/iu],
  absolute_percentage: [/100\s*%/u],
  outcome_guarantee: [/(?:合格|卒業)を保証/u, /確実に(?:合格|卒業)/u],
  lowest_price_claim: [/最安(?:値)?/u],
};

export function repeatedBrandName(
  proposal: ProposalPayloadV2,
  context: FactContextSnapshot
): string | null {
  if (proposal.action !== 'updateSchoolMetaTitle' || context.database?.type !== 'school') {
    return null;
  }
  const schoolName = context.database.name;
  const value = proposal.targets.map((target) => target.proposedValue).join('\n');
  return value.split(schoolName).length - 1 > 1 ? schoolName : null;
}

export function containsSiteBrand(proposal: ProposalPayloadV2): boolean {
  if (
    proposal.action !== 'updateSchoolMetaTitle' &&
    proposal.action !== 'updateFeatureMetaDescription'
  ) {
    return false;
  }
  return proposal.targets.some((target) =>
    target.proposedValue.includes('通信制高校リアルレビュー')
  );
}

export function forbiddenExpressions(
  proposal: ProposalPayloadV2,
  enabledIds?: RulebookContent['risk']['forbiddenExpressionIds']
): string[] {
  const text = proposal.targets.map((target) => target.proposedValue).join('\n');
  const expressions = enabledIds
    ? enabledIds.flatMap((id) => FORBIDDEN_EXPRESSION_REGISTRY[id])
    : FORBIDDEN_SEO_EXPRESSIONS;
  return expressions
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source);
}

export function determineRiskLevel(params: {
  proposal: ProposalPayloadV2 | null;
  hardGatePassed: boolean;
  softScore: number;
  softScoreThreshold?: number;
  highRiskConfidenceBelow?: number;
}): RiskLevel {
  if (!params.hardGatePassed || !params.proposal) return 'blocked';
  if (params.proposal.action === 'addApprovedInternalLink') return 'high';
  if (
    params.softScore < (params.softScoreThreshold ?? 75) ||
    params.proposal.confidence < (params.highRiskConfidenceBelow ?? 0.6)
  ) {
    return 'high';
  }
  if (params.proposal.action === 'updateSeoSummary') return 'medium';
  return 'low';
}
