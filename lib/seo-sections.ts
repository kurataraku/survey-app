/**
 * 個別高校ページのSEO本文セクション定義
 * school_ai_summaries (kind='seo', topic=key) で1セクション1行
 */

export const SEO_SECTION_KEYS = [
  'good_bad',
  'tuition',
  'learning',
  'syllabus',
  'flexibility',
] as const;

export type SeoSectionKey = (typeof SEO_SECTION_KEYS)[number];

/** FAQは topic='faq' で1行にJSON配列で保存 */
export const FAQ_TOPIC = 'faq' as const;

export const SEO_SECTION_LABELS: Record<SeoSectionKey, string> = {
  good_bad: '良い評判・悪い評判（項目別）',
  tuition: '学費の目安と内訳',
  learning: '学習の進め方（レポート・単位）',
  syllabus: 'スクーリング・通学頻度',
  flexibility: '不登校の子にとっての通いやすさ',
};

export const FAQ_QUESTIONS = [
  'この学校で特に評価が高いポイントはどこですか？',
  '「在校生の雰囲気」はどんな評価ですか？',
  '不登校傾向の子にとって「学びの柔軟さ」はどうですか？',
  '「先生・職員の対応」はどう評価されていますか？',
  '「心や体調の波へのサポート」はどうですか？',
] as const;

export function isSeoSectionKey(topic: string | null): topic is SeoSectionKey {
  return topic !== null && SEO_SECTION_KEYS.includes(topic as SeoSectionKey);
}

export interface FaqItem {
  question: string;
  answer: string;
}
