import { z } from 'zod';

export const typedActionSchema = z.enum([
  'updateSchoolMetaTitle',
  'updateFeatureMetaDescription',
  'updateSeoSummary',
  'addApprovedInternalLink',
]);

export type TypedAction = z.infer<typeof typedActionSchema>;

const legacyProposalTargetSchema = z.object({
  type: z.enum(['school', 'feature', 'url']),
  id: z.string().min(1).optional(),
  url: z.string().url().optional(),
  currentValue: z.string().optional(),
  proposedValue: z.string().min(1),
});

export const proposalPayloadV1Schema = z.object({
  schemaVersion: z.literal(1).optional(),
  action: typedActionSchema,
  targets: z.array(legacyProposalTargetSchema).min(1),
  rationale: z.string().min(1),
  expectedImpact: z.string().min(1),
  evidence: z.array(z.string()).default([]),
});

const identifiedTargetFields = {
  id: z.string().min(1),
  url: z.string().url(),
  currentValue: z.string(),
  proposedValue: z.string().min(1),
};

const schoolTargetSchema = z.object({
  type: z.literal('school'),
  ...identifiedTargetFields,
});

const featureTargetSchema = z.object({
  type: z.literal('feature'),
  ...identifiedTargetFields,
});

const urlTargetSchema = z.object({
  type: z.literal('url'),
  id: identifiedTargetFields.id,
  url: identifiedTargetFields.url,
  currentValue: identifiedTargetFields.currentValue,
  proposedValue: z.string().url(),
});

const proposalV2CommonFields = {
  schemaVersion: z.literal(2),
  facts: z
    .array(
      z.object({
        source: z.enum(['gsc', 'html', 'database']),
        statement: z.string().min(1),
      })
    )
    .min(1),
  assumptions: z.array(z.string().min(1)),
  diagnosis: z.string().min(1),
  targetMetric: z.enum(['clicks', 'impressions', 'ctr', 'position']),
  confidence: z.number().min(0).max(1),
  ruleIds: z.array(z.string().min(1)),
  rollbackPlan: z.string().min(1),
  rationale: z.string().min(1),
  expectedImpact: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1),
};

export const proposalPayloadV2Schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('updateSchoolMetaTitle'),
    targets: z.array(schoolTargetSchema).min(1),
    ...proposalV2CommonFields,
  }),
  z.object({
    action: z.literal('updateFeatureMetaDescription'),
    targets: z.array(featureTargetSchema).min(1),
    ...proposalV2CommonFields,
  }),
  z.object({
    action: z.literal('updateSeoSummary'),
    targets: z.array(schoolTargetSchema).min(1),
    ...proposalV2CommonFields,
  }),
  z.object({
    action: z.literal('addApprovedInternalLink'),
    targets: z.array(urlTargetSchema).min(1),
    ...proposalV2CommonFields,
  }),
]);

/**
 * Executor/既存行の読込ではv1も受理する。新規生成経路は必ずv2 schemaを使う。
 */
export const proposalPayloadSchema = z.union([
  proposalPayloadV2Schema,
  proposalPayloadV1Schema,
]);

export type ProposalPayload = z.infer<typeof proposalPayloadSchema>;
export type ProposalPayloadV2 = z.infer<typeof proposalPayloadV2Schema>;

export const llmProposalSchema = z.object({
  proposals: z.array(proposalPayloadV2Schema).max(5),
});

export type LlmProposalOutput = z.infer<typeof llmProposalSchema>;

export type SeoLoopRun = {
  id: string;
  idempotency_key: string;
  status: string;
  retry_count: number;
  max_retries: number;
};

export type SeoLoopStepResult = {
  status: 'disabled' | 'locked' | 'observed' | 'analyzed' | 'pending_approval' | 'executed' | 'skipped' | 'failed';
  runId?: string;
  message: string;
};
