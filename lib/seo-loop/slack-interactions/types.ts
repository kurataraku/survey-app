import { z } from 'zod';

export const slackProposalRefSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  hash: z.string().min(16).max(256),
});
export type SlackProposalRef = z.infer<typeof slackProposalRefSchema>;
export const slackRulePatchRefSchema = slackProposalRefSchema.extend({
  kind: z.literal('rulebook_patch'),
});
export type SlackRulePatchRef = z.infer<typeof slackRulePatchRefSchema>;

export const feedbackDecisionSchema = z.enum(['rejected', 'revision_requested']);
export type FeedbackDecision = z.infer<typeof feedbackDecisionSchema>;

export const feedbackCategorySchema = z.enum([
  'factual_error',
  'wrong_target',
  'weak_evidence',
  'search_intent_mismatch',
  'poor_expression',
  'expected_impact_unclear',
  'risk_concern',
  'other',
]);
export type FeedbackCategory = z.infer<typeof feedbackCategorySchema>;

const slackUserSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().max(200).optional(),
  username: z.string().max(200).optional(),
});

export const slackBlockActionPayloadSchema = z.object({
  type: z.literal('block_actions'),
  user: slackUserSchema,
  trigger_id: z.string().min(1).max(500),
  response_url: z.string().url().max(2000).optional(),
  channel: z.object({ id: z.string().min(1).max(100) }).optional(),
  message: z.object({ ts: z.string().min(1).max(100) }).optional(),
  actions: z
    .array(
      z.object({
        action_id: z.enum([
          'seo_approve',
          'seo_reject',
          'seo_revision_requested',
          'seo_rule_patch_approve',
          'seo_rule_patch_reject',
        ]),
        value: z.string().min(1),
      })
    )
    .min(1),
});
export type SlackBlockActionPayload = z.infer<typeof slackBlockActionPayloadSchema>;

export const slackModalMetadataSchema = z.object({
  proposal: slackProposalRefSchema,
  decision: feedbackDecisionSchema,
  responseUrl: z.string().url().max(2000).optional(),
  channelId: z.string().max(100).optional(),
  messageTs: z.string().max(100).optional(),
});
export type SlackModalMetadata = z.infer<typeof slackModalMetadataSchema>;

const slackStateValueSchema = z
  .object({
    type: z.string(),
    value: z.string().nullable().optional(),
    selected_option: z.object({ value: z.string() }).nullable().optional(),
    selected_options: z.array(z.object({ value: z.string() })).optional(),
  })
  .passthrough();

export const slackViewSubmissionPayloadSchema = z.object({
  type: z.literal('view_submission'),
  user: slackUserSchema,
  view: z.object({
    id: z.string().min(1),
    callback_id: z.literal('seo_feedback_modal'),
    private_metadata: z.string().min(1).max(3000),
    state: z.object({
      values: z.record(z.string(), z.record(z.string(), slackStateValueSchema)),
    }),
  }),
});
export type SlackViewSubmissionPayload = z.infer<
  typeof slackViewSubmissionPayloadSchema
>;

export const feedbackInputSchema = z
  .object({
    reason: z.string().trim().min(5).max(2000),
    category: feedbackCategorySchema,
    desiredChange: z.string().trim().max(2000).optional(),
    generalRuleCandidate: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (
      value.desiredChange &&
      value.desiredChange.length > 0 &&
      value.desiredChange.length < 5
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['desiredChange'],
        message: '望ましい修正は5文字以上で入力してください',
      });
    }
  });
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;

export type SlackInteractionPayload =
  | SlackBlockActionPayload
  | SlackViewSubmissionPayload;

export function parseProposalRef(value: string): SlackProposalRef | null {
  try {
    const parsed = slackProposalRefSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function parseRulePatchRef(value: string): SlackRulePatchRef | null {
  try {
    const parsed = slackRulePatchRefSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
