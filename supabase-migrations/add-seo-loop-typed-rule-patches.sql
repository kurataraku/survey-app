-- SEO Loop Unit 8: feedbackからTyped Rule Patch候補を作り第二承認でactive化する
-- add-seo-loop-versioned-rulebook.sql 適用後に手動実行する

ALTER TABLE seo_feedback
  ADD COLUMN IF NOT EXISTS rule_patch_consumed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_seo_feedback_rule_patch_unconsumed
  ON seo_feedback(created_at DESC)
  WHERE general_rule_candidate = true AND rule_patch_consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS seo_rule_patch_candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_key TEXT NOT NULL UNIQUE,
  candidate_version INTEGER NOT NULL DEFAULT 1 CHECK (candidate_version = 1),
  base_rulebook_version_id UUID NOT NULL REFERENCES seo_rulebook_versions(id),
  base_rulebook_version INTEGER NOT NULL,
  base_rulebook_hash TEXT NOT NULL CHECK (length(base_rulebook_hash) = 64),
  patch_path TEXT NOT NULL CHECK (patch_path IN (
    'risk.actionValueLimits.updateSchoolMetaTitle.max',
    'risk.actionValueLimits.updateFeatureMetaDescription.max',
    'risk.softEvalMinScore'
  )),
  patch JSONB NOT NULL,
  patch_hash TEXT NOT NULL CHECK (length(patch_hash) = 64),
  proposed_content JSONB NOT NULL,
  proposed_content_hash TEXT NOT NULL CHECK (length(proposed_content_hash) = 64),
  evidence_count INTEGER NOT NULL CHECK (evidence_count >= 2),
  quality_result JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','pending_approval','applied','rejected','superseded','expired','failed'
  )),
  slack_channel TEXT,
  slack_message_ts TEXT,
  notify_attempted_at TIMESTAMPTZ,
  decided_by_id TEXT,
  decided_by_name TEXT,
  decided_at TIMESTAMPTZ,
  applied_rulebook_version_id UUID REFERENCES seo_rulebook_versions(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_rule_patch_one_pending_path
  ON seo_rule_patch_candidates(patch_path)
  WHERE status IN ('draft','pending_approval');

CREATE INDEX IF NOT EXISTS idx_seo_rule_patch_candidate_status
  ON seo_rule_patch_candidates(status, created_at);
CREATE INDEX IF NOT EXISTS idx_seo_rule_patch_candidate_cooldown
  ON seo_rule_patch_candidates(patch_path, status, created_at DESC);

CREATE TABLE IF NOT EXISTS seo_rule_patch_evidence (
  candidate_id UUID NOT NULL REFERENCES seo_rule_patch_candidates(id) ON DELETE CASCADE,
  feedback_id UUID NOT NULL UNIQUE REFERENCES seo_feedback(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (candidate_id, feedback_id)
);
UPDATE seo_feedback
  SET rule_patch_consumed_at = COALESCE(rule_patch_consumed_at, now())
  WHERE id IN (SELECT feedback_id FROM seo_rule_patch_evidence)
    AND rule_patch_consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS seo_rulebook_activation_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('applied','rollback')),
  candidate_id UUID REFERENCES seo_rule_patch_candidates(id),
  from_version_id UUID NOT NULL REFERENCES seo_rulebook_versions(id),
  to_version_id UUID NOT NULL REFERENCES seo_rulebook_versions(id),
  patch_path TEXT,
  actor_id TEXT NOT NULL,
  actor_name TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  baseline_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_rulebook_candidate_event
  ON seo_rulebook_activation_events(candidate_id, event_type)
  WHERE candidate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seo_rulebook_event_cooldown
  ON seo_rulebook_activation_events(patch_path, created_at DESC);

ALTER TABLE seo_rulebook_versions
  ADD COLUMN IF NOT EXISTS candidate_id UUID REFERENCES seo_rule_patch_candidates(id);
ALTER TABLE seo_rulebook_versions
  ADD COLUMN IF NOT EXISTS created_by_kind TEXT NOT NULL DEFAULT 'migration'
  CHECK (created_by_kind IN ('migration','rule_patch','manual','rollback'));

CREATE OR REPLACE FUNCTION prevent_seo_rulebook_content_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.version IS DISTINCT FROM OLD.version
    OR NEW.schema_version IS DISTINCT FROM OLD.schema_version
    OR NEW.content IS DISTINCT FROM OLD.content
    OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
    OR NEW.candidate_id IS DISTINCT FROM OLD.candidate_id
    OR NEW.created_by_kind IS DISTINCT FROM OLD.created_by_kind THEN
    RAISE EXCEPTION 'rulebook version content is immutable; create a new version';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_seo_rulebook_binding_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'run rulebook binding is immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_seo_rulebook_binding_update
  ON seo_rulebook_bindings;
CREATE TRIGGER trg_prevent_seo_rulebook_binding_update
  BEFORE UPDATE ON seo_rulebook_bindings
  FOR EACH ROW EXECUTE FUNCTION prevent_seo_rulebook_binding_update();

CREATE OR REPLACE FUNCTION prevent_seo_rule_patch_candidate_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.candidate_key IS DISTINCT FROM OLD.candidate_key
    OR NEW.candidate_version IS DISTINCT FROM OLD.candidate_version
    OR NEW.base_rulebook_version_id IS DISTINCT FROM OLD.base_rulebook_version_id
    OR NEW.base_rulebook_version IS DISTINCT FROM OLD.base_rulebook_version
    OR NEW.base_rulebook_hash IS DISTINCT FROM OLD.base_rulebook_hash
    OR NEW.patch_path IS DISTINCT FROM OLD.patch_path
    OR NEW.patch IS DISTINCT FROM OLD.patch
    OR NEW.patch_hash IS DISTINCT FROM OLD.patch_hash
    OR NEW.proposed_content IS DISTINCT FROM OLD.proposed_content
    OR NEW.proposed_content_hash IS DISTINCT FROM OLD.proposed_content_hash
    OR NEW.evidence_count IS DISTINCT FROM OLD.evidence_count
    OR NEW.quality_result IS DISTINCT FROM OLD.quality_result THEN
    RAISE EXCEPTION 'rule patch candidate content is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_seo_rule_patch_candidate_mutation
  ON seo_rule_patch_candidates;
CREATE TRIGGER trg_prevent_seo_rule_patch_candidate_mutation
  BEFORE UPDATE ON seo_rule_patch_candidates
  FOR EACH ROW EXECUTE FUNCTION prevent_seo_rule_patch_candidate_mutation();

CREATE OR REPLACE FUNCTION prevent_seo_rulebook_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'rulebook activation events are append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_seo_rulebook_event_mutation
  ON seo_rulebook_activation_events;
CREATE TRIGGER trg_prevent_seo_rulebook_event_mutation
  BEFORE UPDATE OR DELETE ON seo_rulebook_activation_events
  FOR EACH ROW EXECUTE FUNCTION prevent_seo_rulebook_event_mutation();

CREATE OR REPLACE FUNCTION create_seo_rule_patch_candidate(
  p_candidate_key TEXT,
  p_base_version_id UUID,
  p_base_version INTEGER,
  p_base_hash TEXT,
  p_patch_path TEXT,
  p_patch JSONB,
  p_patch_hash TEXT,
  p_proposed_content JSONB,
  p_proposed_content_hash TEXT,
  p_feedback_ids UUID[],
  p_quality_result JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_candidate_id UUID;
  v_base seo_rulebook_versions%ROWTYPE;
  v_expected JSONB;
  v_value INTEGER;
  v_current INTEGER;
  v_new_status TEXT;
  v_feedback_count INTEGER;
  v_issue_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('seo-rule-patch-candidate'));

  SELECT id INTO v_candidate_id
    FROM seo_rule_patch_candidates
    WHERE candidate_key = p_candidate_key;
  IF v_candidate_id IS NOT NULL THEN
    RETURN v_candidate_id;
  END IF;

  IF p_patch_path NOT IN (
    'risk.actionValueLimits.updateSchoolMetaTitle.max',
    'risk.actionValueLimits.updateFeatureMetaDescription.max',
    'risk.softEvalMinScore'
  ) OR p_patch->>'op' <> 'replace'
    OR p_patch->>'path' <> p_patch_path
    OR jsonb_typeof(p_patch->'value') <> 'number' THEN
    RAISE EXCEPTION 'invalid typed rule patch';
  END IF;
  v_value := (p_patch->>'value')::INTEGER;

  SELECT * INTO v_base
    FROM seo_rulebook_versions
    WHERE id = p_base_version_id
      AND version = p_base_version
      AND content_hash = p_base_hash
      AND status = 'active'
    FOR UPDATE;
  IF v_base.id IS NULL THEN
    RAISE EXCEPTION 'stale base rulebook';
  END IF;

  SELECT count(*), count(DISTINCT issue.issue_key)
    INTO v_feedback_count, v_issue_count
    FROM seo_feedback AS feedback
    JOIN seo_proposals AS proposal ON proposal.id = feedback.proposal_id
    JOIN seo_issues AS issue ON issue.id = proposal.issue_id
    WHERE feedback.id = ANY(p_feedback_ids)
      AND feedback.general_rule_candidate = true
      AND feedback.created_at >= now() - interval '60 days'
      AND issue.issue_key IS NOT NULL;
  IF v_feedback_count <> cardinality(p_feedback_ids)
    OR v_feedback_count < 2 OR v_issue_count < 2 THEN
    RAISE EXCEPTION 'insufficient independent feedback evidence';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM seo_feedback AS feedback
    JOIN seo_proposals AS proposal ON proposal.id = feedback.proposal_id
    WHERE feedback.id = ANY(p_feedback_ids)
      AND NOT (
        (p_patch_path = 'risk.softEvalMinScore' AND feedback.category IN (
          'risk_concern','weak_evidence','expected_impact_unclear'
        ))
        OR
        (p_patch_path = 'risk.actionValueLimits.updateSchoolMetaTitle.max'
          AND feedback.category = 'poor_expression'
          AND proposal.action = 'updateSchoolMetaTitle')
        OR
        (p_patch_path = 'risk.actionValueLimits.updateFeatureMetaDescription.max'
          AND feedback.category = 'poor_expression'
          AND proposal.action = 'updateFeatureMetaDescription')
      )
  ) THEN
    RAISE EXCEPTION 'feedback evidence does not match typed patch';
  END IF;

  CASE p_patch_path
    WHEN 'risk.actionValueLimits.updateSchoolMetaTitle.max' THEN
      v_current := (v_base.content#>>'{risk,actionValueLimits,updateSchoolMetaTitle,max}')::INTEGER;
      IF v_value <> v_current - 5 OR v_value < 40 THEN
        RAISE EXCEPTION 'unsafe title max patch';
      END IF;
      v_expected := jsonb_set(v_base.content, '{risk,actionValueLimits,updateSchoolMetaTitle,max}', to_jsonb(v_value), false);
    WHEN 'risk.actionValueLimits.updateFeatureMetaDescription.max' THEN
      v_current := (v_base.content#>>'{risk,actionValueLimits,updateFeatureMetaDescription,max}')::INTEGER;
      IF v_value <> v_current - 10 OR v_value < 100 THEN
        RAISE EXCEPTION 'unsafe description max patch';
      END IF;
      v_expected := jsonb_set(v_base.content, '{risk,actionValueLimits,updateFeatureMetaDescription,max}', to_jsonb(v_value), false);
    WHEN 'risk.softEvalMinScore' THEN
      v_current := (v_base.content#>>'{risk,softEvalMinScore}')::INTEGER;
      IF v_value <> v_current + 5 OR v_value > 90 THEN
        RAISE EXCEPTION 'unsafe soft score patch';
      END IF;
      v_expected := jsonb_set(v_base.content, '{risk,softEvalMinScore}', to_jsonb(v_value), false);
  END CASE;

  IF v_expected IS DISTINCT FROM p_proposed_content
    OR COALESCE((p_quality_result->>'passed')::BOOLEAN, false) IS NOT true THEN
    RAISE EXCEPTION 'candidate content or quality result mismatch';
  END IF;

  INSERT INTO seo_rule_patch_candidates (
    candidate_key, base_rulebook_version_id, base_rulebook_version,
    base_rulebook_hash, patch_path, patch, patch_hash, proposed_content,
    proposed_content_hash, evidence_count, quality_result, status
  ) VALUES (
    p_candidate_key, p_base_version_id, p_base_version, p_base_hash,
    p_patch_path, p_patch, p_patch_hash, p_proposed_content,
    p_proposed_content_hash, v_feedback_count, p_quality_result, 'draft'
  )
  RETURNING id INTO v_candidate_id;

  INSERT INTO seo_rule_patch_evidence(candidate_id, feedback_id)
    SELECT v_candidate_id, feedback_id
    FROM unnest(p_feedback_ids) AS feedback_id;
  UPDATE seo_feedback
    SET rule_patch_consumed_at = now()
    WHERE id = ANY(p_feedback_ids);

  UPDATE seo_rule_patch_candidates
    SET status = 'pending_approval', updated_at = now()
    WHERE id = v_candidate_id;
  RETURN v_candidate_id;
END;
$$;

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
  v_new_id UUID;
  v_new_version INTEGER;
  v_event_id UUID;
  v_expected JSONB;
  v_value INTEGER;
  v_current INTEGER;
BEGIN
  SELECT * INTO v_candidate
    FROM seo_rule_patch_candidates
    WHERE id = p_candidate_id
      AND candidate_version = p_candidate_version
      AND patch_hash = p_patch_hash
    FOR UPDATE;
  IF v_candidate.id IS NULL THEN
    RAISE EXCEPTION 'invalid rule patch reference';
  END IF;

  IF v_candidate.status = 'applied' THEN
    SELECT id, to_version_id INTO v_event_id, v_new_id
      FROM seo_rulebook_activation_events
      WHERE candidate_id = v_candidate.id AND event_type = 'applied';
    SELECT version, status INTO v_new_version, v_new_status
      FROM seo_rulebook_versions WHERE id = v_new_id;
    RETURN jsonb_build_object(
      'status','applied','eventId',v_event_id,'versionId',v_new_id,
      'version',v_new_version,'contentHash',v_candidate.proposed_content_hash,
      'isCurrentlyActive',v_new_status = 'active'
    );
  END IF;
  IF v_candidate.status <> 'pending_approval' OR v_candidate.expires_at <= now() THEN
    RAISE EXCEPTION 'stale rule patch candidate';
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
      v_expected := jsonb_set(v_base.content, '{risk,actionValueLimits,updateSchoolMetaTitle,max}', to_jsonb(v_value), false);
    WHEN 'risk.actionValueLimits.updateFeatureMetaDescription.max' THEN
      v_current := (v_base.content#>>'{risk,actionValueLimits,updateFeatureMetaDescription,max}')::INTEGER;
      IF v_value <> v_current - 10 OR v_value < 100 THEN
        RAISE EXCEPTION 'unsafe description max patch';
      END IF;
      v_expected := jsonb_set(v_base.content, '{risk,actionValueLimits,updateFeatureMetaDescription,max}', to_jsonb(v_value), false);
    WHEN 'risk.softEvalMinScore' THEN
      v_current := (v_base.content#>>'{risk,softEvalMinScore}')::INTEGER;
      IF v_value <> v_current + 5 OR v_value > 90 THEN
        RAISE EXCEPTION 'unsafe soft score patch';
      END IF;
      v_expected := jsonb_set(v_base.content, '{risk,softEvalMinScore}', to_jsonb(v_value), false);
    ELSE
      RAISE EXCEPTION 'patch path is not allowlisted';
  END CASE;
  IF v_expected IS DISTINCT FROM v_candidate.proposed_content THEN
    RAISE EXCEPTION 'proposed rulebook content mismatch';
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
    concat('typed_rule_patch: ', v_candidate.patch_path, ' ', v_candidate.patch->>'value',
      ' (evidence ', v_candidate.evidence_count, ')'),
    now(), v_candidate.id, 'rule_patch'
  )
  RETURNING id INTO v_new_id;

  UPDATE seo_rule_patch_candidates
    SET status = 'applied', applied_rulebook_version_id = v_new_id,
        decided_by_id = p_approver_id, decided_by_name = p_approver_name,
        decided_at = now(), updated_at = now()
    WHERE id = v_candidate.id;
  INSERT INTO seo_rulebook_activation_events (
    event_type, candidate_id, from_version_id, to_version_id, patch_path,
    actor_id, actor_name, idempotency_key
  ) VALUES (
    'applied', v_candidate.id, v_base.id, v_new_id, v_candidate.patch_path,
    p_approver_id, p_approver_name, concat('apply:',v_candidate.id::text)
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;
  IF v_event_id IS NULL THEN
    SELECT id INTO v_event_id FROM seo_rulebook_activation_events
      WHERE idempotency_key = concat('apply:',v_candidate.id::text);
  END IF;
  RETURN jsonb_build_object(
    'status','applied','eventId',v_event_id,'versionId',v_new_id,
    'version',v_new_version,'contentHash',v_candidate.proposed_content_hash,
    'isCurrentlyActive',true
  );
END;
$$;

CREATE OR REPLACE FUNCTION reject_seo_rule_patch(
  p_candidate_id UUID,
  p_candidate_version INTEGER,
  p_patch_hash TEXT,
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
  UPDATE seo_rule_patch_candidates
    SET status = 'rejected', decided_by_id = p_approver_id,
        decided_by_name = p_approver_name, decided_at = now(), updated_at = now()
    WHERE id = p_candidate_id AND candidate_version = p_candidate_version
      AND patch_hash = p_patch_hash AND status = 'pending_approval'
    RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM seo_rule_patch_candidates
      WHERE id = p_candidate_id AND candidate_version = p_candidate_version
        AND patch_hash = p_patch_hash AND status = 'rejected';
  END IF;
  IF v_id IS NULL THEN RAISE EXCEPTION 'stale rule patch candidate'; END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION rollback_seo_rulebook(
  p_current_version_id UUID,
  p_current_hash TEXT,
  p_actor_id TEXT,
  p_actor_name TEXT,
  p_idempotency_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current seo_rulebook_versions%ROWTYPE;
  v_target_id UUID;
  v_event_id UUID;
  v_patch_path TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key));
  SELECT id, to_version_id INTO v_event_id, v_target_id
    FROM seo_rulebook_activation_events
    WHERE idempotency_key = p_idempotency_key;
  IF v_event_id IS NOT NULL THEN
    RETURN jsonb_build_object('status','rolled_back','eventId',v_event_id,'versionId',v_target_id);
  END IF;

  SELECT * INTO v_current FROM seo_rulebook_versions
    WHERE id = p_current_version_id AND content_hash = p_current_hash
      AND status = 'active' FOR UPDATE;
  IF v_current.id IS NULL THEN RAISE EXCEPTION 'stale active rulebook'; END IF;

  SELECT from_version_id, patch_path INTO v_target_id, v_patch_path
    FROM seo_rulebook_activation_events
    WHERE event_type = 'applied' AND to_version_id = v_current.id
    ORDER BY created_at DESC LIMIT 1;
  IF v_target_id IS NULL THEN RAISE EXCEPTION 'rollback target is unavailable'; END IF;

  UPDATE seo_rulebook_versions
    SET status = 'retired', retired_at = now(), updated_at = now()
    WHERE id = v_current.id;
  UPDATE seo_rulebook_versions
    SET status = 'active', activated_at = now(), retired_at = NULL,
        updated_at = now()
    WHERE id = v_target_id AND status = 'retired';
  IF NOT FOUND THEN RAISE EXCEPTION 'rollback target is not retired'; END IF;

  INSERT INTO seo_rulebook_activation_events (
    event_type, candidate_id, from_version_id, to_version_id, patch_path,
    actor_id, actor_name, idempotency_key
  ) VALUES (
    'rollback', NULL, v_current.id, v_target_id, v_patch_path,
    p_actor_id, p_actor_name, p_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;
  IF v_event_id IS NULL THEN
    SELECT id INTO v_event_id FROM seo_rulebook_activation_events
      WHERE idempotency_key = p_idempotency_key;
  END IF;
  RETURN jsonb_build_object('status','rolled_back','eventId',v_event_id,'versionId',v_target_id);
END;
$$;

ALTER TABLE seo_rule_patch_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_rule_patch_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_rulebook_activation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_seo_rule_patch_candidates"
  ON seo_rule_patch_candidates;
CREATE POLICY "service_role_full_access_seo_rule_patch_candidates"
  ON seo_rule_patch_candidates FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "service_role_full_access_seo_rule_patch_evidence"
  ON seo_rule_patch_evidence;
CREATE POLICY "service_role_full_access_seo_rule_patch_evidence"
  ON seo_rule_patch_evidence FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "service_role_full_access_seo_rulebook_activation_events"
  ON seo_rulebook_activation_events;
CREATE POLICY "service_role_full_access_seo_rulebook_activation_events"
  ON seo_rulebook_activation_events FOR ALL USING (auth.role() = 'service_role');

REVOKE ALL ON FUNCTION create_seo_rule_patch_candidate(
  TEXT, UUID, INTEGER, TEXT, TEXT, JSONB, TEXT, JSONB, TEXT, UUID[], JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_seo_rule_patch_candidate(
  TEXT, UUID, INTEGER, TEXT, TEXT, JSONB, TEXT, JSONB, TEXT, UUID[], JSONB
) TO service_role;
REVOKE ALL ON FUNCTION approve_seo_rule_patch(UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_seo_rule_patch(UUID, INTEGER, TEXT, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION reject_seo_rule_patch(UUID, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reject_seo_rule_patch(UUID, INTEGER, TEXT, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION rollback_seo_rulebook(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rollback_seo_rulebook(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
