-- MY STORY AWARD: contest entries and resumable drafts
-- Execute manually in Supabase SQL Editor.

ALTER TABLE survey_responses
  ADD COLUMN IF NOT EXISTS entry_source TEXT NOT NULL DEFAULT 'survey'
    CHECK (entry_source IN ('survey', 'my_story_award'));

CREATE INDEX IF NOT EXISTS idx_survey_responses_entry_source
  ON survey_responses(entry_source);

CREATE TABLE IF NOT EXISTS contest_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_response_id UUID NOT NULL UNIQUE REFERENCES survey_responses(id) ON DELETE CASCADE,
  entry_source TEXT NOT NULL DEFAULT 'my_story_award'
    CHECK (entry_source = 'my_story_award'),
  author_type TEXT NOT NULL CHECK (author_type IN ('在校生', '卒業生')),
  pen_name TEXT NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) <= 20),
  effort_summary TEXT NOT NULL,
  before_enrollment TEXT NOT NULL,
  after_enrollment TEXT NOT NULL,
  learning_and_change TEXT NOT NULL,
  future_goal TEXT,
  current_life TEXT,
  wants_feedback BOOLEAN NOT NULL DEFAULT false,
  publication_consent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contest_entries_survey_response_id
  ON contest_entries(survey_response_id);
CREATE INDEX IF NOT EXISTS idx_contest_entries_author_type
  ON contest_entries(author_type);

CREATE TABLE IF NOT EXISTS contest_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  email TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT '2026-12-25 23:59:00+09'::timestamptz
);

CREATE INDEX IF NOT EXISTS idx_contest_drafts_token
  ON contest_drafts(token);
CREATE INDEX IF NOT EXISTS idx_contest_drafts_email
  ON contest_drafts(email)
  WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contest_drafts_active
  ON contest_drafts(updated_at)
  WHERE submitted_at IS NULL;

ALTER TABLE contest_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_contest_entries" ON contest_entries
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE contest_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_contest_drafts" ON contest_drafts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE email_logs
  DROP CONSTRAINT IF EXISTS email_logs_email_type_check;
ALTER TABLE email_logs
  ADD CONSTRAINT email_logs_email_type_check
  CHECK (email_type IN ('approved', 'rejected', 'campaign_grant', 'referral_request', 'referral_reward', 'contest_draft_resume'));
