-- school_ai_summaries に kind='review_tendency' を許可（良い点・改善してほしい点の傾向）
-- summary_text は JSON: {"good_points": ["...","...","..."], "improvement_points": ["...","...","..."]}

ALTER TABLE school_ai_summaries
  DROP CONSTRAINT IF EXISTS school_ai_summaries_kind_check;

ALTER TABLE school_ai_summaries
  ADD CONSTRAINT school_ai_summaries_kind_check
  CHECK (kind IN ('overall', 'seo', 'review_tendency'));

COMMENT ON COLUMN school_ai_summaries.kind IS '要約の種類: overall=口コミ要約（1校1件）, seo=SEO本文セクション（topicで区別）, review_tendency=良い点・改善してほしい点の傾向（3箇条ずつ）';
