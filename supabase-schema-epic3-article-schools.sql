-- Epic3: article_schoolsテーブルの作成
-- 記事と学校の関連付けテーブル（多対多）

CREATE TABLE IF NOT EXISTS article_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0, -- 記事内での学校の表示順
  note TEXT, -- 記事内での学校へのコメント・説明文
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(article_id, school_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_article_schools_article_id ON article_schools(article_id);
CREATE INDEX IF NOT EXISTS idx_article_schools_school_id ON article_schools(school_id);
CREATE INDEX IF NOT EXISTS idx_article_schools_display_order ON article_schools(article_id, display_order);

-- コメント
COMMENT ON TABLE article_schools IS '記事と学校の関連付けテーブル';
COMMENT ON COLUMN article_schools.article_id IS '記事ID（articlesテーブルへの外部キー）';
COMMENT ON COLUMN article_schools.school_id IS '学校ID（schoolsテーブルへの外部キー）';
COMMENT ON COLUMN article_schools.display_order IS '記事内での学校の表示順序（0から開始、数値が小さいほど上位）';
COMMENT ON COLUMN article_schools.note IS '記事内で学校に対して追加する説明文';

