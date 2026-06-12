-- コース一覧（公式サイト引用）管理テーブルの作成
-- 学校ごとのコース名一覧を出典・確認状態付きで管理し、draft→published のワークフローで公開する
-- 学費目安（school_tuition_estimates）と同じ概念だが、表示・承認は完全に独立させる
-- 依存: schools, admin_users, update_updated_at_column()

CREATE TABLE IF NOT EXISTS school_course_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

  -- コース一覧（公開表示用）
  -- [{ name, attendance, note }]
  -- name: コース名（公式サイトの名称をそのまま転記）
  -- attendance: 通学頻度（例: 週5日 / オンライン。本文に明記がある場合のみ）
  -- note: 補足（例: 2026年度新設。本文に明記がある場合のみ）
  courses JSONB NOT NULL DEFAULT '[]'::JSONB,

  -- 公開表示用の注記（任意）
  public_note TEXT,

  -- 内部管理（確認日・原文抜粋はユーザー画面には表示しない。出典が公式サイトであることは公開側にクレジット表記する）
  source_type TEXT NOT NULL DEFAULT 'unverified'
    CHECK (source_type IN ('official_site', 'official_pdf', 'external_media', 'unverified')),
  source_urls JSONB DEFAULT '[]'::JSONB,  -- [{ url, kind, note }]
  source_excerpt TEXT,     -- 抽出元の原文抜粋（監査・修正依頼対応用）
  verified_at DATE,        -- 情報確認日（人間が出典と照合した日）
  internal_memo TEXT,      -- 内部メモ（抽出時の警告など）

  -- 運用状態
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('ai', 'manual')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'rejected')),

  created_by UUID NULL REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_school_course_listings_school_id
  ON school_course_listings(school_id);
CREATE INDEX IF NOT EXISTS idx_school_course_listings_status
  ON school_course_listings(status);

-- 部分ユニークインデックス: published は1校あたり1件のみ
CREATE UNIQUE INDEX IF NOT EXISTS uniq_school_course_listings_published
  ON school_course_listings (school_id)
  WHERE status = 'published';

-- updated_at を自動更新するトリガー
CREATE TRIGGER update_school_course_listings_updated_at
  BEFORE UPDATE ON school_course_listings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLSポリシー（school_tuition_estimates と同パターン）
ALTER TABLE school_course_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "公開側は公開済みコース一覧のみ参照可能" ON school_course_listings;
DROP POLICY IF EXISTS "管理者はschool_course_listingsを全操作可能" ON school_course_listings;

-- 公開側: published のみ SELECT 可能
CREATE POLICY "公開側は公開済みコース一覧のみ参照可能"
  ON school_course_listings
  FOR SELECT
  USING (status = 'published');

-- 管理者: 全操作可能（実際の管理画面操作は Service Role 経由のため補助的な役割）
CREATE POLICY "管理者はschool_course_listingsを全操作可能"
  ON school_course_listings
  FOR ALL
  USING (auth.role() = 'authenticated');

-- コメント
COMMENT ON TABLE school_course_listings IS '学校ごとのコース一覧（公式サイト引用）。出典・確認状態を内部管理し、published のみ公開側に表示する';
COMMENT ON COLUMN school_course_listings.courses IS 'コース一覧（JSONB配列）。name は公式サイトの名称をそのまま転記する';
COMMENT ON COLUMN school_course_listings.public_note IS 'コースに関する注意書き（公開表示用）';
COMMENT ON COLUMN school_course_listings.source_type IS '情報源の種別（内部管理用）';
COMMENT ON COLUMN school_course_listings.source_urls IS '出典URL一覧（内部管理用）';
COMMENT ON COLUMN school_course_listings.source_excerpt IS '抽出元の原文抜粋（監査・学校からの修正依頼対応用）';
COMMENT ON COLUMN school_course_listings.verified_at IS '情報確認日（人間が出典と照合した日。内部管理用）';
COMMENT ON COLUMN school_course_listings.origin IS 'データの作成元: ai=AI抽出 / manual=手入力';
COMMENT ON COLUMN school_course_listings.status IS '運用状態: draft（下書き）/ published（公開済み）/ rejected（却下）';
