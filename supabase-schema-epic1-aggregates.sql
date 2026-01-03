-- Epic1: aggregatesテーブルの作成
-- 学校別集計キャッシュ（検索カード高速化用）

-- aggregatesテーブルの作成（学校別集計キャッシュ）
CREATE TABLE IF NOT EXISTS aggregates (
  school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  review_count INTEGER NOT NULL DEFAULT 0,
  overall_avg NUMERIC(3, 2), -- 小数点以下2桁（例: 4.25）
  staff_rating_avg NUMERIC(3, 2),
  atmosphere_fit_rating_avg NUMERIC(3, 2),
  credit_rating_avg NUMERIC(3, 2),
  tuition_rating_avg NUMERIC(3, 2),
  top_good_review_id UUID REFERENCES survey_responses(id) ON DELETE SET NULL,
  top_bad_review_id UUID REFERENCES survey_responses(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_aggregates_updated_at ON aggregates(updated_at);

-- updated_atを自動更新するトリガー
DROP TRIGGER IF EXISTS update_aggregates_updated_at ON aggregates;
CREATE TRIGGER update_aggregates_updated_at 
  BEFORE UPDATE ON aggregates 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- コメント
COMMENT ON TABLE aggregates IS '学校別集計キャッシュテーブル（検索カード高速化用）';
COMMENT ON COLUMN aggregates.school_id IS '学校ID（プライマリキー、schoolsテーブルへの外部キー）';
COMMENT ON COLUMN aggregates.review_count IS '口コミ数';
COMMENT ON COLUMN aggregates.overall_avg IS '総合満足度の平均';
COMMENT ON COLUMN aggregates.staff_rating_avg IS '先生・職員の対応評価の平均';
COMMENT ON COLUMN aggregates.atmosphere_fit_rating_avg IS '在校生の雰囲気が自分に合っていたか評価の平均';
COMMENT ON COLUMN aggregates.credit_rating_avg IS '単位取得のしやすさ評価の平均';
COMMENT ON COLUMN aggregates.tuition_rating_avg IS '学費の納得感評価の平均';
COMMENT ON COLUMN aggregates.top_good_review_id IS '代表の良い口コミID（いいね数が最も多いもの）';
COMMENT ON COLUMN aggregates.top_bad_review_id IS '代表の悪い口コミID（いいね数が最も多いもの）';
COMMENT ON COLUMN aggregates.updated_at IS '最終更新日時';











