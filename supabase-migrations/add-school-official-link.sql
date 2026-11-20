-- 学校が自校の管理画面で設定する「公式サイトを見る」ボタンのリンク先
-- 運営が登録する schools.official_url（AI抽出・学校詳細も使う共有データ）は上書きしない。
-- 公開ページでは、この列に値があればこちらを優先し、無ければ従来どおり schools.official_url を使う。
-- 前提: create-school-partnerships.sql を適用済みであること。

ALTER TABLE public.school_partnerships
  ADD COLUMN IF NOT EXISTS school_link_url text
    CHECK (school_link_url IS NULL OR (char_length(school_link_url) <= 500 AND school_link_url ~ '^https://')),
  ADD COLUMN IF NOT EXISTS school_link_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS school_link_updated_by uuid;
