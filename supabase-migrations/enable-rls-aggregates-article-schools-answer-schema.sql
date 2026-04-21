-- Security Advisor: rls_disabled_in_public の解消
-- public.aggregates / public.article_schools / public.answer_schema
--
-- 方針: RLS を有効にし、anon / authenticated 用のポリシーは定義しない。
--       Supabase の service_role は RLS をバイパスするため、サーバー側（API・スクリプト）の
--       SUPABASE_SERVICE_ROLE_KEY 経由の操作は従来どおり動作する。
--
-- 実行: Supabase ダッシュボード → SQL Editor に貼り付けて Run

ALTER TABLE public.aggregates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_schema ENABLE ROW LEVEL SECURITY;

-- 将来、ブラウザの anon キーで直接 SELECT させる場合は、その要件に合わせた
-- CREATE POLICY ... FOR SELECT を別途追加すること。
