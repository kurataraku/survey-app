-- SEO Loop Unit 9: Rulebook新版を旧版とshadow比較し、基準達成後だけ昇格する
-- allow-seo-loop-single-operator-rule-patch-approval.sql 適用後に手動実行する

ALTER TABLE seo_rule_patch_candidates
  DROP CONSTRAINT IF EXISTS seo_rule_patch_candidates_status_check;
ALTER TABLE seo_rule_patch_candidates
  ADD CONSTRAINT seo_rule_patch_candidates_status_check
  CHECK (status IN (
    'draft','pending_approval','shadowing','applied','rejected',
    'superseded','expired','failed'
  ));
DROP INDEX IF EXISTS idx_seo_rule_patch_one_pending_path;
CREATE UNIQUE INDEX idx_seo_rule_patch_one_pending_path
  ON seo_rule_patch_candidates(patch_path)
  WHERE status IN ('draft','pending_approval','shadowing');

CREATE TABLE IF NOT EXISTS seo_rulebook_rollouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL UNIQUE REFERENCES seo_rule_patch_candidates(id),
  candidate_version INTEGER NOT NULL,
  patch_hash TEXT NOT NULL CHECK (length(patch_hash) = 64),
  base_rulebook_version_id UUID NOT NULL REFERENCES seo_rulebook_versions(id),
  base_rulebook_version INTEGER NOT NULL,
  base_rulebook_hash TEXT NOT NULL CHECK (length(base_rulebook_hash) = 64),
  shadow_content JSONB NOT NULL,
  shadow_content_hash TEXT NOT NULL CHECK (length(shadow_content_hash) = 64),
  status TEXT NOT NULL DEFAULT 'shadowing' CHECK (status IN (
    'shadowing','ready','promoted','rejected','superseded','failed','rolled_back'
  )),
  metrics_version TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics_hash TEXT CHECK (
    metrics_hash IS NULL OR length(metrics_hash) = 64
  ),
  run_count INTEGER NOT NULL DEFAULT 0 CHECK (run_count >= 0),
  evaluated_proposal_count INTEGER NOT NULL DEFAULT 0 CHECK (
    evaluated_proposal_count >= 0
  ),
  observed_decision_count INTEGER NOT NULL DEFAULT 0 CHECK (
    observed_decision_count >= 0
  ),
  slack_channel TEXT,
  slack_message_ts TEXT,
  notify_attempted_at TIMESTAMPTZ,
  approved_by_id TEXT NOT NULL,
  approved_by_name TEXT,
  promoted_by_id TEXT,
  promoted_by_name TEXT,
  promoted_rulebook_version_id UUID REFERENCES seo_rulebook_versions(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready_at TIMESTAMPTZ,
  promoted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_rulebook_one_open_rollout
  ON seo_rulebook_rollouts ((true))
  WHERE status IN ('shadowing','ready');
CREATE INDEX IF NOT EXISTS idx_seo_rulebook_rollout_status
  ON seo_rulebook_rollouts(status, started_at DESC);

CREATE TABLE IF NOT EXISTS seo_rulebook_shadow_evaluations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rollout_id UUID NOT NULL REFERENCES seo_rulebook_rollouts(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES seo_loop_runs(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES seo_proposals(id) ON DELETE CASCADE,
  proposal_version INTEGER NOT NULL,
  proposal_payload_hash TEXT NOT NULL,
  main_rulebook_hash TEXT NOT NULL CHECK (length(main_rulebook_hash) = 64),
  shadow_rulebook_hash TEXT NOT NULL CHECK (length(shadow_rulebook_hash) = 64),
  main_evaluation JSONB NOT NULL,
  shadow_evaluation JSONB NOT NULL,
  main_retryable BOOLEAN NOT NULL DEFAULT false,
  shadow_retryable BOOLEAN NOT NULL DEFAULT false,
  main_hard_gate_passed BOOLEAN NOT NULL,
  shadow_hard_gate_passed BOOLEAN NOT NULL,
  main_would_send BOOLEAN NOT NULL,
  shadow_would_send BOOLEAN NOT NULL,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (
    rollout_id, proposal_id, proposal_version, proposal_payload_hash
  )
);
CREATE INDEX IF NOT EXISTS idx_seo_rulebook_shadow_evaluations_rollout
  ON seo_rulebook_shadow_evaluations(rollout_id, evaluated_at DESC);

CREATE TABLE IF NOT EXISTS seo_rulebook_rollout_metric_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  rollout_id UUID NOT NULL REFERENCES seo_rulebook_rollouts(id) ON DELETE CASCADE,
  metrics_version TEXT NOT NULL,
  metrics JSONB NOT NULL,
  metrics_hash TEXT NOT NULL CHECK (length(metrics_hash) = 64),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seo_rulebook_rollout_metrics
  ON seo_rulebook_rollout_metric_snapshots(rollout_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_seo_rulebook_rollout_identity_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.candidate_id IS DISTINCT FROM OLD.candidate_id
    OR NEW.candidate_version IS DISTINCT FROM OLD.candidate_version
    OR NEW.patch_hash IS DISTINCT FROM OLD.patch_hash
    OR NEW.base_rulebook_version_id IS DISTINCT FROM OLD.base_rulebook_version_id
    OR NEW.base_rulebook_version IS DISTINCT FROM OLD.base_rulebook_version
    OR NEW.base_rulebook_hash IS DISTINCT FROM OLD.base_rulebook_hash
    OR NEW.shadow_content IS DISTINCT FROM OLD.shadow_content
    OR NEW.shadow_content_hash IS DISTINCT FROM OLD.shadow_content_hash
    OR NEW.approved_by_id IS DISTINCT FROM OLD.approved_by_id
    OR NEW.approved_by_name IS DISTINCT FROM OLD.approved_by_name
    OR NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    RAISE EXCEPTION 'rulebook rollout identity is immutable';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_seo_rulebook_rollout_identity_mutation
  ON seo_rulebook_rollouts;
CREATE TRIGGER trg_prevent_seo_rulebook_rollout_identity_mutation
  BEFORE UPDATE ON seo_rulebook_rollouts
  FOR EACH ROW EXECUTE FUNCTION prevent_seo_rulebook_rollout_identity_mutation();

CREATE OR REPLACE FUNCTION prevent_seo_rulebook_shadow_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'shadow evaluation and metric logs are append-only';
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_seo_rulebook_shadow_evaluation_mutation
  ON seo_rulebook_shadow_evaluations;
CREATE TRIGGER trg_prevent_seo_rulebook_shadow_evaluation_mutation
  BEFORE UPDATE OR DELETE ON seo_rulebook_shadow_evaluations
  FOR EACH ROW EXECUTE FUNCTION prevent_seo_rulebook_shadow_log_mutation();
DROP TRIGGER IF EXISTS trg_prevent_seo_rulebook_rollout_metric_mutation
  ON seo_rulebook_rollout_metric_snapshots;
CREATE TRIGGER trg_prevent_seo_rulebook_rollout_metric_mutation
  BEFORE UPDATE OR DELETE ON seo_rulebook_rollout_metric_snapshots
  FOR EACH ROW EXECUTE FUNCTION prevent_seo_rulebook_shadow_log_mutation();

-- 第二承認はactive化ではなくshadow開始に変更する。
CREATE OR REPLACE FUNCTION approve_seo_rule_patch(
  p_candidate_id UUID,
  p_candidate_version INTEGER,
  p_patch_hash TEXT,
  p_approver_id TEXT,
  p_approver_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_candidate seo_rule_patch_candidates%ROWTYPE;
  v_base seo_rulebook_versions%ROWTYPE;
  v_rollout_id UUID;
  v_existing_rollout_id UUID;
  v_expected JSONB;
  v_value INTEGER;
  v_current INTEGER;
  v_new_id UUID;
  v_new_version INTEGER;
  v_new_status TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('seo_rulebook_shadow_rollout'));
  SELECT * INTO v_candidate
    FROM seo_rule_patch_candidates
    WHERE id = p_candidate_id
      AND candidate_version = p_candidate_version
      AND patch_hash = p_patch_hash
    FOR UPDATE;
  IF v_candidate.id IS NULL THEN
    RAISE EXCEPTION 'invalid rule patch reference';
  END IF;

  IF v_candidate.status = 'shadowing' THEN
    SELECT id INTO v_rollout_id FROM seo_rulebook_rollouts
      WHERE candidate_id = v_candidate.id;
    RETURN jsonb_build_object(
      'status','shadowing','rolloutId',v_rollout_id,
      'contentHash',v_candidate.proposed_content_hash
    );
  END IF;
  IF v_candidate.status = 'applied' THEN
    SELECT id, status INTO v_new_id, v_new_status
      FROM seo_rulebook_versions
      WHERE id = v_candidate.applied_rulebook_version_id;
    SELECT version INTO v_new_version FROM seo_rulebook_versions
      WHERE id = v_new_id;
    RETURN jsonb_build_object(
      'status','applied','versionId',v_new_id,'version',v_new_version,
      'contentHash',v_candidate.proposed_content_hash,
      'isCurrentlyActive',v_new_status = 'active'
    );
  END IF;
  IF v_candidate.status <> 'pending_approval'
    OR v_candidate.expires_at <= now() THEN
    RAISE EXCEPTION 'stale rule patch candidate';
  END IF;

  SELECT id INTO v_existing_rollout_id
    FROM seo_rulebook_rollouts
    WHERE status IN ('shadowing','ready')
    LIMIT 1;
  IF v_existing_rollout_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status','rollout_busy','rolloutId',v_existing_rollout_id
    );
  END IF;

  SELECT * INTO v_base
    FROM seo_rulebook_versions
    WHERE id = v_candidate.base_rulebook_version_id
      AND version = v_candidate.base_rulebook_version
      AND content_hash = v_candidate.base_rulebook_hash
      AND status = 'active'
    FOR UPDATE;
  IF v_base.id IS NULL THEN
    UPDATE seo_rule_patch_candidates
      SET status = 'superseded', updated_at = now()
      WHERE id = v_candidate.id;
    RETURN jsonb_build_object('status','superseded');
  END IF;

  v_value := (v_candidate.patch->>'value')::INTEGER;
  CASE v_candidate.patch_path
    WHEN 'risk.actionValueLimits.updateSchoolMetaTitle.max' THEN
      v_current := (v_base.content#>>'{risk,actionValueLimits,updateSchoolMetaTitle,max}')::INTEGER;
      IF v_value <> v_current - 5 OR v_value < 40 THEN
        RAISE EXCEPTION 'unsafe title max patch';
      END IF;
      v_expected := jsonb_set(
        v_base.content,
        '{risk,actionValueLimits,updateSchoolMetaTitle,max}',
        to_jsonb(v_value),
        false
      );
    WHEN 'risk.actionValueLimits.updateFeatureMetaDescription.max' THEN
      v_current := (v_base.content#>>'{risk,actionValueLimits,updateFeatureMetaDescription,max}')::INTEGER;
      IF v_value <> v_current - 10 OR v_value < 100 THEN
        RAISE EXCEPTION 'unsafe description max patch';
      END IF;
      v_expected := jsonb_set(
        v_base.content,
        '{risk,actionValueLimits,updateFeatureMetaDescription,max}',
        to_jsonb(v_value),
        false
      );
    WHEN 'risk.softEvalMinScore' THEN
      v_current := (v_base.content#>>'{risk,softEvalMinScore}')::INTEGER;
      IF v_value <> v_current + 5 OR v_value > 90 THEN
        RAISE EXCEPTION 'unsafe soft score patch';
      END IF;
      v_expected := jsonb_set(
        v_base.content,
        '{risk,softEvalMinScore}',
        to_jsonb(v_value),
        false
      );
    ELSE
      RAISE EXCEPTION 'patch path is not allowlisted';
  END CASE;
  IF v_expected IS DISTINCT FROM v_candidate.proposed_content THEN
    RAISE EXCEPTION 'proposed rulebook content mismatch';
  END IF;

  INSERT INTO seo_rulebook_rollouts (
    candidate_id, candidate_version, patch_hash,
    base_rulebook_version_id, base_rulebook_version, base_rulebook_hash,
    shadow_content, shadow_content_hash, approved_by_id, approved_by_name
  ) VALUES (
    v_candidate.id, v_candidate.candidate_version, v_candidate.patch_hash,
    v_base.id, v_base.version, v_base.content_hash,
    v_candidate.proposed_content, v_candidate.proposed_content_hash,
    p_approver_id, p_approver_name
  )
  RETURNING id INTO v_rollout_id;

  UPDATE seo_rule_patch_candidates
    SET status = 'shadowing',
        decided_by_id = p_approver_id,
        decided_by_name = p_approver_name,
        decided_at = now(),
        updated_at = now()
    WHERE id = v_candidate.id;

  RETURN jsonb_build_object(
    'status','shadowing','rolloutId',v_rollout_id,
    'contentHash',v_candidate.proposed_content_hash
  );
END;
$$;

CREATE OR REPLACE FUNCTION promote_seo_rulebook_rollout(
  p_rollout_id UUID,
  p_candidate_id UUID,
  p_candidate_version INTEGER,
  p_patch_hash TEXT,
  p_shadow_content_hash TEXT,
  p_metrics_hash TEXT,
  p_approver_id TEXT,
  p_approver_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rollout seo_rulebook_rollouts%ROWTYPE;
  v_candidate seo_rule_patch_candidates%ROWTYPE;
  v_base seo_rulebook_versions%ROWTYPE;
  v_new_id UUID;
  v_new_version INTEGER;
  v_event_id UUID;
  v_expected JSONB;
  v_value INTEGER;
  v_current INTEGER;
  v_new_status TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('seo_rulebook_shadow_rollout'));
  SELECT * INTO v_rollout
    FROM seo_rulebook_rollouts
    WHERE id = p_rollout_id
      AND candidate_id = p_candidate_id
      AND candidate_version = p_candidate_version
      AND patch_hash = p_patch_hash
      AND shadow_content_hash = p_shadow_content_hash
      AND metrics_hash = p_metrics_hash
    FOR UPDATE;
  IF v_rollout.id IS NULL THEN
    RAISE EXCEPTION 'invalid rollout reference';
  END IF;

  IF v_rollout.status IN ('promoted','rolled_back') THEN
    SELECT version, status INTO v_new_version, v_new_status
      FROM seo_rulebook_versions
      WHERE id = v_rollout.promoted_rulebook_version_id;
    RETURN jsonb_build_object(
      'status',v_rollout.status,
      'versionId',v_rollout.promoted_rulebook_version_id,
      'version',v_new_version,'contentHash',v_rollout.shadow_content_hash,
      'isCurrentlyActive',v_new_status = 'active'
    );
  END IF;
  IF v_rollout.status <> 'ready'
    OR COALESCE((v_rollout.metrics->>'eligible')::BOOLEAN, false) <> true
    OR v_rollout.metrics_hash IS NULL THEN
    RAISE EXCEPTION 'rollout is not ready for promotion';
  END IF;

  SELECT * INTO v_candidate
    FROM seo_rule_patch_candidates
    WHERE id = v_rollout.candidate_id
      AND candidate_version = v_rollout.candidate_version
      AND patch_hash = v_rollout.patch_hash
      AND proposed_content_hash = v_rollout.shadow_content_hash
      AND status = 'shadowing'
    FOR UPDATE;
  IF v_candidate.id IS NULL THEN
    RAISE EXCEPTION 'stale rollout candidate';
  END IF;

  SELECT * INTO v_base
    FROM seo_rulebook_versions
    WHERE id = v_rollout.base_rulebook_version_id
      AND version = v_rollout.base_rulebook_version
      AND content_hash = v_rollout.base_rulebook_hash
      AND status = 'active'
    FOR UPDATE;
  IF v_base.id IS NULL THEN
    UPDATE seo_rulebook_rollouts
      SET status = 'superseded', completed_at = now()
      WHERE id = v_rollout.id;
    UPDATE seo_rule_patch_candidates
      SET status = 'superseded', updated_at = now()
      WHERE id = v_candidate.id;
    RETURN jsonb_build_object('status','superseded');
  END IF;

  v_value := (v_candidate.patch->>'value')::INTEGER;
  CASE v_candidate.patch_path
    WHEN 'risk.actionValueLimits.updateSchoolMetaTitle.max' THEN
      v_current := (v_base.content#>>'{risk,actionValueLimits,updateSchoolMetaTitle,max}')::INTEGER;
      IF v_value <> v_current - 5 OR v_value < 40 THEN
        RAISE EXCEPTION 'unsafe title max patch';
      END IF;
      v_expected := jsonb_set(
        v_base.content,
        '{risk,actionValueLimits,updateSchoolMetaTitle,max}',
        to_jsonb(v_value),
        false
      );
    WHEN 'risk.actionValueLimits.updateFeatureMetaDescription.max' THEN
      v_current := (v_base.content#>>'{risk,actionValueLimits,updateFeatureMetaDescription,max}')::INTEGER;
      IF v_value <> v_current - 10 OR v_value < 100 THEN
        RAISE EXCEPTION 'unsafe description max patch';
      END IF;
      v_expected := jsonb_set(
        v_base.content,
        '{risk,actionValueLimits,updateFeatureMetaDescription,max}',
        to_jsonb(v_value),
        false
      );
    WHEN 'risk.softEvalMinScore' THEN
      v_current := (v_base.content#>>'{risk,softEvalMinScore}')::INTEGER;
      IF v_value <> v_current + 5 OR v_value > 90 THEN
        RAISE EXCEPTION 'unsafe soft score patch';
      END IF;
      v_expected := jsonb_set(
        v_base.content,
        '{risk,softEvalMinScore}',
        to_jsonb(v_value),
        false
      );
    ELSE
      RAISE EXCEPTION 'patch path is not allowlisted';
  END CASE;
  IF v_expected IS DISTINCT FROM v_candidate.proposed_content
    OR v_expected IS DISTINCT FROM v_rollout.shadow_content THEN
    RAISE EXCEPTION 'rollout rulebook content mismatch';
  END IF;

  SELECT COALESCE(max(version), 0) + 1 INTO v_new_version
    FROM seo_rulebook_versions;
  UPDATE seo_rulebook_versions
    SET status = 'retired', retired_at = now(), updated_at = now()
    WHERE id = v_base.id;
  INSERT INTO seo_rulebook_versions (
    version, schema_version, status, content, content_hash, change_summary,
    activated_at, candidate_id, created_by_kind
  ) VALUES (
    v_new_version, 1, 'active', v_candidate.proposed_content,
    v_candidate.proposed_content_hash,
    concat(
      'shadow_promoted_rule_patch: ', v_candidate.patch_path, ' ',
      v_candidate.patch->>'value', ' (evidence ', v_candidate.evidence_count, ')'
    ),
    now(), v_candidate.id, 'rule_patch'
  )
  RETURNING id INTO v_new_id;

  UPDATE seo_rule_patch_candidates
    SET status = 'applied',
        applied_rulebook_version_id = v_new_id,
        updated_at = now()
    WHERE id = v_candidate.id;
  UPDATE seo_rulebook_rollouts
    SET status = 'promoted',
        promoted_by_id = p_approver_id,
        promoted_by_name = p_approver_name,
        promoted_rulebook_version_id = v_new_id,
        promoted_at = now(),
        completed_at = now()
    WHERE id = v_rollout.id;

  INSERT INTO seo_rulebook_activation_events (
    event_type, candidate_id, from_version_id, to_version_id, patch_path,
    actor_id, actor_name, idempotency_key, baseline_metrics
  ) VALUES (
    'applied', v_candidate.id, v_base.id, v_new_id, v_candidate.patch_path,
    p_approver_id, p_approver_name, concat('apply:',v_candidate.id::text),
    v_rollout.metrics
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;
  IF v_event_id IS NULL THEN
    SELECT id INTO v_event_id FROM seo_rulebook_activation_events
      WHERE idempotency_key = concat('apply:',v_candidate.id::text);
  END IF;

  RETURN jsonb_build_object(
    'status','promoted','eventId',v_event_id,'versionId',v_new_id,
    'version',v_new_version,'contentHash',v_candidate.proposed_content_hash,
    'isCurrentlyActive',true
  );
END;
$$;

CREATE OR REPLACE FUNCTION reject_seo_rulebook_rollout(
  p_rollout_id UUID,
  p_candidate_id UUID,
  p_candidate_version INTEGER,
  p_patch_hash TEXT,
  p_shadow_content_hash TEXT,
  p_approver_id TEXT,
  p_approver_name TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('seo_rulebook_shadow_rollout'));
  UPDATE seo_rulebook_rollouts
    SET status = 'rejected',
        promoted_by_id = p_approver_id,
        promoted_by_name = p_approver_name,
        completed_at = now()
    WHERE id = p_rollout_id
      AND candidate_id = p_candidate_id
      AND candidate_version = p_candidate_version
      AND patch_hash = p_patch_hash
      AND shadow_content_hash = p_shadow_content_hash
      AND status IN ('shadowing','ready')
    RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM seo_rulebook_rollouts
      WHERE id = p_rollout_id
        AND candidate_id = p_candidate_id
        AND candidate_version = p_candidate_version
        AND patch_hash = p_patch_hash
        AND shadow_content_hash = p_shadow_content_hash
        AND status = 'rejected';
  END IF;
  IF v_id IS NULL THEN RAISE EXCEPTION 'stale rollout'; END IF;

  UPDATE seo_rule_patch_candidates
    SET status = 'rejected',
        updated_at = now()
    WHERE id = p_candidate_id AND status = 'shadowing';
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION mark_seo_rulebook_rollout_rolled_back()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_type = 'rollback' THEN
    UPDATE seo_rulebook_rollouts
      SET status = 'rolled_back', completed_at = now()
      WHERE promoted_rulebook_version_id = NEW.from_version_id
        AND status = 'promoted';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_mark_seo_rulebook_rollout_rolled_back
  ON seo_rulebook_activation_events;
CREATE TRIGGER trg_mark_seo_rulebook_rollout_rolled_back
  AFTER INSERT ON seo_rulebook_activation_events
  FOR EACH ROW EXECUTE FUNCTION mark_seo_rulebook_rollout_rolled_back();

ALTER TABLE seo_rulebook_rollouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_rulebook_shadow_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_rulebook_rollout_metric_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_seo_rulebook_rollouts"
  ON seo_rulebook_rollouts;
CREATE POLICY "service_role_full_access_seo_rulebook_rollouts"
  ON seo_rulebook_rollouts FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "service_role_full_access_seo_rulebook_shadow_evaluations"
  ON seo_rulebook_shadow_evaluations;
CREATE POLICY "service_role_full_access_seo_rulebook_shadow_evaluations"
  ON seo_rulebook_shadow_evaluations FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "service_role_full_access_seo_rulebook_rollout_metric_snapshots"
  ON seo_rulebook_rollout_metric_snapshots;
CREATE POLICY "service_role_full_access_seo_rulebook_rollout_metric_snapshots"
  ON seo_rulebook_rollout_metric_snapshots FOR ALL USING (auth.role() = 'service_role');

REVOKE ALL ON FUNCTION approve_seo_rule_patch(UUID, INTEGER, TEXT, TEXT, TEXT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_seo_rule_patch(UUID, INTEGER, TEXT, TEXT, TEXT)
  TO service_role;
REVOKE ALL ON FUNCTION promote_seo_rulebook_rollout(
  UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION promote_seo_rulebook_rollout(
  UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;
REVOKE ALL ON FUNCTION reject_seo_rulebook_rollout(
  UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reject_seo_rulebook_rollout(
  UUID, UUID, INTEGER, TEXT, TEXT, TEXT, TEXT
) TO service_role;

NOTIFY pgrst, 'reload schema';
