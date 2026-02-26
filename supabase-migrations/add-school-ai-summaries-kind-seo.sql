-- school_ai_summaries に kind='seo' を許可（SEO本文・FAQ用）
-- 既存の kind CHECK を外し、'overall' に加えて 'seo' を許可する

ALTER TABLE school_ai_summaries
  DROP CONSTRAINT IF EXISTS school_ai_summaries_kind_check;

ALTER TABLE school_ai_summaries
  ADD CONSTRAINT school_ai_summaries_kind_check
  CHECK (kind IN ('overall', 'seo'));

COMMENT ON COLUMN school_ai_summaries.kind IS '要約の種類: overall=口コミ要約（1校1件）, seo=SEO本文セクション（topicで区別）';
