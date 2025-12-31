-- Epic1: schoolsテーブルの作成
-- 学校マスタテーブル

-- テーブルの作成
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  prefecture TEXT NOT NULL,
  slug TEXT UNIQUE,
  intro TEXT,
  highlights JSONB,
  faq JSONB,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_schools_name ON schools(name);
CREATE INDEX IF NOT EXISTS idx_schools_prefecture ON schools(prefecture);
CREATE INDEX IF NOT EXISTS idx_schools_slug ON schools(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schools_is_public ON schools(is_public);

-- updated_atを自動更新するトリガー関数（既に存在する場合は上書き）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- トリガーの作成（既に存在する場合は何もしない）
DROP TRIGGER IF EXISTS update_schools_updated_at ON schools;
CREATE TRIGGER update_schools_updated_at 
  BEFORE UPDATE ON schools 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- コメント
COMMENT ON TABLE schools IS '学校マスタテーブル';
COMMENT ON COLUMN schools.name IS '学校名（一意）';
COMMENT ON COLUMN schools.prefecture IS '都道府県';
COMMENT ON COLUMN schools.slug IS 'SEO用スラッグ（URLに使用）';
COMMENT ON COLUMN schools.intro IS '学校の紹介文（CMS編集可能）';
COMMENT ON COLUMN schools.highlights IS '特徴箇条書き、推しポイント（JSONB形式、CMS編集可能）';
COMMENT ON COLUMN schools.faq IS 'FAQ（JSONB形式、CMS編集可能）';
COMMENT ON COLUMN schools.is_public IS '公開フラグ';







