-- SEO Loopで承認・実行された内部リンクを、本文を直接改変せず関連リンク枠に表示する
-- create-seo-loop-system.sql 適用後に実行する

CREATE TABLE IF NOT EXISTS seo_approved_internal_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  anchor_text TEXT NOT NULL,
  proposal_id UUID NOT NULL REFERENCES seo_proposals(id) ON DELETE RESTRICT,
  approval_id UUID NOT NULL REFERENCES seo_approvals(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_url, target_url),
  CHECK (source_url <> target_url)
);

CREATE INDEX IF NOT EXISTS idx_seo_approved_internal_links_source_active
  ON seo_approved_internal_links(source_url, is_active);

ALTER TABLE seo_approved_internal_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_seo_approved_internal_links"
  ON seo_approved_internal_links;
CREATE POLICY "service_role_full_access_seo_approved_internal_links"
  ON seo_approved_internal_links FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS trigger_seo_approved_internal_links_updated_at
  ON seo_approved_internal_links;
CREATE TRIGGER trigger_seo_approved_internal_links_updated_at
  BEFORE UPDATE ON seo_approved_internal_links
  FOR EACH ROW EXECUTE FUNCTION update_seo_loop_updated_at();

COMMENT ON TABLE seo_approved_internal_links IS
  'Slack承認済みaddApprovedInternalLinkを公開ページの関連リンク枠へ反映するAllowlist';
