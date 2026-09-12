-- SEO Loop Unit 6: feedbackから旧行を上書きしない改訂proposalチェーンを作る
-- add-seo-loop-feedback.sql 適用後に Supabase SQL Editor で手動実行する

ALTER TABLE seo_proposals
  ADD COLUMN IF NOT EXISTS parent_proposal_id UUID
  REFERENCES seo_proposals(id);

ALTER TABLE seo_proposals
  ADD COLUMN IF NOT EXISTS revision_number INTEGER NOT NULL DEFAULT 0;

ALTER TABLE seo_proposals
  ADD COLUMN IF NOT EXISTS revision_feedback_id UUID
  REFERENCES seo_feedback(id);

ALTER TABLE seo_proposals
  ADD COLUMN IF NOT EXISTS revision_retry_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE seo_proposals
  ADD COLUMN IF NOT EXISTS revision_error TEXT;

ALTER TABLE seo_proposals
  ADD COLUMN IF NOT EXISTS revision_next_action_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE seo_proposals
  ADD COLUMN IF NOT EXISTS revision_resolved_at TIMESTAMPTZ;

ALTER TABLE seo_proposals
  DROP CONSTRAINT IF EXISTS seo_proposals_parent_proposal_id_fkey;
ALTER TABLE seo_proposals
  ADD CONSTRAINT seo_proposals_parent_proposal_id_fkey
  FOREIGN KEY (parent_proposal_id) REFERENCES seo_proposals(id);

ALTER TABLE seo_proposals
  DROP CONSTRAINT IF EXISTS seo_proposals_revision_feedback_id_fkey;
ALTER TABLE seo_proposals
  ADD CONSTRAINT seo_proposals_revision_feedback_id_fkey
  FOREIGN KEY (revision_feedback_id) REFERENCES seo_feedback(id);

ALTER TABLE seo_proposals
  DROP CONSTRAINT IF EXISTS seo_proposals_revision_number_check;
