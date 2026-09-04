-- SEO自走ループ: アプリ内Orchestrator / GSC観測 / Slack承認 / 実験結果
-- 実行: Supabase SQL Editor で手動実行

CREATE TABLE IF NOT EXISTS seo_loop_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'observing'
    CHECK (status IN (
      'observing',
      'analyzing',
      'pending_approval',
      'executing',
      'remeasuring',
      'completed',
      'failed',
      'skipped'
    )),
  current_step TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  next_action_at TIMESTAMPTZ DEFAULT now(),
  locked_at TIMESTAMPTZ,
  lock_expires_at TIMESTAMPTZ,
  locked_by TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES seo_loop_runs(id) ON DELETE CASCADE,
  issue_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','proposed','dismissed','resolved')),
  issue_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_url TEXT,
  query TEXT,
  gsc_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (run_id, issue_key)
);

CREATE TABLE IF NOT EXISTS seo_proposals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES seo_loop_runs(id) ON DELETE CASCADE,
  issue_id UUID REFERENCES seo_issues(id) ON DELETE SET NULL,
  proposal_key TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  change_type TEXT NOT NULL
    CHECK (change_type IN ('application_data','source_code')),
  action TEXT NOT NULL,
  payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'medium'
    CHECK (risk_level IN ('low','medium','high','blocked')),
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN (
      'draft',
      'pending_approval',
      'approved',
      'rejected',
      'revision_requested',
      'executed',
      'execution_blocked',
      'awaiting_engineering',
      'failed'
    )),
  rationale TEXT,
  baseline JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (run_id, proposal_key),
  UNIQUE (id, version, payload_hash)
);

CREATE TABLE IF NOT EXISTS seo_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES seo_proposals(id) ON DELETE CASCADE,
  proposal_version INTEGER NOT NULL,
  proposal_payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','revision_requested','invalidated')),
  approver_id TEXT,
  approver_name TEXT,
  approver_note TEXT,
  slack_channel TEXT,
  slack_message_ts TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (proposal_id, proposal_version, proposal_payload_hash)
);

CREATE TABLE IF NOT EXISTS seo_experiments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES seo_proposals(id) ON DELETE RESTRICT,
  approval_id UUID REFERENCES seo_approvals(id) ON DELETE SET NULL,
  execution_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','executed','blocked','failed','rolled_back')),
  action TEXT NOT NULL,
  target_urls TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  target_queries TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  baseline_start_date DATE,
  baseline_end_date DATE,
  baseline_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seo_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID NOT NULL REFERENCES seo_experiments(id) ON DELETE CASCADE,
  measurement_start_date DATE NOT NULL,
  measurement_end_date DATE NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  comparison JSONB NOT NULL DEFAULT '{}'::jsonb,
  verdict TEXT NOT NULL DEFAULT 'inconclusive'
    CHECK (verdict IN ('improved','worsened','inconclusive','insufficient_data')),
  notes TEXT,
  measured_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_loop_runs_status_next_action
  ON seo_loop_runs(status, next_action_at);
CREATE INDEX IF NOT EXISTS idx_seo_loop_runs_lock_expires
  ON seo_loop_runs(lock_expires_at);
CREATE INDEX IF NOT EXISTS idx_seo_issues_run_id
  ON seo_issues(run_id);
CREATE INDEX IF NOT EXISTS idx_seo_issues_target_url
  ON seo_issues(target_url);
CREATE INDEX IF NOT EXISTS idx_seo_proposals_status
  ON seo_proposals(status);
CREATE INDEX IF NOT EXISTS idx_seo_proposals_run_id
  ON seo_proposals(run_id);
CREATE INDEX IF NOT EXISTS idx_seo_approvals_status
  ON seo_approvals(status);
CREATE INDEX IF NOT EXISTS idx_seo_experiments_status
  ON seo_experiments(status);

ALTER TABLE seo_loop_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_seo_loop_runs"
  ON seo_loop_runs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_full_access_seo_issues"
  ON seo_issues FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_full_access_seo_proposals"
  ON seo_proposals FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_full_access_seo_approvals"
  ON seo_approvals FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_full_access_seo_experiments"
  ON seo_experiments FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "service_role_full_access_seo_results"
  ON seo_results FOR ALL
  USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION update_seo_loop_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_seo_loop_runs_updated_at ON seo_loop_runs;
CREATE TRIGGER trigger_seo_loop_runs_updated_at
  BEFORE UPDATE ON seo_loop_runs
  FOR EACH ROW
  EXECUTE FUNCTION update_seo_loop_updated_at();

DROP TRIGGER IF EXISTS trigger_seo_issues_updated_at ON seo_issues;
CREATE TRIGGER trigger_seo_issues_updated_at
  BEFORE UPDATE ON seo_issues
  FOR EACH ROW
  EXECUTE FUNCTION update_seo_loop_updated_at();

DROP TRIGGER IF EXISTS trigger_seo_proposals_updated_at ON seo_proposals;
CREATE TRIGGER trigger_seo_proposals_updated_at
  BEFORE UPDATE ON seo_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_seo_loop_updated_at();

DROP TRIGGER IF EXISTS trigger_seo_approvals_updated_at ON seo_approvals;
CREATE TRIGGER trigger_seo_approvals_updated_at
  BEFORE UPDATE ON seo_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_seo_loop_updated_at();

DROP TRIGGER IF EXISTS trigger_seo_experiments_updated_at ON seo_experiments;
CREATE TRIGGER trigger_seo_experiments_updated_at
  BEFORE UPDATE ON seo_experiments
  FOR EACH ROW
  EXECUTE FUNCTION update_seo_loop_updated_at();
