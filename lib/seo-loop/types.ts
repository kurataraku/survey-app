import { z } from 'zod';

export const typedActionSchema = z.enum([
  'updateSchoolMetaTitle',
  'updateFeatureMetaDescription',
  'updateSeoSummary',
  'addApprovedInternalLink',
]);

export type TypedAction = z.infer<typeof typedActionSchema>;

export const proposalPayloadSchema = z.object({
  action: typedActionSchema,
  targets: z
    .array(
      z.object({
        type: z.enum(['school', 'feature', 'url']),
        id: z.string().min(1).optional(),
        url: z.string().url().optional(),
        currentValue: z.string().optional(),
        proposedValue: z.string().min(1),
      })
    )
    .min(1),
  rationale: z.string().min(1),
  expectedImpact: z.string().min(1),
  evidence: z.array(z.string()).default([]),
});

export type ProposalPayload = z.infer<typeof proposalPayloadSchema>;

export const llmProposalSchema = z.object({
  proposals: z.array(proposalPayloadSchema).max(5),
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
