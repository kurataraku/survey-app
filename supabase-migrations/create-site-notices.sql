-- トップページ「お知らせ」欄用テーブル
-- 実行: Supabase SQL Editor で手動実行

CREATE TABLE IF NOT EXISTS site_notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,                         -- 補足文（任意）
  link_url TEXT,                     -- リンク先（任意）。https://... または /... のみ
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),  -- 表示日。未来日なら、その日時まで非表示
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT site_notices_link_url_check
    CHECK (link_url IS NULL OR link_url ~ '^(https?://|/)')
);

CREATE INDEX IF NOT EXISTS idx_site_notices_published
  ON site_notices (is_published, published_at DESC);

ALTER TABLE site_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_site_notices" ON site_notices
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "anon_read_published_site_notices" ON site_notices
  FOR SELECT TO anon
  USING (is_published = true AND published_at <= now());

-- 最初のお知らせ（PR HEADLINE 掲載。任意で実行）
-- INSERT INTO site_notices (title, link_url, is_published, published_at)
-- VALUES (
--   'PR HEADLINE に掲載されました',
--   'https://www.pr-headline.com/news/20261120-21c561b9',
--   true,
--   '2026-11-20 00:00:00+09'
-- );
