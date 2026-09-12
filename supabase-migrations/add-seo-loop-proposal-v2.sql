-- SEO Loop Proposal v2: schema版と生成時Fact Contextを固定する
-- create-seo-loop-system.sql 適用後に Supabase SQL Editor で手動実行する

ALTER TABLE seo_proposals
  ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE seo_proposals
  ADD COLUMN IF NOT EXISTS context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE seo_proposals
  DROP CONSTRAINT IF EXISTS seo_proposals_schema_version_check;

ALTER TABLE seo_proposals
  ADD CONSTRAINT seo_proposals_schema_version_check
  CHECK (schema_version IN (1, 2));

COMMENT ON COLUMN seo_proposals.schema_version IS
  'proposal payload schema version。既存行は1、新規Fact Context経路は2';

COMMENT ON COLUMN seo_proposals.context_snapshot IS
  'proposal生成時に固定したHTML・DB・対象識別情報のFact Context snapshot';
