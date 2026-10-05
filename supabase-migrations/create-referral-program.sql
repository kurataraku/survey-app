-- 紹介（リファラル）制度
-- 依存: create-review-moderation-campaign.sql の適用後に実行
-- 実行: Supabase SQL Editor で手動実行

-- ============================================================
-- 1. 紹介コード（紹介者 1 人 = メールアドレス 1 件につき 1 コード）
-- ============================================================
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  -- 小文字・前後空白除去で正規化したメールアドレス
  referrer_email TEXT NOT NULL UNIQUE,
  -- PostgREST の埋め込みが曖昧にならないよう FK は張らない
  first_survey_response_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_referral_codes" ON referral_codes;
CREATE POLICY "service_role_all_referral_codes" ON referral_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- 2. survey_responses: 紹介元と不正検知用ハッシュ
-- ============================================================
ALTER TABLE survey_responses
  ADD COLUMN IF NOT EXISTS referral_code_id UUID REFERENCES referral_codes(id) ON DELETE SET NULL,
  -- 送信元 IP の HMAC-SHA256（生 IP は保存しない）
  ADD COLUMN IF NOT EXISTS ip_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_survey_responses_referral_code_id
  ON survey_responses(referral_code_id);

-- ============================================================
-- 3. campaigns: 紹介制度の設定
-- ============================================================
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS referral_enabled BOOLEAN NOT NULL DEFAULT false,
  -- 紹介者への謝礼（紹介 1 人につき）。NULL の場合は reward_amount と同額。
  -- 紹介された人は reward_amount のみで、紹介経由でも上乗せしない
  ADD COLUMN IF NOT EXISTS referral_reward_amount INTEGER
    CHECK (referral_reward_amount IS NULL OR referral_reward_amount > 0),
  -- 紹介者 1 人あたりの紹介謝礼の上限人数。NULL は無制限（既定）
  ADD COLUMN IF NOT EXISTS referral_max_per_referrer INTEGER
    CHECK (referral_max_per_referrer IS NULL OR referral_max_per_referrer > 0);

-- ============================================================
-- 4. campaign_grants: 謝礼種別
-- ============================================================
--   review   : 通常の口コミ謝礼
--   referee  : 紹介経由で回答した人への謝礼（review の代わりに付与。金額は通常と同じ）
--   referrer : 紹介者への謝礼（survey_response_id は紹介された人の回答）
-- reward_amount は作成時点の金額のスナップショット（キャンペーン金額を後で変えても変わらない）
ALTER TABLE campaign_grants
  ADD COLUMN IF NOT EXISTS grant_type TEXT NOT NULL DEFAULT 'review'
    CHECK (grant_type IN ('review', 'referee', 'referrer')),
  ADD COLUMN IF NOT EXISTS reward_amount INTEGER,
  ADD COLUMN IF NOT EXISTS referral_code_id UUID REFERENCES referral_codes(id) ON DELETE SET NULL,
  -- 自作自演の疑いなど、送付前に管理者確認が必要な理由
  ADD COLUMN IF NOT EXISTS flag_reason TEXT;

ALTER TABLE campaign_grants DROP CONSTRAINT IF EXISTS campaign_grants_status_check;
ALTER TABLE campaign_grants ADD CONSTRAINT campaign_grants_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'cancelled'));

-- 承認の再実行で紹介謝礼が二重に作られないようにする
CREATE UNIQUE INDEX IF NOT EXISTS uq_campaign_grants_referral_per_response
  ON campaign_grants(survey_response_id, grant_type)
  WHERE grant_type IN ('referee', 'referrer');

CREATE INDEX IF NOT EXISTS idx_campaign_grants_referral_code_id
  ON campaign_grants(referral_code_id);

-- ============================================================
-- 5. email_logs: 紹介関連メール種別
-- ============================================================
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_email_type_check;
ALTER TABLE email_logs ADD CONSTRAINT email_logs_email_type_check
  CHECK (email_type IN ('approved', 'rejected', 'campaign_grant', 'referral_request', 'referral_reward'));

CREATE INDEX IF NOT EXISTS idx_email_logs_type_to_email
  ON email_logs(email_type, to_email);

-- ============================================================
-- 6. 紹介の案内メールの配信停止
-- ============================================================
-- 停止した人には、紹介依頼メールを送らず、承認メール等にも紹介セクションを載せない
CREATE TABLE IF NOT EXISTS email_unsubscribes (
  -- 小文字・前後空白除去で正規化したメールアドレス
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE email_unsubscribes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_email_unsubscribes" ON email_unsubscribes;
CREATE POLICY "service_role_all_email_unsubscribes" ON email_unsubscribes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
