import { appPath } from '@/lib/base-path';

export type ReviewReasonGroupKey =
  | 'mental_relationship'
  | 'learning_style'
  | 'health_development';

export type ReviewReasonGroup = {
  key: ReviewReasonGroupKey;
  label: string;
  shortLabel: string;
  description: string;
  reasons: string[];
};

export const REVIEW_REASON_GROUPS: ReviewReasonGroup[] = [
  {
    key: 'mental_relationship',
    label: '心の不調・人間関係に悩んでいた方の口コミ',
    shortLabel: '心の不調・人間関係',
    description: '心の不調や先生・友人との人間関係が理由で通信制を選んだ方の口コミです。',
    reasons: ['心の不調のため', '先生・友人などの人間関係に悩んだため'],
  },
  {
    key: 'learning_style',
    label: '全日制の学習スタイルが合わなかった方の口コミ',
    shortLabel: '全日制の学習スタイルが合わない',
    description: '全日制の学習ペースや通い方が合わず、通信制を選んだ方の口コミです。',
    reasons: ['全日制の学習スタイルが合わないため'],
  },
  {
    key: 'health_development',
    label: '心や体の状態・発達特性などに関する口コミ',
    shortLabel: '心身の状態・発達特性',
    description: '心や体の状態、発達障害・知的障害などを理由に通信制を選んだ方の口コミです。',
    reasons: ['心や体の状態／発達障害・知的障害などのため'],
  },
];

export function getReviewReasonGroup(key: string | undefined | null): ReviewReasonGroup | null {
  if (!key) return null;
  return REVIEW_REASON_GROUPS.find((group) => group.key === key) ?? null;
}

export function getReviewReasonsForGroup(key: string | undefined | null): string[] {
  return getReviewReasonGroup(key)?.reasons ?? [];
}

export function buildReasonGroupReviewsPath(prefecture: string, reasonGroup: ReviewReasonGroup): string {
  const params = new URLSearchParams({
    prefecture,
    reason_group: reasonGroup.key,
  });
  return appPath(`/reviews?${params.toString()}`);
}
