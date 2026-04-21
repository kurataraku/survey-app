-- 口コミモデレーション + キャンペーン機能
-- 実行: Supabase SQL Editor で手動実行

-- ============================================================
-- 1. survey_responses にモデレーション用カラム追加
-- ============================================================
ALTER TABLE survey_responses
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_duplicate_email BOOLEAN NOT NULL DEFAULT false;

-- 既存の公開済みレコードは approved に設定
UPDATE survey_responses
  SET moderation_status = 'approved'
  WHERE is_public = true AND moderation_status = 'pending';

-- インデックス
CREATE INDEX IF NOT EXISTS idx_survey_responses_moderation_status
  ON survey_responses(moderation_status);

-- ============================================================
-- 2. AI審査結果テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS review_moderation_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_response_id UUID NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  danger_score INTEGER NOT NULL CHECK (danger_score >= 0 AND danger_score <= 100),
  flags JSONB NOT NULL DEFAULT '{}',
  -- flags の構造:
  -- {
  --   "personal_info": boolean,      -- 個人特定できる記述
  --   "fake_review": boolean,        -- 虚偽・作り話
  --   "advertisement": boolean,      -- 広告・宣伝
  --   "hate_speech": boolean,        -- 差別・ヘイト
  --   "fake_school": boolean,        -- 学校が実在しない可能性
  --   "duplicate_email": boolean     -- 同メール重複
  -- }
  reason TEXT NOT NULL,
  similar_response_ids UUID[] DEFAULT '{}',
  model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_moderation_results_response_id
  ON review_moderation_results(survey_response_id);

-- ============================================================
-- 3. キャンペーン管理テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL DEFAULT 'quocard_pay'
    CHECK (reward_type IN ('quocard_pay')),
  reward_amount INTEGER NOT NULL CHECK (reward_amount > 0),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. 謝礼送付記録テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS campaign_grants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id),
  survey_response_id UUID NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  gift_code TEXT,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_grants_response_id
  ON campaign_grants(survey_response_id);
CREATE INDEX IF NOT EXISTS idx_campaign_grants_email
  ON campaign_grants(email);

-- ============================================================
-- 5. メール送信ログテーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_response_id UUID REFERENCES survey_responses(id) ON DELETE SET NULL,
  email_type TEXT NOT NULL
    CHECK (email_type IN ('approved', 'rejected', 'campaign_grant')),
  to_email TEXT NOT NULL,
  subject TEXT,
  body TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_response_id
  ON email_logs(survey_response_id);

-- ============================================================
-- 6. RLSポリシー
-- ============================================================

-- review_moderation_results: 管理者のみ
ALTER TABLE review_moderation_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_moderation" ON review_moderation_results
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- campaigns: 管理者のみ書き込み、公開は誰でも読める
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_campaigns" ON campaigns
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "anon_read_active_campaigns" ON campaigns
  FOR SELECT TO anon USING (is_active = true AND now() BETWEEN starts_at AND ends_at);

-- campaign_grants: 管理者のみ
ALTER TABLE campaign_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_grants" ON campaign_grants
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- email_logs: 管理者のみ
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_email_logs" ON email_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
