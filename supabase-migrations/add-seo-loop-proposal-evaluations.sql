-- SEO Loop Unit 4: Slack送信前のHard Gate / Soft Eval結果
-- add-seo-loop-analysis-traces.sql 適用後に Supabase SQL Editor で手動実行する

CREATE TABLE IF NOT EXISTS seo_proposal_evaluations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES seo_proposals(id) ON DELETE CASCADE,
  proposal_version INTEGER NOT NULL,
  proposal_payload_hash TEXT NOT NULL,
  evaluation_version TEXT NOT NULL,
  hard_gate_passed BOOLEAN NOT NULL,
  hard_gate_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  soft_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_score INTEGER NOT NULL CHECK (total_score >= 0 AND total_score <= 100),
  soft_threshold INTEGER NOT NULL CHECK (soft_threshold >= 0 AND soft_threshold <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low','medium','high','blocked')),
  passed BOOLEAN NOT NULL,
  retryable BOOLEAN NOT NULL DEFAULT false,
  block_reasons TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  warnings TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  evaluation_result JSONB NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (
    proposal_id,
    proposal_version,
    proposal_payload_hash,
    evaluation_version
  )
);

ALTER TABLE seo_proposal_evaluations
  ADD COLUMN IF NOT EXISTS retryable BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_seo_proposal_evaluations_proposal
  ON seo_proposal_evaluations(proposal_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_seo_proposal_evaluations_passed
  ON seo_proposal_evaluations(passed, evaluated_at DESC);

ALTER TABLE seo_proposal_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_seo_proposal_evaluations"
  ON seo_proposal_evaluations;

CREATE POLICY "service_role_full_access_seo_proposal_evaluations"
  ON seo_proposal_evaluations FOR ALL
  USING (auth.role() = 'service_role');

ALTER TABLE seo_proposals
  DROP CONSTRAINT IF EXISTS seo_proposals_status_check;

ALTER TABLE seo_proposals
  ADD CONSTRAINT seo_proposals_status_check
  CHECK (status IN (
    'draft',
    'pending_approval',
    'approved',
    'rejected',
    'revision_requested',
    'quality_blocked',
    'executed',
    'execution_blocked',
    'awaiting_engineering',
    'failed'
  ));

COMMENT ON TABLE seo_proposal_evaluations IS
  'SEO proposalのSlack送信前Hard Gate・Soft Eval・Risk Rules結果';
