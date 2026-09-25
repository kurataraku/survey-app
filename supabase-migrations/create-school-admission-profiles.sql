-- 入学条件・スクーリング確認データ（地域SEO再設計 第3波）
-- 募集区域・スクーリング会場・確認日・出典を学校ごとに1行で管理する。
-- published かつ確認日から12か月以内のものだけを公開側に表示する（それ以外は「未確認」扱い）。
-- 依存: schools, admin_users, update_updated_at_column()

CREATE TABLE IF NOT EXISTS school_admission_profiles (
  school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,

  -- 募集区域: nationwide=全国から出願可 / prefectures=指定都道府県の在住・在勤者のみ / unknown=未確認
  admission_scope TEXT NOT NULL DEFAULT 'unknown'
    CHECK (admission_scope IN ('nationwide', 'prefectures', 'unknown')),
  admission_prefectures TEXT[] NOT NULL DEFAULT '{}',

  -- 必須スクーリングの実施都道府県（本校集中スクーリング等）。空配列=未確認
  schooling_prefectures TEXT[] NOT NULL DEFAULT '{}',
  schooling_note TEXT,

  -- 出典（公式サイト・公式PDF・教育委員会ページのみ）: [{ url, note }]
  source_urls JSONB NOT NULL DEFAULT '[]'::JSONB,
  verified_at DATE,
  -- 情報の対象年度（例: 2027 = 2027年度入学）
  target_year INTEGER CHECK (target_year IS NULL OR target_year BETWEEN 2020 AND 2100),
  internal_memo TEXT,

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  updated_by UUID NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 公開には確認日と出典が必須
  CONSTRAINT school_admission_profiles_publish_requires_source CHECK (
    status <> 'published'
    OR (verified_at IS NOT NULL AND jsonb_array_length(source_urls) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_school_admission_profiles_status
  ON school_admission_profiles(status);
CREATE INDEX IF NOT EXISTS idx_school_admission_profiles_verified_at
  ON school_admission_profiles(verified_at);

DROP TRIGGER IF EXISTS update_school_admission_profiles_updated_at ON school_admission_profiles;
CREATE TRIGGER update_school_admission_profiles_updated_at
  BEFORE UPDATE ON school_admission_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE school_admission_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "公開側は公開済み入学条件のみ参照可能" ON school_admission_profiles;
DROP POLICY IF EXISTS "管理者はschool_admission_profilesを全操作可能" ON school_admission_profiles;

CREATE POLICY "公開側は公開済み入学条件のみ参照可能"
  ON school_admission_profiles
  FOR SELECT
  USING (status = 'published');

CREATE POLICY "管理者はschool_admission_profilesを全操作可能"
  ON school_admission_profiles
  FOR ALL
  USING (auth.role() = 'authenticated');

COMMENT ON TABLE school_admission_profiles IS '入学条件・スクーリング確認データ。published かつ確認日から12か月以内のみ公開側に表示する';
COMMENT ON COLUMN school_admission_profiles.admission_scope IS '募集区域: nationwide（全国）/ prefectures（指定都道府県のみ）/ unknown（未確認）';
COMMENT ON COLUMN school_admission_profiles.admission_prefectures IS 'admission_scope=prefectures のときの対象都道府県';
COMMENT ON COLUMN school_admission_profiles.schooling_prefectures IS '必須スクーリングを実施する都道府県';
COMMENT ON COLUMN school_admission_profiles.source_urls IS '出典URL（公式サイト・公式PDF・教育委員会ページのみ）';
COMMENT ON COLUMN school_admission_profiles.verified_at IS '人間が出典と照合した日。12か月を過ぎると再確認対象';
COMMENT ON COLUMN school_admission_profiles.target_year IS '情報の対象年度（入学年度）';
