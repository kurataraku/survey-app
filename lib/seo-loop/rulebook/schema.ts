import { z } from 'zod';
import { typedActionSchema } from '../types';

const actionListSchema = z.array(typedActionSchema).min(1).max(4);
const actionLimitsSchema = z
  .object({
    min: z.number().int().min(1).max(3000),
    max: z.number().int().min(1).max(5000),
  })
  .refine((value) => value.min <= value.max, 'min must not exceed max');

export const forbiddenExpressionIdSchema = z.enum([
  'guaranteed_acceptance',
  'number_one_claim',
  'absolute_percentage',
  'outcome_guarantee',
  'lowest_price_claim',
]);
const requiredForbiddenExpressionIds = forbiddenExpressionIdSchema.options;
const requiredRuleIds = [
  'analyzer.issue_action_map.v1',
  'analyzer.fact_grounding.v1',
  'analyzer.untrusted_input.v1',
  'risk.typed_action_allowlist.v1',
  'risk.action_value_limits.v1',
  'risk.forbidden_expressions.v1',
  'risk.same_origin_link.v1',
  'risk.confidence_threshold.v1',
  'ops.daily_proposal_limit.v1',
  'ops.target_limit.v1',
  'ops.human_approval.v1',
] as const;

export const rulebookContentSchema = z
  .object({
    schemaVersion: z.literal(1),
    analyzer: z
      .object({
        ruleIds: z.array(z.string().min(1)).min(1),
        issueActionCandidates: z.object({
          low_ctr_high_impressions: actionListSchema,
          striking_distance: actionListSchema,
          declining_clicks: actionListSchema,
        }),
      })
      .strict(),
    risk: z
      .object({
        ruleIds: z.array(z.string().min(1)).min(1),
        actionValueLimits: z.object({
          updateSchoolMetaTitle: actionLimitsSchema,
          updateFeatureMetaDescription: actionLimitsSchema,
          updateSeoSummary: actionLimitsSchema,
          addApprovedInternalLink: actionLimitsSchema,
        }),
        forbiddenExpressionIds: z
          .array(forbiddenExpressionIdSchema)
          .min(1)
          .max(5),
        softEvalMinScore: z.number().int().min(50).max(100),
        highRiskConfidenceBelow: z.number().min(0).max(1),
      })
      .strict(),
    ops: z
      .object({
        ruleIds: z.array(z.string().min(1)).min(1),
        maxDailyProposals: z.number().int().min(1).max(100),
        maxTargetsPerProposal: z.number().int().min(1).max(20),
        humanApprovalRequired: z.literal(true),
        fallbackOnLoadFailure: z.literal(true),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = [
      ...value.analyzer.ruleIds,
      ...value.risk.ruleIds,
      ...value.ops.ruleIds,
    ];
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: 'ruleIds must be unique' });
    }
    if (requiredRuleIds.some((id) => !ids.includes(id))) {
      ctx.addIssue({
        code: 'custom',
        message: 'fundamental rule IDs cannot be removed',
      });
    }
    const enabled = new Set(value.risk.forbiddenExpressionIds);
    if (requiredForbiddenExpressionIds.some((id) => !enabled.has(id))) {
      ctx.addIssue({
        code: 'custom',
        message: 'fundamental forbidden expression rules cannot be disabled',
      });
    }
  });

export type RulebookContent = z.infer<typeof rulebookContentSchema>;

export const FALLBACK_RULEBOOK: RulebookContent = {
  schemaVersion: 1,
  analyzer: {
    ruleIds: [
      'analyzer.issue_action_map.v1',
      'analyzer.fact_grounding.v1',
      'analyzer.untrusted_input.v1',
    ],
    issueActionCandidates: {
      low_ctr_high_impressions: [
        'updateSchoolMetaTitle',
        'updateFeatureMetaDescription',
      ],
      striking_distance: ['updateSeoSummary', 'addApprovedInternalLink'],
      declining_clicks: [
        'updateSchoolMetaTitle',
        'updateFeatureMetaDescription',
        'updateSeoSummary',
        'addApprovedInternalLink',
      ],
    },
  },
  risk: {
    ruleIds: [
      'risk.typed_action_allowlist.v1',
      'risk.action_value_limits.v1',
      'risk.forbidden_expressions.v1',
      'risk.same_origin_link.v1',
      'risk.confidence_threshold.v1',
    ],
    actionValueLimits: {
      updateSchoolMetaTitle: { min: 10, max: 60 },
      updateFeatureMetaDescription: { min: 30, max: 160 },
      updateSeoSummary: { min: 80, max: 3000 },
      addApprovedInternalLink: { min: 10, max: 2048 },
    },
    forbiddenExpressionIds: [
      'guaranteed_acceptance',
      'number_one_claim',
      'absolute_percentage',
      'outcome_guarantee',
      'lowest_price_claim',
    ],
    softEvalMinScore: 75,
    highRiskConfidenceBelow: 0.6,
  },
  ops: {
    ruleIds: [
      'ops.daily_proposal_limit.v1',
      'ops.target_limit.v1',
      'ops.human_approval.v1',
    ],
    maxDailyProposals: 10,
    maxTargetsPerProposal: 3,
    humanApprovalRequired: true,
    fallbackOnLoadFailure: true,
  },
};

export function allRuleIds(rulebook: RulebookContent): string[] {
  return [
    ...rulebook.analyzer.ruleIds,
    ...rulebook.risk.ruleIds,
    ...rulebook.ops.ruleIds,
  ];
}
