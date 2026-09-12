-- SEO Loop Unit 8 follow-up: 一人運用でもRule Patchの第二承認を可能にする
-- add-seo-loop-typed-rule-patches.sql 適用後に手動実行する
--
-- 「第二承認」はproposal feedbackとは別の明示的な承認工程を意味する。
-- evidence提出者と承認者が同一でも許可する一方、次の安全境界は維持する:
-- distinct issue_key >= 2 / Typed path allowlist / 固定歩幅と運用床 /
-- candidate version・patch hash・base version固定 / 専用Slack承認者。

CREATE OR REPLACE FUNCTION create_seo_rule_patch_candidate_v2(
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
  v_feedback_count INTEGER;
  v_issue_key_count INTEGER;
BEGIN
  SELECT count(*), count(DISTINCT issue.issue_key)
    INTO v_feedback_count, v_issue_key_count
    FROM seo_feedback AS feedback
    JOIN seo_proposals AS proposal ON proposal.id = feedback.proposal_id
    JOIN seo_issues AS issue ON issue.id = proposal.issue_id
    WHERE feedback.id = ANY(p_feedback_ids)
      AND issue.issue_key IS NOT NULL;
  IF v_feedback_count <> cardinality(p_feedback_ids)
    OR v_feedback_count < 2
    OR v_issue_key_count < 2 THEN
    RAISE EXCEPTION 'insufficient independent issue keys';
  END IF;

  RETURN create_seo_rule_patch_candidate(
    p_candidate_key,
    p_base_version_id,
    p_base_version,
    p_base_hash,
    p_patch_path,
    p_patch,
    p_patch_hash,
    p_proposed_content,
    p_proposed_content_hash,
    p_feedback_ids,
    p_quality_result
  );
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
  v_new_status TEXT;
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
      'typed_rule_patch: ',
      v_candidate.patch_path,
      ' ',
      v_candidate.patch->>'value',
      ' (evidence ',
      v_candidate.evidence_count,
      ')'
    ),
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

REVOKE ALL ON FUNCTION create_seo_rule_patch_candidate_v2(
  TEXT, UUID, INTEGER, TEXT, TEXT, JSONB, TEXT, JSONB, TEXT, UUID[], JSONB
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_seo_rule_patch_candidate_v2(
  TEXT, UUID, INTEGER, TEXT, TEXT, JSONB, TEXT, JSONB, TEXT, UUID[], JSONB
) TO service_role;
REVOKE ALL ON FUNCTION approve_seo_rule_patch(UUID, INTEGER, TEXT, TEXT, TEXT)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_seo_rule_patch(UUID, INTEGER, TEXT, TEXT, TEXT)
  TO service_role;

COMMENT ON FUNCTION approve_seo_rule_patch(UUID, INTEGER, TEXT, TEXT, TEXT) IS
  'Typed Rule Patchの第二承認。一人運用ではevidence提出者本人の承認を許可し、その他の安全境界を維持する';

NOTIFY pgrst, 'reload schema';
