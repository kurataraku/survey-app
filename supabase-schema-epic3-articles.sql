-- Epic3: articlesテーブルの作成
-- 特集ページ用の記事テーブル

CREATE TABLE IF NOT EXISTS articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL, -- 'interview' (リアル体験談 クチコミ・インタビュー), 'useful_info' (通信制高校お役立ち情報)
  content TEXT, -- Markdown形式の本文
  excerpt TEXT, -- 記事の抜粋
  featured_image_url TEXT, -- アイキャッチ画像URL
  is_public BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  meta_title TEXT, -- SEO用タイトル
  meta_description TEXT -- SEO用説明文
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_is_public ON articles(is_public);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at) WHERE is_public = true;

-- updated_atを自動更新するトリガー関数（既に存在する場合は上書き）
CREATE OR REPLACE FUNCTION update_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- トリガーの作成（既に存在する場合は削除して再作成）
DROP TRIGGER IF EXISTS update_articles_updated_at ON articles;
CREATE TRIGGER update_articles_updated_at 
  BEFORE UPDATE ON articles 
  FOR EACH ROW 
  EXECUTE FUNCTION update_articles_updated_at();

-- コメント
COMMENT ON TABLE articles IS '特集ページ用の記事テーブル';
COMMENT ON COLUMN articles.title IS '記事タイトル';
COMMENT ON COLUMN articles.slug IS 'SEO用スラッグ（URLに使用）';
COMMENT ON COLUMN articles.category IS '記事カテゴリ（interview: リアル体験談 クチコミ・インタビュー, useful_info: 通信制高校お役立ち情報）';
COMMENT ON COLUMN articles.content IS 'Markdown形式の本文';
COMMENT ON COLUMN articles.excerpt IS '記事の抜粋（一覧表示用）';
COMMENT ON COLUMN articles.featured_image_url IS 'アイキャッチ画像URL';
COMMENT ON COLUMN articles.is_public IS '公開フラグ';
COMMENT ON COLUMN articles.published_at IS '公開日時';
COMMENT ON COLUMN articles.meta_title IS 'SEO用メタタイトル';
COMMENT ON COLUMN articles.meta_description IS 'SEO用メタ説明文';

