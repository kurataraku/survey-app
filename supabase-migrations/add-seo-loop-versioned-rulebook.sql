-- SEO Loop Unit 7: Versioned Rulebookをrun開始時に固定する
-- add-seo-loop-proposal-revisions.sql 適用後に手動実行する

CREATE TABLE IF NOT EXISTS seo_rulebook_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE CHECK (version >= 1),
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  status TEXT NOT NULL CHECK (status IN ('draft','active','retired')),
  content JSONB NOT NULL,
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  change_summary TEXT NOT NULL,
  activated_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_rulebook_one_active
  ON seo_rulebook_versions(status)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS seo_rulebook_bindings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL UNIQUE REFERENCES seo_loop_runs(id) ON DELETE CASCADE,
  rulebook_version_id UUID NOT NULL REFERENCES seo_rulebook_versions(id),
  rulebook_version INTEGER NOT NULL CHECK (rulebook_version >= 1),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  content_snapshot JSONB NOT NULL,
  bound_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_rulebook_bindings_version
  ON seo_rulebook_bindings(rulebook_version_id);

ALTER TABLE seo_proposals
  ADD COLUMN IF NOT EXISTS rulebook_version_id UUID
  REFERENCES seo_rulebook_versions(id);
ALTER TABLE seo_proposals
  ADD COLUMN IF NOT EXISTS rulebook_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE seo_proposals
  ADD COLUMN IF NOT EXISTS rulebook_hash TEXT NOT NULL
  DEFAULT 'ac0f3b6225efc5b0343dd2600c35d9e9bb2baded66e472ff4f19cfed2d23046d';
ALTER TABLE seo_proposals
  ADD COLUMN IF NOT EXISTS applied_rule_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE seo_proposal_evaluations
  ADD COLUMN IF NOT EXISTS rulebook_version_id UUID
  REFERENCES seo_rulebook_versions(id);
ALTER TABLE seo_proposal_evaluations
  ADD COLUMN IF NOT EXISTS rulebook_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE seo_proposal_evaluations
  ADD COLUMN IF NOT EXISTS rulebook_hash TEXT NOT NULL
  DEFAULT 'ac0f3b6225efc5b0343dd2600c35d9e9bb2baded66e472ff4f19cfed2d23046d';
ALTER TABLE seo_proposal_evaluations
  ADD COLUMN IF NOT EXISTS applied_rule_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

INSERT INTO seo_rulebook_versions (
  version,
  schema_version,
  status,
  content,
  content_hash,
  change_summary,
  activated_at
) VALUES (
  1,
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
        "striking_distance": ["updateSeoSummary", "addApprovedInternalLink"],
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
  'ac0f3b6225efc5b0343dd2600c35d9e9bb2baded66e472ff4f19cfed2d23046d',
  'Unit 7 initial rulebook; equivalent to the code fallback',
  now()
)
ON CONFLICT (version) DO NOTHING;

INSERT INTO seo_rulebook_bindings (
  run_id,
  rulebook_version_id,
  rulebook_version,
  content_hash,
  content_snapshot
)
SELECT
  run.id,
  version.id,
  version.version,
  version.content_hash,
  version.content
FROM seo_loop_runs AS run
CROSS JOIN LATERAL (
  SELECT id, version, content_hash, content
  FROM seo_rulebook_versions
  WHERE version = 1
  LIMIT 1
) AS version
WHERE run.status IN (
  'observing','analyzing','revising','pending_approval','executing','remeasuring'
)
ON CONFLICT (run_id) DO NOTHING;

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
    OR NEW.content_hash IS DISTINCT FROM OLD.content_hash THEN
    RAISE EXCEPTION 'rulebook version content is immutable; create a new version';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_seo_rulebook_content_mutation
  ON seo_rulebook_versions;
CREATE TRIGGER trg_prevent_seo_rulebook_content_mutation
  BEFORE UPDATE ON seo_rulebook_versions
  FOR EACH ROW EXECUTE FUNCTION prevent_seo_rulebook_content_mutation();

CREATE OR REPLACE FUNCTION attach_bound_rulebook_to_proposal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_binding seo_rulebook_bindings%ROWTYPE;
  v_rule_ids TEXT[];
  v_declared_hash TEXT;
BEGIN
  SELECT * INTO v_binding
    FROM seo_rulebook_bindings
    WHERE run_id = NEW.run_id;

  IF v_binding.id IS NOT NULL THEN
    v_declared_hash := COALESCE(
      NEW.baseline->'revision'->>'rulebook_hash',
      NEW.rulebook_hash
    );
    IF v_declared_hash IS DISTINCT FROM v_binding.content_hash THEN
      RAISE EXCEPTION 'proposal rulebook hash differs from run binding';
    END IF;
    v_rule_ids := ARRAY(
      SELECT jsonb_array_elements_text(
        v_binding.content_snapshot->'analyzer'->'ruleIds'
      )
    ) || ARRAY(
      SELECT jsonb_array_elements_text(
        v_binding.content_snapshot->'risk'->'ruleIds'
      )
    ) || ARRAY(
      SELECT jsonb_array_elements_text(
        v_binding.content_snapshot->'ops'->'ruleIds'
      )
    );
    IF jsonb_typeof(NEW.payload->'ruleIds') = 'array'
      AND ARRAY(
        SELECT value
        FROM jsonb_array_elements_text(NEW.payload->'ruleIds') AS value
        ORDER BY value
      ) IS DISTINCT FROM ARRAY(
        SELECT value
        FROM unnest(v_rule_ids) AS value
        ORDER BY value
      ) THEN
      RAISE EXCEPTION 'proposal rule IDs differ from run binding';
    END IF;
    NEW.rulebook_version_id := v_binding.rulebook_version_id;
    NEW.rulebook_version := v_binding.rulebook_version;
    NEW.rulebook_hash := v_binding.content_hash;
    NEW.applied_rule_ids := v_rule_ids;
  ELSIF jsonb_typeof(NEW.payload->'ruleIds') = 'array' THEN
    NEW.applied_rule_ids := ARRAY(
      SELECT jsonb_array_elements_text(NEW.payload->'ruleIds')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attach_bound_rulebook_to_proposal
  ON seo_proposals;
CREATE TRIGGER trg_attach_bound_rulebook_to_proposal
  BEFORE INSERT ON seo_proposals
  FOR EACH ROW EXECUTE FUNCTION attach_bound_rulebook_to_proposal();

ALTER TABLE seo_rulebook_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_rulebook_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_seo_rulebook_versions"
  ON seo_rulebook_versions;
CREATE POLICY "service_role_full_access_seo_rulebook_versions"
  ON seo_rulebook_versions FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_role_full_access_seo_rulebook_bindings"
  ON seo_rulebook_bindings;
CREATE POLICY "service_role_full_access_seo_rulebook_bindings"
  ON seo_rulebook_bindings FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE seo_rulebook_versions IS
  'Immutable versioned SEO analyzer/risk/ops rulebook';
COMMENT ON TABLE seo_rulebook_bindings IS
  'Rulebook snapshot pinned once per SEO run';

NOTIFY pgrst, 'reload schema';
