-- 学校提携の検証用ダミーデータ（本番DBでも公開サイトに出ない設定で投入する）
--
-- 前提: create-school-partnerships.sql を適用済みであること。
--
-- なぜ公開サイトに出ないか:
--   公開側（学校個別ページ・学校一覧・sitemap・generateStaticParams・RLSの公開ポリシー）は
--   すべて status = 'active' かつ is_public = true で絞っている。
--   一方で提携のRPCは status = 'active' のみを条件にしているため、
--   is_public = false のままでも資料請求の受付・共有・学校画面の確認は通る。
--   公開ページの見た目（案内カード・写真の即時反映）を確認するときだけ、
--   対象校を一時的に is_public = true にし、確認後すぐ false に戻す。
--
-- 検証が終わったら cleanup-partnership-verification.sql を実行して必ず削除する。

BEGIN;

-- 学校A・B（名前に【検証用】を付け、slugも衝突しないものにする）
-- name_normalized は NOT NULL かつユニーク。アプリ側の normalizeText（空白除去・「高等学校」→「高校」）に合わせる
INSERT INTO public.schools (id, name, name_normalized, prefecture, slug, status, is_public, official_url, official_url_verified)
VALUES
  ('0a0a0a0a-0000-4000-8000-00000000000a', '【検証用】提携テスト高等学校A', '【検証用】提携テスト高校A', '東京都', 'kensho-partnership-a', 'active', false, 'https://example.com/a/', true),
  ('0b0b0b0b-0000-4000-8000-00000000000b', '【検証用】提携テスト高等学校B', '【検証用】提携テスト高校B', '大阪府', 'kensho-partnership-b', 'active', false, 'https://example.com/b/', true)
ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name, name_normalized = EXCLUDED.name_normalized, slug = EXCLUDED.slug,
      status = EXCLUDED.status, is_public = false,
      official_url = EXCLUDED.official_url, official_url_verified = EXCLUDED.official_url_verified;

-- 提携設定（提供先の運営法人名と閲覧期限）
INSERT INTO public.school_partnerships (school_id, official_link_enabled, request_enabled, content_enabled, recipient_name, access_days)
VALUES
  ('0a0a0a0a-0000-4000-8000-00000000000a', true, true, true, '学校法人検証学園A', 90),
  ('0b0b0b0b-0000-4000-8000-00000000000b', true, true, true, '学校法人検証学園B', 30)
ON CONFLICT (school_id) DO UPDATE
  SET official_link_enabled = EXCLUDED.official_link_enabled, request_enabled = EXCLUDED.request_enabled,
      content_enabled = EXCLUDED.content_enabled, recipient_name = EXCLUDED.recipient_name,
      access_days = EXCLUDED.access_days, updated_at = now();

-- 学校担当者（RPCレベルの検証用。user_id は学校認証プロジェクトのユーザーIDと対応しないため、
-- この3件では学校向け画面にログインできない。画面からの確認は招待で作った担当者で行う）
INSERT INTO public.school_partner_members (user_id, school_id, email, active)
VALUES
  ('1a1a1a1a-0000-4000-8000-00000000000a', '0a0a0a0a-0000-4000-8000-00000000000a', 'kensho-a1@example.invalid', true),
  ('2a2a2a2a-0000-4000-8000-00000000000a', '0a0a0a0a-0000-4000-8000-00000000000a', 'kensho-a2@example.invalid', true),
  ('1b1b1b1b-0000-4000-8000-00000000000b', '0b0b0b0b-0000-4000-8000-00000000000b', 'kensho-b1@example.invalid', true)
ON CONFLICT (user_id) DO UPDATE SET school_id = EXCLUDED.school_id, email = EXCLUDED.email, active = true;

COMMIT;

-- 確認
SELECT s.name, s.status, s.is_public, p.request_enabled, p.content_enabled, p.recipient_name, p.access_days,
  (SELECT count(*) FROM public.school_partner_members m WHERE m.school_id = s.id AND m.active) AS active_members
FROM public.schools s JOIN public.school_partnerships p ON p.school_id = s.id
WHERE s.id IN ('0a0a0a0a-0000-4000-8000-00000000000a', '0b0b0b0b-0000-4000-8000-00000000000b');
