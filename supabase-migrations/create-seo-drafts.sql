-- SEO記事生成: seo_drafts + seo_draft_evidence テーブル作成
-- 実行: Supabase SQL Editor で手動実行

-- 1. SEO下書きテーブル
CREATE TABLE seo_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_type TEXT NOT NULL DEFAULT 'knowledge'
    CHECK (draft_type IN ('knowledge', 'school')),
  keyword TEXT NOT NULL,
  school_id UUID REFERENCES schools(id),
  intent TEXT,
  audience TEXT,
  title TEXT,
  outline_json JSONB,
  body_md TEXT,
  seo_meta JSONB,
  quality_score JSONB,
  status TEXT NOT NULL DEFAULT 'generating'
    CHECK (status IN ('generating','draft','needs_review','revised','approved','failed')),
  current_step TEXT,
  error_message TEXT,
  featured_image_url TEXT,
  tokens_used JSONB DEFAULT '{"openai":0,"perplexity":0,"anthropic":0}',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 根拠カードテーブル
CREATE TABLE seo_draft_evidence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES seo_drafts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL
    CHECK (kind IN ('review','web','article','school_info')),
  source_id TEXT,
  url TEXT,
  title TEXT,
  excerpt TEXT,
  summary TEXT NOT NULL,
  section_ref TEXT,
  confidence TEXT DEFAULT 'medium'
    CHECK (confidence IN ('high','medium','low')),
  retrieved_at TIMESTAMPTZ DEFAULT now()
);

-- 3. インデックス
CREATE INDEX idx_seo_drafts_status ON seo_drafts(status);
CREATE INDEX idx_seo_drafts_school_id ON seo_drafts(school_id);
CREATE INDEX idx_seo_drafts_keyword ON seo_drafts(keyword);
CREATE INDEX idx_seo_drafts_created_at ON seo_drafts(created_at DESC);
CREATE INDEX idx_seo_draft_evidence_draft_id ON seo_draft_evidence(draft_id);
CREATE INDEX idx_seo_draft_evidence_kind ON seo_draft_evidence(kind);

-- 4. RLS
ALTER TABLE seo_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_draft_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_seo_drafts"
  ON seo_drafts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_full_access_seo_draft_evidence"
  ON seo_draft_evidence FOR ALL
  USING (auth.role() = 'service_role');

-- 5. updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_seo_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_seo_drafts_updated_at
  BEFORE UPDATE ON seo_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_seo_drafts_updated_at();
