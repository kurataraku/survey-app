-- school_aliasesテーブルの作成
-- 別名・表記ゆれを管理するテーブル

CREATE TABLE IF NOT EXISTS school_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(alias_normalized)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_school_aliases_school_id ON school_aliases(school_id);
CREATE INDEX IF NOT EXISTS idx_school_aliases_alias ON school_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_school_aliases_alias_normalized ON school_aliases(alias_normalized);

-- updated_atを自動更新するトリガー
CREATE TRIGGER update_school_aliases_updated_at 
  BEFORE UPDATE ON school_aliases 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- コメント
COMMENT ON TABLE school_aliases IS '学校の別名・表記ゆれを管理するテーブル';
COMMENT ON COLUMN school_aliases.school_id IS '参照先の学校ID';
COMMENT ON COLUMN school_aliases.alias IS '別名（表示名）';
COMMENT ON COLUMN school_aliases.alias_normalized IS '別名の正規化名（検索用）';



