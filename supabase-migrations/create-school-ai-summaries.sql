-- school_ai_summariesテーブルの作成
-- AI生成による学校ごとの口コミ要約を管理するテーブル

-- テーブルの作成
CREATE TABLE IF NOT EXISTS school_ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'overall' CHECK (kind IN ('overall')),
  topic TEXT NULL, -- レベル4以降で論点別サマリー用
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  summary_text TEXT NOT NULL,
  meta_title TEXT NULL,
  meta_description TEXT NULL,
  reviews_count_used INTEGER NOT NULL,
  source_signature TEXT NOT NULL, -- 口コミデータのハッシュ（再生成判断用）
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_school_ai_summaries_school_id ON school_ai_summaries(school_id);
CREATE INDEX IF NOT EXISTS idx_school_ai_summaries_status ON school_ai_summaries(status);
CREATE INDEX IF NOT EXISTS idx_school_ai_summaries_kind_topic ON school_ai_summaries(kind, topic);
CREATE INDEX IF NOT EXISTS idx_school_ai_summaries_school_kind_topic ON school_ai_summaries(school_id, kind, topic);

-- 部分ユニークインデックス: publishedは1校・1kind・1topicあたり1件のみ
CREATE UNIQUE INDEX IF NOT EXISTS uniq_school_ai_summaries_published 
  ON school_ai_summaries (school_id, kind, COALESCE(topic, ''))
  WHERE status = 'published';

-- updated_atを自動更新するトリガー
CREATE TRIGGER update_school_ai_summaries_updated_at 
  BEFORE UPDATE ON school_ai_summaries 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- コメント
COMMENT ON TABLE school_ai_summaries IS 'AI生成による学校ごとの口コミ要約を管理するテーブル';
COMMENT ON COLUMN school_ai_summaries.school_id IS '対象の学校ID';
COMMENT ON COLUMN school_ai_summaries.kind IS '要約の種類（レベル3は overall のみ）';
COMMENT ON COLUMN school_ai_summaries.topic IS '論点（レベル4以降で使用、レベル3では NULL）';
COMMENT ON COLUMN school_ai_summaries.status IS 'ステータス: draft（下書き）または published（公開済み）';
COMMENT ON COLUMN school_ai_summaries.summary_text IS 'AI生成された要約テキスト（概要＋合う人/合わない人）';
COMMENT ON COLUMN school_ai_summaries.meta_title IS 'SEO用meta title';
COMMENT ON COLUMN school_ai_summaries.meta_description IS 'SEO用meta description';
COMMENT ON COLUMN school_ai_summaries.reviews_count_used IS '要約生成時に使用した口コミ件数';
COMMENT ON COLUMN school_ai_summaries.source_signature IS '口コミデータのハッシュ（count, max(created_at), avg(overall_satisfaction)から生成）';
COMMENT ON COLUMN school_ai_summaries.generated_at IS '要約生成日時';
COMMENT ON COLUMN school_ai_summaries.created_by IS '生成した管理者のID（NULL可）';
