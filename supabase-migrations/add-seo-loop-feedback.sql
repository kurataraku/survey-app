-- SEO Loop Unit 5: Slack Modalからの却下・修正理由を履歴保存する
-- add-seo-loop-proposal-evaluations.sql 適用後に Supabase SQL Editor で手動実行する

CREATE TABLE IF NOT EXISTS seo_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES seo_proposals(id) ON DELETE CASCADE,
  proposal_version INTEGER NOT NULL,
  proposal_payload_hash TEXT NOT NULL,
  approval_id UUID NOT NULL REFERENCES seo_approvals(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('rejected','revision_requested')),
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 2000),
  category TEXT NOT NULL CHECK (category IN (
    'factual_error',
    'wrong_target',
    'weak_evidence',
    'search_intent_mismatch',
    'poor_expression',
    'expected_impact_unclear',
    'risk_concern',
    'other'
  )),
  desired_change TEXT CHECK (
    desired_change IS NULL OR char_length(desired_change) BETWEEN 5 AND 2000
  ),
  general_rule_candidate BOOLEAN NOT NULL DEFAULT false,
  submitted_by_id TEXT,
  submitted_by_name TEXT,
  slack_view_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE seo_feedback
  DROP CONSTRAINT IF EXISTS seo_feedback_approval_id_fkey;
