-- 学費目安（参考目安）管理テーブルの作成
-- 学校ごとの学費目安を出典・確認状態付きで管理し、draft→published のワークフローで公開する
-- 依存: schools, admin_users, update_updated_at_column()

-- schools に公式サイトURLを追加（AI抽出の起点・管理用）
ALTER TABLE schools ADD COLUMN IF NOT EXISTS official_url TEXT;
COMMENT ON COLUMN schools.official_url IS '学校公式サイトのURL（学費AI抽出の起点。管理用でユーザー画面には表示しない）';

-- テーブルの作成
CREATE TABLE IF NOT EXISTS school_tuition_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- 表示モード: amounts=金額レンジを表示 / varies=コースにより変動 / contact_required=個別確認が必要
  display_mode TEXT NOT NULL DEFAULT 'amounts'
    CHECK (display_mode IN ('amounts', 'varies', 'contact_required')),

  -- サマリーレンジ（円単位、NULL=不明。0円は不可＝不明金額を0円として扱わない）
  first_year_min INTEGER CHECK (first_year_min > 0),
  first_year_max INTEGER CHECK (first_year_max > 0),
  annual_min INTEGER CHECK (annual_min > 0),
  annual_max INTEGER CHECK (annual_max > 0),
  monthly_min INTEGER CHECK (monthly_min > 0),
  monthly_max INTEGER CHECK (monthly_max > 0),

  -- コース別・通学頻度別パターン（任意）
  -- [{ label, course_name, attendance, first_year_min, first_year_max,
  --    annual_min, annual_max, monthly_min, monthly_max,
  --    support_fund: 'before' | 'after' | 'unknown', note }]
  plans JSONB DEFAULT '[]'::JSONB,

  -- 任意の費目内訳（入学金・授業料・施設費など。取得できた場合のみ）
  -- [{ item, amount_min, amount_max, note }]
  breakdown JSONB,

  -- 公開表示用の注記
  support_fund_note TEXT,  -- 就学支援金に関する注記
  public_note TEXT,        -- 学費に関する注意書き

  -- 内部管理（ユーザー画面には表示しない）
  source_type TEXT NOT NULL DEFAULT 'unverified'
    CHECK (source_type IN ('official_site', 'official_pdf', 'external_media', 'unverified')),
  source_urls JSONB DEFAULT '[]'::JSONB,  -- [{ url, kind, note }]
  source_excerpt TEXT,     -- 抽出元の原文抜粋（監査・修正依頼対応用）
  verified_at DATE,        -- 情報確認日（人間が出典と照合した日）
  internal_memo TEXT,      -- 内部メモ（条件不明点・抽出時の注意など）

  -- 運用状態
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('ai', 'manual')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'rejected')),

  created_by UUID NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_school_tuition_estimates_school_id
  ON school_tuition_estimates(school_id);
CREATE INDEX IF NOT EXISTS idx_school_tuition_estimates_status
  ON school_tuition_estimates(status);

-- 部分ユニークインデックス: published は1校あたり1件のみ
CREATE UNIQUE INDEX IF NOT EXISTS uniq_school_tuition_estimates_published
  ON school_tuition_estimates (school_id)
  WHERE status = 'published';

-- updated_at を自動更新するトリガー
CREATE TRIGGER update_school_tuition_estimates_updated_at
  BEFORE UPDATE ON school_tuition_estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLSポリシー（add-school-ai-summaries-rls.sql と同パターン）
ALTER TABLE school_tuition_estimates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "公開側は公開済み学費目安のみ参照可能" ON school_tuition_estimates;
DROP POLICY IF EXISTS "管理者はschool_tuition_estimatesを全操作可能" ON school_tuition_estimates;

-- 公開側: published のみ SELECT 可能
CREATE POLICY "公開側は公開済み学費目安のみ参照可能"
  ON school_tuition_estimates
  FOR SELECT
  USING (status = 'published');

-- 管理者: 全操作可能（実際の管理画面操作は Service Role 経由のため補助的な役割）
CREATE POLICY "管理者はschool_tuition_estimatesを全操作可能"
  ON school_tuition_estimates
  FOR ALL
  USING (auth.role() = 'authenticated');

-- コメント
COMMENT ON TABLE school_tuition_estimates IS '学校ごとの学費目安（参考目安）。出典・確認状態を内部管理し、published のみ公開側に表示する';
COMMENT ON COLUMN school_tuition_estimates.display_mode IS '表示モード: amounts=金額表示 / varies=コースにより変動 / contact_required=個別確認が必要';
COMMENT ON COLUMN school_tuition_estimates.first_year_min IS '初年度費用の目安（最小、円）。NULL=不明';
COMMENT ON COLUMN school_tuition_estimates.first_year_max IS '初年度費用の目安（最大、円）。NULL=不明';
COMMENT ON COLUMN school_tuition_estimates.annual_min IS '年間費用の目安（最小、円）。NULL=不明';
COMMENT ON COLUMN school_tuition_estimates.annual_max IS '年間費用の目安（最大、円）。NULL=不明';
COMMENT ON COLUMN school_tuition_estimates.monthly_min IS '月額費用の目安（最小、円）。NULL=不明';
COMMENT ON COLUMN school_tuition_estimates.monthly_max IS '月額費用の目安（最大、円）。NULL=不明';
COMMENT ON COLUMN school_tuition_estimates.plans IS 'コース別・通学頻度別の費用パターン（JSONB配列）';
COMMENT ON COLUMN school_tuition_estimates.breakdown IS '任意の費目内訳（取得できた場合のみ）';
COMMENT ON COLUMN school_tuition_estimates.support_fund_note IS '就学支援金に関する注記（公開表示用）';
COMMENT ON COLUMN school_tuition_estimates.public_note IS '学費に関する注意書き（公開表示用）';
COMMENT ON COLUMN school_tuition_estimates.source_type IS '情報源の種別（内部管理用。ユーザー画面には表示しない）';
COMMENT ON COLUMN school_tuition_estimates.source_urls IS '出典URL一覧（内部管理用）';
COMMENT ON COLUMN school_tuition_estimates.source_excerpt IS '抽出元の原文抜粋（監査・学校からの修正依頼対応用）';
COMMENT ON COLUMN school_tuition_estimates.verified_at IS '情報確認日（人間が出典と照合した日。内部管理用）';
COMMENT ON COLUMN school_tuition_estimates.origin IS 'データの作成元: ai=AI抽出 / manual=手入力';
COMMENT ON COLUMN school_tuition_estimates.status IS '運用状態: draft（下書き）/ published（公開済み）/ rejected（却下）';
