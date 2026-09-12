import {
  feedbackInputSchema,
  slackModalMetadataSchema,
  type FeedbackInput,
  type SlackModalMetadata,
  type SlackViewSubmissionPayload,
} from './types';

const CATEGORY_OPTIONS = [
  ['factual_error', '事実誤認'],
  ['wrong_target', '対象・actionが不適切'],
  ['weak_evidence', '根拠が弱い'],
  ['search_intent_mismatch', '検索意図と不一致'],
  ['poor_expression', '表現品質'],
  ['expected_impact_unclear', '期待効果が不明確'],
  ['risk_concern', 'リスク懸念'],
  ['other', 'その他'],
] as const;

export function buildFeedbackModal(metadata: SlackModalMetadata) {
  const isRevision = metadata.decision === 'revision_requested';
  return {
    type: 'modal',
    callback_id: 'seo_feedback_modal',
    private_metadata: JSON.stringify(metadata),
    title: {
      type: 'plain_text',
      text: isRevision ? 'SEO提案の修正依頼' : 'SEO提案の却下',
    },
    submit: { type: 'plain_text', text: '送信' },
    close: { type: 'plain_text', text: 'キャンセル' },
    blocks: [
      {
        type: 'input',
        block_id: 'feedback_reason',
        label: { type: 'plain_text', text: '理由' },
        element: {
          type: 'plain_text_input',
          action_id: 'reason_input',
          multiline: true,
          min_length: 5,
          max_length: 2000,
        },
      },
      {
        type: 'input',
        block_id: 'feedback_category',
        label: { type: 'plain_text', text: '分類' },
        element: {
          type: 'static_select',
          action_id: 'category_select',
          placeholder: { type: 'plain_text', text: '分類を選択' },
          options: CATEGORY_OPTIONS.map(([value, label]) => ({
            text: { type: 'plain_text', text: label },
            value,
          })),
        },
      },
      {
        type: 'input',
        block_id: 'desired_change',
        optional: !isRevision,
        label: { type: 'plain_text', text: '望ましい修正' },
        element: {
          type: 'plain_text_input',
          action_id: 'desired_change_input',
          multiline: true,
          min_length: 5,
          max_length: 2000,
        },
      },
      {
        type: 'input',
        block_id: 'general_rule',
        optional: true,
        label: { type: 'plain_text', text: '一般ルール化候補' },
        element: {
          type: 'checkboxes',
          action_id: 'general_rule_check',
          options: [
            {
              text: {
                type: 'plain_text',
                text: '他の提案にも適用できるルール候補として記録する',
              },
              value: 'yes',
            },
          ],
        },
      },
    ],
  };
}

type ExtractionResult =
  | { success: true; data: FeedbackInput }
  | { success: false; errors: Record<string, string> };

export function parseModalMetadata(value: string): SlackModalMetadata | null {
  try {
    const parsed = slackModalMetadataSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function extractFeedbackInput(
  payload: SlackViewSubmissionPayload,
  metadata: SlackModalMetadata
): ExtractionResult {
  const values = payload.view.state.values;
  const reason = values.feedback_reason?.reason_input?.value ?? '';
  const category =
    values.feedback_category?.category_select?.selected_option?.value ?? '';
  const desiredChange =
    values.desired_change?.desired_change_input?.value?.trim() || undefined;
  const generalRuleCandidate =
    values.general_rule?.general_rule_check?.selected_options?.some(
      (option) => option.value === 'yes'
    ) ?? false;
  const parsed = feedbackInputSchema.safeParse({
    reason,
    category,
    desiredChange,
    generalRuleCandidate,
  });
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      const blockId =
        field === 'reason'
          ? 'feedback_reason'
          : field === 'category'
            ? 'feedback_category'
            : 'desired_change';
      errors[blockId] = issue.message;
    }
  }
  if (
    metadata.decision === 'revision_requested' &&
    (!desiredChange || desiredChange.length < 5)
  ) {
    errors.desired_change = '修正依頼では、望ましい修正を5文字以上で入力してください';
  }
  return Object.keys(errors).length > 0
    ? { success: false, errors }
    : { success: true, data: parsed.data! };
}