ALTER TABLE seo_feedback
  ADD CONSTRAINT seo_feedback_approval_id_fkey
  FOREIGN KEY (approval_id) REFERENCES seo_approvals(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_seo_feedback_proposal
  ON seo_feedback(proposal_id, created_at DESC);

ALTER TABLE seo_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_seo_feedback" ON seo_feedback;
CREATE POLICY "service_role_full_access_seo_feedback"
  ON seo_feedback FOR ALL
  USING (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION record_seo_feedback(
  p_proposal_id UUID,
  p_proposal_version INTEGER,
  p_proposal_payload_hash TEXT,
  p_decision TEXT,
  p_reason TEXT,
  p_category TEXT,
  p_desired_change TEXT,
  p_general_rule_candidate BOOLEAN,
  p_submitted_by_id TEXT,
  p_submitted_by_name TEXT,
  p_slack_view_id TEXT,
  p_idempotency_key TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposal_id UUID;
  v_run_id UUID;
  v_approval_id UUID;
  v_feedback_id UUID;
BEGIN
  IF p_decision NOT IN ('rejected', 'revision_requested') THEN
    RAISE EXCEPTION 'invalid feedback decision';
  END IF;

  IF char_length(btrim(p_reason)) < 5 OR char_length(p_reason) > 2000 THEN
    RAISE EXCEPTION 'invalid feedback reason length';
  END IF;

  IF p_decision = 'revision_requested'
     AND (p_desired_change IS NULL OR char_length(btrim(p_desired_change)) < 5) THEN
    RAISE EXCEPTION 'desired change is required for revision';
  END IF;

  SELECT id INTO v_feedback_id
    FROM seo_feedback
    WHERE idempotency_key = p_idempotency_key;
  IF v_feedback_id IS NOT NULL THEN
    RETURN v_feedback_id;
  END IF;

  SELECT id, run_id INTO v_proposal_id, v_run_id
    FROM seo_proposals
    WHERE id = p_proposal_id
      AND version = p_proposal_version
      AND payload_hash = p_proposal_payload_hash
      AND status = 'pending_approval'
    FOR UPDATE;
  IF v_proposal_id IS NULL THEN
    SELECT id INTO v_feedback_id
      FROM seo_feedback
      WHERE proposal_id = p_proposal_id
        AND proposal_version = p_proposal_version
        AND proposal_payload_hash = p_proposal_payload_hash
        AND decision = p_decision
      ORDER BY created_at
      LIMIT 1;
    IF v_feedback_id IS NOT NULL THEN
      RETURN v_feedback_id;
    END IF;
    RAISE EXCEPTION 'stale or already processed proposal';
  END IF;

  SELECT id INTO v_approval_id
    FROM seo_approvals
    WHERE proposal_id = p_proposal_id
      AND proposal_version = p_proposal_version
      AND proposal_payload_hash = p_proposal_payload_hash
      AND status = 'pending'
    FOR UPDATE;
  IF v_approval_id IS NULL THEN
    SELECT id INTO v_feedback_id
      FROM seo_feedback
      WHERE proposal_id = p_proposal_id
        AND proposal_version = p_proposal_version
        AND proposal_payload_hash = p_proposal_payload_hash
        AND decision = p_decision
      ORDER BY created_at
      LIMIT 1;
    IF v_feedback_id IS NOT NULL THEN
      RETURN v_feedback_id;
    END IF;
    RAISE EXCEPTION 'stale or already processed approval';
  END IF;

  INSERT INTO seo_feedback (
    proposal_id,
    proposal_version,
    proposal_payload_hash,
    approval_id,
    decision,
    reason,
    category,
    desired_change,
    general_rule_candidate,
    submitted_by_id,
    submitted_by_name,
    slack_view_id,
    idempotency_key
  ) VALUES (
    p_proposal_id,
    p_proposal_version,
    p_proposal_payload_hash,
    v_approval_id,
    p_decision,
    btrim(p_reason),
    p_category,
    NULLIF(btrim(COALESCE(p_desired_change, '')), ''),
    COALESCE(p_general_rule_candidate, false),
    p_submitted_by_id,
    p_submitted_by_name,
    p_slack_view_id,
    p_idempotency_key
  )
  RETURNING id INTO v_feedback_id;

  UPDATE seo_approvals
    SET status = p_decision,
        approver_id = p_submitted_by_id,
        approver_name = p_submitted_by_name,
        approver_note = concat('[', p_category, '] ', btrim(p_reason)),
        decided_at = now(),
        updated_at = now()
    WHERE id = v_approval_id;

  UPDATE seo_proposals
    SET status = p_decision,
        updated_at = now()
    WHERE id = v_proposal_id;

  IF NOT EXISTS (
    SELECT 1
      FROM seo_proposals
      WHERE run_id = v_run_id
        AND status IN ('pending_approval', 'approved')
  ) THEN
    UPDATE seo_loop_runs
      SET status = 'completed',
          current_step = 'feedback',
          completed_at = COALESCE(completed_at, now()),
          updated_at = now()
      WHERE id = v_run_id
        AND status = 'pending_approval';
  END IF;

  RETURN v_feedback_id;
END;
$$;

REVOKE ALL ON FUNCTION record_seo_feedback(
  UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION record_seo_feedback(
  UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION approve_seo_proposal(
  p_proposal_id UUID,
  p_proposal_version INTEGER,
  p_proposal_payload_hash TEXT,
  p_approver_id TEXT,
  p_approver_name TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposal_id UUID;
  v_approval_id UUID;
BEGIN
  SELECT id INTO v_proposal_id
    FROM seo_proposals
    WHERE id = p_proposal_id
      AND version = p_proposal_version
      AND payload_hash = p_proposal_payload_hash
      AND status = 'pending_approval'
    FOR UPDATE;
  IF v_proposal_id IS NULL THEN
    RAISE EXCEPTION 'stale or already processed proposal';
  END IF;

  SELECT id INTO v_approval_id
    FROM seo_approvals
    WHERE proposal_id = p_proposal_id
      AND proposal_version = p_proposal_version
      AND proposal_payload_hash = p_proposal_payload_hash
      AND status = 'pending'
    FOR UPDATE;
  IF v_approval_id IS NULL THEN
    RAISE EXCEPTION 'stale or already processed approval';
  END IF;

  UPDATE seo_approvals
    SET status = 'approved',
        approver_id = p_approver_id,
        approver_name = p_approver_name,
        approver_note = NULL,
        decided_at = now(),
        updated_at = now()
    WHERE id = v_approval_id;

  UPDATE seo_proposals
    SET status = 'approved',
        updated_at = now()
    WHERE id = v_proposal_id;

  RETURN v_approval_id;
END;
$$;

REVOKE ALL ON FUNCTION approve_seo_proposal(UUID, INTEGER, TEXT, TEXT, TEXT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_seo_proposal(UUID, INTEGER, TEXT, TEXT, TEXT)
  TO service_role;

COMMENT ON TABLE seo_feedback IS
  'Slack Modalで収集したSEO proposalの却下・修正理由の追記専用履歴';
