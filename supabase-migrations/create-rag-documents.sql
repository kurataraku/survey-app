-- 口コミ・学校情報・記事を横断検索する RAG ドキュメント基盤
-- 依存: schools, update_updated_at_column()

-- pgvector 拡張
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL
    CHECK (source_type IN ('review', 'school', 'school_summary', 'article', 'tuition', 'course', 'faq', 'seo_section')),
  source_id TEXT NOT NULL,
  chunk_key TEXT NOT NULL DEFAULT 'main',
  school_id UUID NULL REFERENCES schools(id) ON DELETE SET NULL,
  school_name TEXT,
  prefecture TEXT,
  reason_groups TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  source_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  content_hash TEXT NOT NULL,
  -- text-embedding-3-large は既定3072次元だが、pgvector インデックスは最大2000次元
  embedding VECTOR(2000) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 一意制約（同一ソース・同一チャンクは1件）
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rag_documents_source_chunk
  ON rag_documents(source_type, source_id, chunk_key);

-- 検索用インデックス
CREATE INDEX IF NOT EXISTS idx_rag_documents_source_type ON rag_documents(source_type);
CREATE INDEX IF NOT EXISTS idx_rag_documents_school_id ON rag_documents(school_id);
CREATE INDEX IF NOT EXISTS idx_rag_documents_prefecture ON rag_documents(prefecture);
CREATE INDEX IF NOT EXISTS idx_rag_documents_reason_groups ON rag_documents USING GIN(reason_groups);

-- 類似検索インデックス（2000次元以下は hnsw / ivfflat どちらも可。hnsw を採用）
CREATE INDEX IF NOT EXISTS idx_rag_documents_embedding_cosine
  ON rag_documents
  USING hnsw (embedding vector_cosine_ops);

-- updated_at 自動更新
DROP TRIGGER IF EXISTS update_rag_documents_updated_at ON rag_documents;
CREATE TRIGGER update_rag_documents_updated_at
  BEFORE UPDATE ON rag_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "公開側は公開RAGドキュメントのみ参照可能" ON rag_documents;
DROP POLICY IF EXISTS "管理者はrag_documentsを全操作可能" ON rag_documents;

CREATE POLICY "公開側は公開RAGドキュメントのみ参照可能"
  ON rag_documents
  FOR SELECT
  USING (is_public = true);

CREATE POLICY "管理者はrag_documentsを全操作可能"
  ON rag_documents
  FOR ALL
  USING (auth.role() = 'authenticated');

-- ベクトル検索関数
CREATE OR REPLACE FUNCTION match_rag_documents(
  query_embedding VECTOR(2000),
  match_count INTEGER DEFAULT 24,
  filter_prefecture TEXT DEFAULT NULL,
  filter_school_id UUID DEFAULT NULL,
  filter_reason_group TEXT DEFAULT NULL,
  filter_source_types TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  source_type TEXT,
  source_id TEXT,
  chunk_key TEXT,
  school_id UUID,
  school_name TEXT,
  prefecture TEXT,
  reason_groups TEXT[],
  title TEXT,
  content TEXT,
  metadata JSONB,
  source_url TEXT,
  similarity DOUBLE PRECISION,
  score DOUBLE PRECISION
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    rd.id,
    rd.source_type,
    rd.source_id,
    rd.chunk_key,
    rd.school_id,
    rd.school_name,
    rd.prefecture,
    rd.reason_groups,
    rd.title,
    rd.content,
    rd.metadata,
    rd.source_url,
    1 - (rd.embedding <=> query_embedding) AS similarity,
    (
      1 - (rd.embedding <=> query_embedding)
      + CASE
          WHEN filter_reason_group IS NOT NULL
            AND filter_reason_group = ANY(rd.reason_groups) THEN 0.08
          ELSE 0
        END
      + CASE
          WHEN rd.source_type = 'review'
            AND COALESCE(rd.metadata->>'respondent_role', '') = '保護者' THEN 0.03
          ELSE 0
        END
      + CASE
          WHEN rd.source_type IN ('school_summary', 'faq', 'seo_section') THEN 0.02
          ELSE 0
        END
    ) AS score
  FROM rag_documents rd
  WHERE rd.is_public = true
    AND (filter_prefecture IS NULL OR rd.prefecture = filter_prefecture OR rd.prefecture IS NULL)
    AND (filter_school_id IS NULL OR rd.school_id = filter_school_id)
    AND (
      filter_reason_group IS NULL
      OR rd.reason_groups = '{}'::TEXT[]
      OR filter_reason_group = ANY(rd.reason_groups)
    )
    AND (
      filter_source_types IS NULL
      OR cardinality(filter_source_types) = 0
      OR rd.source_type = ANY(filter_source_types)
    )
  ORDER BY score DESC, rd.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1);
$$;

COMMENT ON TABLE rag_documents IS 'RAG検索用の公開ドキュメント（口コミ・学校・記事・学費・コース・AI要約を統合）';
COMMENT ON COLUMN rag_documents.source_type IS 'ドキュメント種別: review/school/school_summary/article/tuition/course/faq/seo_section';
COMMENT ON COLUMN rag_documents.source_id IS '元データの識別子（UUID文字列など）';
COMMENT ON COLUMN rag_documents.chunk_key IS '同一source_id内のチャンク識別子';
COMMENT ON COLUMN rag_documents.reason_groups IS '口コミ理由グループ（mental_relationship, learning_style, health_development）';
COMMENT ON COLUMN rag_documents.content_hash IS '内容差分判定用ハッシュ';
COMMENT ON FUNCTION match_rag_documents(VECTOR, INTEGER, TEXT, UUID, TEXT, TEXT[]) IS '問い合わせベクトルに近い公開RAGドキュメントを返す';
