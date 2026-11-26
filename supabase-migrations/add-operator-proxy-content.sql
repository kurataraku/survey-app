-- 運営が学校の画面を代わりに表示し、写真・メッセージ・公式サイトのリンクを代理で登録できるようにする
-- 前提: create-school-partnerships.sql / add-school-official-link.sql / add-school-link-review.sql を適用済みであること。
--
-- ・掲載内容の登録者に「運営」を加える（submitted_by は学校担当者のIDなので、運営の登録では空にし、別の列に運営のIDを持つ）
-- ・運営が代理で登録した内容は、運営が確認済みとして公開する（status = 'approved'）
-- ・公式サイトのリンクにも、最後に設定したのが学校か運営かを残す

BEGIN;

ALTER TABLE public.school_partner_content ALTER COLUMN submitted_by DROP NOT NULL;
ALTER TABLE public.school_partner_content
  ADD COLUMN IF NOT EXISTS submitted_scope text NOT NULL DEFAULT 'school' CHECK (submitted_scope IN ('school', 'operator')),
  ADD COLUMN IF NOT EXISTS submitted_by_operator uuid;
ALTER TABLE public.school_partner_content DROP CONSTRAINT IF EXISTS school_partner_content_submitter;
ALTER TABLE public.school_partner_content ADD CONSTRAINT school_partner_content_submitter CHECK (
  (submitted_scope = 'school' AND submitted_by IS NOT NULL)
  OR (submitted_scope = 'operator' AND submitted_by_operator IS NOT NULL)
);

ALTER TABLE public.school_partnerships
  ADD COLUMN IF NOT EXISTS school_link_updated_scope text
    CHECK (school_link_updated_scope IS NULL OR school_link_updated_scope IN ('school', 'operator'));

CREATE OR REPLACE FUNCTION public.submit_school_partner_content_by_operator(
  p_school_id uuid, p_actor_id uuid, p_kind text, p_body text, p_photo_path text, p_caption text, p_alt text
) RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM 1 FROM public.school_partnerships p JOIN public.schools s ON s.id = p.school_id
    WHERE p.school_id = p_school_id AND s.status = 'active'
    FOR SHARE OF p, s;
  IF NOT FOUND THEN RAISE EXCEPTION 'content_unavailable'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('content:' || p_school_id::text || ':' || p_kind, 0));
  UPDATE public.school_partner_content SET status = 'superseded'
    WHERE school_id = p_school_id AND kind = p_kind AND status <> 'superseded';

  INSERT INTO public.school_partner_content
    (school_id, kind, status, body, photo_path, caption, alt, submitted_scope, submitted_by_operator, reviewed_at, reviewed_by)
    VALUES (p_school_id, p_kind, 'approved', p_body, p_photo_path, p_caption, p_alt, 'operator', p_actor_id, now(), p_actor_id)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_school_partner_content_by_operator(uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_school_partner_content_by_operator(uuid, uuid, text, text, text, text, text) TO service_role;

COMMIT;
