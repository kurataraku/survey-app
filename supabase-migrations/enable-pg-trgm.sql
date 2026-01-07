-- pg_trgm拡張の有効化
-- 曖昧検索を高速化するための拡張機能

-- 1. pg_trgm拡張を有効化
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. schoolsテーブルのname_normalizedにGINインデックス（trigram）を作成
CREATE INDEX IF NOT EXISTS idx_schools_name_normalized_trgm 
ON schools USING GIN (name_normalized gin_trgm_ops);

-- 3. school_aliasesテーブルのalias_normalizedにGINインデックス（trigram）を作成
CREATE INDEX IF NOT EXISTS idx_school_aliases_alias_normalized_trgm 
ON school_aliases USING GIN (alias_normalized gin_trgm_ops);

-- コメント
COMMENT ON EXTENSION pg_trgm IS 'PostgreSQLのtrigram拡張（文字列の類似検索を高速化）';