ALTER TABLE seo_proposals
  ADD CONSTRAINT seo_proposals_revision_number_check
  CHECK (
    (parent_proposal_id IS NULL AND revision_number = 0 AND revision_feedback_id IS NULL)
    OR
    (parent_proposal_id IS NOT NULL AND revision_number > 0 AND revision_feedback_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_proposals_revision_feedback_unique
  ON seo_proposals(revision_feedback_id)
  WHERE revision_feedback_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_seo_proposals_parent_revision
  ON seo_proposals(parent_proposal_id, revision_number);

DROP INDEX IF EXISTS idx_seo_proposals_revision_queue;
CREATE INDEX idx_seo_proposals_revision_queue
  ON seo_proposals(status, revision_next_action_at)
  WHERE status = 'revision_requested' AND revision_resolved_at IS NULL;

ALTER TABLE seo_loop_runs
  DROP CONSTRAINT IF EXISTS seo_loop_runs_status_check;
ALTER TABLE seo_loop_runs
  ADD CONSTRAINT seo_loop_runs_status_check
  CHECK (status IN (
    'observing',
    'analyzing',
    'revising',
    'pending_approval',
    'executing',
    'remeasuring',
    'completed',
    'failed',
    'skipped'
  ));

CREATE TABLE IF NOT EXISTS seo_revision_traces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES seo_loop_runs(id) ON DELETE CASCADE,
  issue_id UUID REFERENCES seo_issues(id) ON DELETE SET NULL,
  parent_proposal_id UUID NOT NULL REFERENCES seo_proposals(id) ON DELETE CASCADE,
  feedback_id UUID NOT NULL REFERENCES seo_feedback(id) ON DELETE CASCADE,
  cycle INTEGER NOT NULL DEFAULT 1 CHECK (cycle >= 1 AND cycle <= 10),
  attempt INTEGER NOT NULL CHECK (attempt >= 1 AND attempt <= 5),
  prompt_version TEXT NOT NULL,
  model_provider TEXT NOT NULL CHECK (model_provider IN ('openai', 'anthropic')),
  model TEXT NOT NULL,
  input_context_hash TEXT NOT NULL,
  input_snapshot JSONB NOT NULL,
  raw_output TEXT,
  parsed_output JSONB,
  status TEXT NOT NULL CHECK (status IN ('succeeded','invalid_output','call_failed')),
  error_message TEXT,
  token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seo_revision_traces_cycle_unique
    UNIQUE (parent_proposal_id, feedback_id, cycle, attempt)
);

ALTER TABLE seo_revision_traces
  ADD COLUMN IF NOT EXISTS cycle INTEGER NOT NULL DEFAULT 1;

ALTER TABLE seo_revision_traces
  DROP CONSTRAINT IF EXISTS seo_revision_traces_parent_proposal_id_feedback_id_attempt_key;
ALTER TABLE seo_revision_traces
  DROP CONSTRAINT IF EXISTS seo_revision_traces_cycle_unique;
ALTER TABLE seo_revision_traces
  ADD CONSTRAINT seo_revision_traces_cycle_unique
  UNIQUE (parent_proposal_id, feedback_id, cycle, attempt);

DROP INDEX IF EXISTS idx_seo_revision_traces_parent;
CREATE INDEX IF NOT EXISTS idx_seo_revision_traces_parent
  ON seo_revision_traces(parent_proposal_id, feedback_id, cycle, attempt);

ALTER TABLE seo_revision_traces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_seo_revision_traces"
  ON seo_revision_traces;
CREATE POLICY "service_role_full_access_seo_revision_traces"
  ON seo_revision_traces FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON COLUMN seo_proposals.parent_proposal_id IS
  '改訂元proposal。旧proposalは上書きせずチェーンとして保持する';
COMMENT ON COLUMN seo_proposals.revision_feedback_id IS
  'この改訂を要求したseo_feedback。1 feedbackにつき子proposalは1件';
COMMENT ON TABLE seo_revision_traces IS
  'untrusted feedbackを入力にした改訂Strategistの再試行・出力履歴';

CREATE OR REPLACE FUNCTION create_seo_proposal_revision(
  p_parent_proposal_id UUID,
  p_feedback_id UUID,
  p_context_snapshot JSONB,
  p_payload JSONB,
  p_payload_hash TEXT,
  p_rationale TEXT,
  p_baseline JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent seo_proposals%ROWTYPE;
  v_feedback seo_feedback%ROWTYPE;
  v_child_id UUID;
BEGIN
  SELECT * INTO v_parent
    FROM seo_proposals
    WHERE id = p_parent_proposal_id
      AND status = 'revision_requested'
      AND revision_resolved_at IS NULL
    FOR UPDATE;

  IF v_parent.id IS NULL THEN
    SELECT id INTO v_child_id
      FROM seo_proposals
      WHERE revision_feedback_id = p_feedback_id;
    IF v_child_id IS NOT NULL THEN
      RETURN v_child_id;
    END IF;
    RAISE EXCEPTION 'stale or resolved revision parent';
  END IF;

  SELECT * INTO v_feedback
    FROM seo_feedback
    WHERE id = p_feedback_id
      AND proposal_id = v_parent.id
      AND proposal_version = v_parent.version
      AND proposal_payload_hash = v_parent.payload_hash
      AND decision = 'revision_requested'
    FOR UPDATE;
  IF v_feedback.id IS NULL THEN
    RAISE EXCEPTION 'revision feedback does not match parent';
  END IF;

  IF p_payload->>'action' IS DISTINCT FROM v_parent.action THEN
    RAISE EXCEPTION 'revision action differs from parent';
  END IF;

  BEGIN
    INSERT INTO seo_proposals (
      run_id,
      issue_id,
      proposal_key,
      version,
      schema_version,
      context_snapshot,
      change_type,
      action,
      payload,
      payload_hash,
      risk_level,
      requires_approval,
      status,
      rationale,
      baseline,
      parent_proposal_id,
      revision_number,
      revision_feedback_id
    ) VALUES (
      v_parent.run_id,
      v_parent.issue_id,
      concat('revision:', p_feedback_id::text, ':', left(p_payload_hash, 16)),
      v_parent.version + 1,
      2,
      p_context_snapshot,
      'application_data',
      v_parent.action,
      p_payload,
      p_payload_hash,
      'medium',
      true,
      'pending_approval',
      p_rationale,
      p_baseline,
      v_parent.id,
      v_parent.revision_number + 1,
      p_feedback_id
    )
    RETURNING id INTO v_child_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_child_id
      FROM seo_proposals
      WHERE revision_feedback_id = p_feedback_id;
    IF v_child_id IS NULL THEN
      RAISE;
    END IF;
  END;

  UPDATE seo_approvals
    SET status = 'invalidated',
        updated_at = now()
    WHERE proposal_id = v_parent.id
      AND proposal_version = v_parent.version
      AND proposal_payload_hash = v_parent.payload_hash
      AND status = 'revision_requested';

  UPDATE seo_proposals
    SET revision_resolved_at = now(),
        revision_error = NULL,
        updated_at = now()
    WHERE id = v_parent.id;

  UPDATE seo_loop_runs
    SET status = 'pending_approval',
        current_step = 'approve_revision',
        completed_at = NULL,
        error_message = NULL,
        next_action_at = now(),
        updated_at = now()
    WHERE id = v_parent.run_id;

  RETURN v_child_id;
END;
$$;

REVOKE ALL ON FUNCTION create_seo_proposal_revision(
  UUID, UUID, JSONB, JSONB, TEXT, TEXT, JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_seo_proposal_revision(
  UUID, UUID, JSONB, JSONB, TEXT, TEXT, JSONB
) TO service_role;
