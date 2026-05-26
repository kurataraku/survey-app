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
  good_bad: '良い評判・気になる評判',
  tuition: '学費・費用感の確認ポイント',
  learning: 'コース・学習スタイル',
  syllabus: 'スクーリング・通学頻度',
  flexibility: '不登校経験・体調不安がある人の通いやすさ',
};

/** ユーザー関心順：学校名検索で不安になりやすい論点を優先 */
export const FAQ_QUESTIONS = [
  '生徒の雰囲気は？',
  '不登校ぎみでも通いやすい？',
  '学費はどこを確認すればいい？',
  'スクーリングや通学頻度は多い？',
  '悪い評判や注意点はある？',
] as const;

/** 既存FAQ表示用：旧質問文→新表示文（DBに旧文で保存されている場合の差し替え） */
export const FAQ_OLD_TO_NEW: Record<string, string> = {
  '在校生の雰囲気はどんな感じですか？': '生徒の雰囲気は？',
  '「在校生の雰囲気」はどんな評価ですか？': '生徒の雰囲気は？',
  '不登校傾向の子にとって「学びの柔軟さ」はどうですか？': '不登校ぎみでも通いやすい？',
  '「心や体調の波へのサポート」はどうですか？': '体調やメンタルに波がある場合、無理なく続けられる？',
  '「先生・職員の対応」はどう評価されていますか？': '先生や職員のサポートはどれくらい手厚い？相談しやすい？',
  'この学校で特に評価が高いポイントはどこですか？': 'この学校の強みは？選ばれている理由は？',
  '学費の目安は？': '学費はどこを確認すればいい？',
  'スクーリングの頻度は？': 'スクーリングや通学頻度は多い？',
  '悪い口コミはありますか？': '悪い評判や注意点はある？',
};

/** 表示順（FAQ_QUESTIONS と同じユーザー関心順） */
export const FAQ_DISPLAY_ORDER: readonly string[] = FAQ_QUESTIONS;

export function isSeoSectionKey(topic: string | null): topic is SeoSectionKey {
  return topic !== null && SEO_SECTION_KEYS.includes(topic as SeoSectionKey);
}

export interface FaqItem {
  question: string;
  answer: string;
}
