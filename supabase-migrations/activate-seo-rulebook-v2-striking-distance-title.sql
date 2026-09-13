-- striking_distanceでもCTR改善の主施策であるtitle変更を提案できるようにする
-- add-seo-loop-typed-rule-patches.sql / add-seo-loop-shadow-rollouts.sql 適用後に手動実行する

DO $$
DECLARE
  v_previous seo_rulebook_versions%ROWTYPE;
  v_new_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('seo_rulebook_manual_activation_v2'));

  SELECT * INTO v_previous
    FROM seo_rulebook_versions
    WHERE status = 'active'
    ORDER BY version DESC
    LIMIT 1
    FOR UPDATE;

  IF v_previous.id IS NULL THEN
    RAISE EXCEPTION 'active Rulebookがありません';
  END IF;

  IF v_previous.version = 2 THEN
    RETURN;
  END IF;

  IF v_previous.version <> 1 THEN
    RAISE EXCEPTION '想定外のactive Rulebook versionです: %', v_previous.version;
  END IF;

  UPDATE seo_rulebook_versions
    SET status = 'retired',
        retired_at = now(),
        updated_at = now()
    WHERE id = v_previous.id
      AND status = 'active';

  INSERT INTO seo_rulebook_versions (
    version,
    schema_version,
    status,
    content,
    content_hash,
    change_summary,
    activated_at,
    created_by_kind
  ) VALUES (
    2,
    1,
    'active',
    '{
      "schemaVersion": 1,
      "analyzer": {
        "ruleIds": [
          "analyzer.issue_action_map.v1",
          "analyzer.fact_grounding.v1",
          "analyzer.untrusted_input.v1"
        ],
        "issueActionCandidates": {
          "low_ctr_high_impressions": ["updateSchoolMetaTitle", "updateFeatureMetaDescription"],
          "striking_distance": ["updateSchoolMetaTitle", "updateSeoSummary", "addApprovedInternalLink"],
          "declining_clicks": ["updateSchoolMetaTitle", "updateFeatureMetaDescription", "updateSeoSummary", "addApprovedInternalLink"]
        }
      },
      "risk": {
        "ruleIds": [
          "risk.typed_action_allowlist.v1",
          "risk.action_value_limits.v1",
          "risk.forbidden_expressions.v1",
          "risk.same_origin_link.v1",
          "risk.confidence_threshold.v1"
        ],
        "actionValueLimits": {
          "updateSchoolMetaTitle": {"min": 10, "max": 60},
          "updateFeatureMetaDescription": {"min": 30, "max": 160},
          "updateSeoSummary": {"min": 80, "max": 3000},
          "addApprovedInternalLink": {"min": 10, "max": 2048}
        },
        "forbiddenExpressionIds": [
          "guaranteed_acceptance",
          "number_one_claim",
          "absolute_percentage",
          "outcome_guarantee",
          "lowest_price_claim"
        ],
        "softEvalMinScore": 75,
        "highRiskConfidenceBelow": 0.6
      },
      "ops": {
        "ruleIds": [
          "ops.daily_proposal_limit.v1",
          "ops.target_limit.v1",
          "ops.human_approval.v1"
        ],
        "maxDailyProposals": 10,
        "maxTargetsPerProposal": 3,
        "humanApprovalRequired": true,
        "fallbackOnLoadFailure": true
      }
    }'::jsonb,
    '3ac835c87a6ddfd7fc2ca1d4aa66dfb5d41163efc76aa344854b3e8e20b253de',
    'Enable updateSchoolMetaTitle for striking_distance issues',
    now(),
    'manual'
  )
  ON CONFLICT (version) DO UPDATE
    SET status = 'active',
        activated_at = now(),
        retired_at = NULL,
        updated_at = now()
    WHERE seo_rulebook_versions.content_hash = '3ac835c87a6ddfd7fc2ca1d4aa66dfb5d41163efc76aa344854b3e8e20b253de'
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    RAISE EXCEPTION 'Rulebook v2の有効化に失敗しました';
  END IF;

  INSERT INTO seo_rulebook_activation_events (
    event_type,
    from_version_id,
    to_version_id,
    patch_path,
    actor_id,
    actor_name,
    idempotency_key,
    baseline_metrics
  ) VALUES (
    'applied',
    v_previous.id,
    v_new_id,
    'analyzer.issueActionCandidates.striking_distance',
    'manual-migration',
    'activate-seo-rulebook-v2-striking-distance-title.sql',
    'manual-rulebook-v2-striking-distance-title',
    jsonb_build_object('reason', 'skip shadow while executors are dry-run')
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
