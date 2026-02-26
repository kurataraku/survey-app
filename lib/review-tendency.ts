/**
 * 良い点・改善してほしい点の傾向（LLM要約）
 * school_ai_summaries (kind='review_tendency', topic=null) の summary_text はこのJSON
 */

export interface ReviewTendencySummary {
  good_points: string[];
  improvement_points: string[];
}

export const REVIEW_TENDENCY_LABEL = '良い点・改善してほしい点の傾向';
