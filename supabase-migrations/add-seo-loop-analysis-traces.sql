  -- SEO Loop Unit 3: Analyst / Strategist の再現可能な実行履歴
  -- add-seo-loop-proposal-v2.sql 適用後に Supabase SQL Editor で手動実行する

  CREATE TABLE IF NOT EXISTS seo_analysis_traces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES seo_loop_runs(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES seo_issues(id) ON DELETE CASCADE,
    stage TEXT NOT NULL CHECK (stage IN ('analyst', 'strategist')),
    attempt INTEGER NOT NULL CHECK (attempt >= 1 AND attempt <= 5),
    prompt_version TEXT NOT NULL,
    model_provider TEXT NOT NULL CHECK (model_provider IN ('openai', 'anthropic')),
    model TEXT NOT NULL,
    input_context_hash TEXT NOT NULL,
    input_snapshot JSONB NOT NULL,
    raw_output TEXT,
    parsed_output JSONB,
    status TEXT NOT NULL
      CHECK (status IN ('succeeded', 'invalid_output', 'call_failed')),
    error_message TEXT,
    token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (run_id, issue_id, stage, attempt)
  );

  CREATE INDEX IF NOT EXISTS idx_seo_analysis_traces_issue_stage
    ON seo_analysis_traces(issue_id, stage, attempt);

  CREATE INDEX IF NOT EXISTS idx_seo_analysis_traces_run_id
    ON seo_analysis_traces(run_id);

  ALTER TABLE seo_analysis_traces ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "service_role_full_access_seo_analysis_traces"
    ON seo_analysis_traces;

  CREATE POLICY "service_role_full_access_seo_analysis_traces"
    ON seo_analysis_traces FOR ALL
    USING (auth.role() = 'service_role');

  COMMENT ON TABLE seo_analysis_traces IS
    'SEO Analyst/Strategistのprompt version、model、入力hash、出力、再試行結果';
