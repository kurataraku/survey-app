BEGIN;

CREATE TABLE IF NOT EXISTS public.school_partnerships (
  school_id uuid PRIMARY KEY REFERENCES public.schools(id) ON DELETE RESTRICT,
  official_link_enabled boolean NOT NULL DEFAULT false,
  request_enabled boolean NOT NULL DEFAULT false,
  content_enabled boolean NOT NULL DEFAULT false,
  recipient_name text NOT NULL DEFAULT '',
  access_days integer NOT NULL DEFAULT 90 CHECK (access_days BETWEEN 7 AND 365),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT request_enabled OR btrim(recipient_name) <> '')
);

-- user_id belongs to the separate school authentication project.
CREATE TABLE IF NOT EXISTS public.school_partner_members (
  user_id uuid PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.school_partnerships(school_id) ON DELETE RESTRICT,
  email text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS school_partner_members_school ON public.school_partner_members(school_id) WHERE active;

CREATE TABLE IF NOT EXISTS public.school_partner_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.school_partnerships(school_id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('photo', 'message')),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'stopped', 'revision_pending', 'superseded')),
  body text,
  photo_path text,
  caption text,
  alt text,
  submitted_by uuid NOT NULL REFERENCES public.school_partner_members(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  stop_reason text,
  CHECK (
    (kind = 'message' AND body IS NOT NULL AND char_length(body) BETWEEN 1 AND 300 AND photo_path IS NULL)
    OR (kind = 'photo' AND photo_path IS NOT NULL AND alt IS NOT NULL AND body IS NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS school_partner_current_content
  ON public.school_partner_content(school_id, kind) WHERE status <> 'superseded';

CREATE TABLE IF NOT EXISTS public.school_material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_key uuid NOT NULL UNIQUE,
  school_id uuid NOT NULL REFERENCES public.school_partnerships(school_id) ON DELETE RESTRICT,
  recipient_name text NOT NULL,
  recipient_label text NOT NULL,
  addressee text NOT NULL,
  postal_code text NOT NULL,
  address text NOT NULL,
  email text NOT NULL,
  phone text,
  applicant_role text NOT NULL CHECK (applicant_role IN ('guardian', 'adult')),
  consent_version text NOT NULL,
  consent_text text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  source_hash text NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'held', 'shared', 'acknowledged', 'shipped', 'cancelled')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  shared_at timestamptz,
  access_until timestamptz,
  acknowledged_at timestamptz,
  shipped_at timestamptz
);
CREATE INDEX IF NOT EXISTS school_material_requests_school_created ON public.school_material_requests(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS school_material_requests_school_shared ON public.school_material_requests(school_id, shared_at DESC);
CREATE INDEX IF NOT EXISTS school_material_requests_source ON public.school_material_requests(source_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS public.school_material_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.school_material_requests(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('held', 'shared', 'viewed', 'acknowledged', 'shipped', 'cancelled')),
  actor_scope text NOT NULL CHECK (actor_scope IN ('operator', 'school')),
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS school_material_request_events_request ON public.school_material_request_events(request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.school_partner_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.school_partnerships(school_id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES public.school_partner_members(user_id),
  event_kind text NOT NULL CHECK (event_kind IN ('request_shared', 'content_stopped')),
  event_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  created_at timestamptz NOT NULL DEFAULT now(),
  attempted_at timestamptz,
  sent_at timestamptz,
  UNIQUE (event_kind, event_id, member_id)
);
CREATE INDEX IF NOT EXISTS school_partner_notifications_pending ON public.school_partner_notifications(created_at) WHERE status IN ('pending', 'failed', 'sending');

ALTER TABLE public.school_partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_partner_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_partner_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_material_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_partner_notifications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.school_partnerships, public.school_partner_members, public.school_partner_content,
  public.school_material_requests, public.school_material_request_events, public.school_partner_notifications
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_partnerships, public.school_partner_members,
  public.school_partner_content, public.school_material_requests, public.school_material_request_events,
  public.school_partner_notifications TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('school-partner-photos', 'school-partner-photos', false, 3145728, ARRAY['image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS school_partner_photos_server_only ON storage.objects;
CREATE POLICY school_partner_photos_server_only ON storage.objects AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (bucket_id <> 'school-partner-photos') WITH CHECK (bucket_id <> 'school-partner-photos');

CREATE OR REPLACE FUNCTION public.submit_school_material_request(
  p_school_id uuid, p_submission_key uuid, p_recipient_name text, p_recipient_label text,
  p_addressee text, p_postal_code text, p_address text, p_email text, p_phone text,
  p_applicant_role text, p_consent_version text, p_consent_text text, p_source_hash text
) RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_request public.school_material_requests%ROWTYPE;
  v_recipient text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('request:' || p_submission_key::text, 0));
  SELECT * INTO v_request FROM public.school_material_requests WHERE submission_key = p_submission_key;
  IF FOUND THEN
    IF v_request.school_id <> p_school_id OR v_request.email <> p_email OR v_request.address <> p_address
      OR v_request.addressee <> p_addressee OR v_request.postal_code <> p_postal_code
      OR v_request.phone IS DISTINCT FROM p_phone OR v_request.applicant_role <> p_applicant_role THEN
      RAISE EXCEPTION 'submission_conflict';
    END IF;
    RETURN jsonb_build_object('id', v_request.id, 'created', false);
  END IF;

  SELECT p.recipient_name INTO v_recipient
  FROM public.school_partnerships p JOIN public.schools s ON s.id = p.school_id
  WHERE p.school_id = p_school_id AND p.request_enabled AND s.status = 'active' AND s.name = p_recipient_label
    AND EXISTS (SELECT 1 FROM public.school_partner_members m WHERE m.school_id = p_school_id AND m.active)
  FOR SHARE OF p, s;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_unavailable'; END IF;
  IF v_recipient <> p_recipient_name THEN RAISE EXCEPTION 'consent_changed'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('source:' || p_source_hash, 0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('school-email:' || p_school_id::text || ':' || p_email, 0));
  IF (SELECT count(*) FROM public.school_material_requests WHERE source_hash = p_source_hash AND created_at >= now() - interval '1 hour') >= 15
    OR (SELECT count(*) FROM public.school_material_requests WHERE school_id = p_school_id AND email = p_email AND created_at >= now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'request_rate_limited';
  END IF;

  INSERT INTO public.school_material_requests (
    school_id, submission_key, recipient_name, recipient_label, addressee, postal_code, address,
    email, phone, applicant_role, consent_version, consent_text, source_hash
  ) VALUES (
    p_school_id, p_submission_key, p_recipient_name, p_recipient_label, p_addressee, p_postal_code,
    p_address, p_email, p_phone, p_applicant_role, p_consent_version, p_consent_text, p_source_hash
  ) RETURNING * INTO v_request;
  RETURN jsonb_build_object('id', v_request.id, 'created', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_school_partner_content(
  p_member_id uuid, p_kind text, p_body text, p_photo_path text, p_caption text, p_alt text
) RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_school_id uuid;
  v_previous_status text;
  v_id uuid;
BEGIN
  SELECT m.school_id INTO v_school_id
  FROM public.school_partner_members m JOIN public.school_partnerships p ON p.school_id = m.school_id
    JOIN public.schools s ON s.id = m.school_id
  WHERE m.user_id = p_member_id AND m.active AND p.content_enabled AND s.status = 'active'
  FOR SHARE OF m, p, s;
  IF NOT FOUND THEN RAISE EXCEPTION 'content_unavailable'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('content:' || v_school_id::text || ':' || p_kind, 0));
  SELECT status INTO v_previous_status FROM public.school_partner_content
    WHERE school_id = v_school_id AND kind = p_kind AND status <> 'superseded' FOR UPDATE;
  UPDATE public.school_partner_content SET status = 'superseded'
    WHERE school_id = v_school_id AND kind = p_kind AND status <> 'superseded';

  INSERT INTO public.school_partner_content (school_id, kind, status, body, photo_path, caption, alt, submitted_by)
    VALUES (v_school_id, p_kind,
      CASE WHEN v_previous_status IN ('stopped', 'revision_pending') THEN 'revision_pending' ELSE 'pending' END,
      p_body, p_photo_path, p_caption, p_alt, p_member_id)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_school_partner_content(
  p_content_id uuid, p_action text, p_actor_id uuid, p_reason text
) RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_school_id uuid;
BEGIN
  IF p_action = 'approve' THEN
    UPDATE public.school_partner_content SET status = 'approved', reviewed_at = now(), reviewed_by = p_actor_id
      WHERE id = p_content_id AND status IN ('pending', 'revision_pending') RETURNING school_id INTO v_school_id;
  ELSIF p_action = 'stop' AND nullif(btrim(p_reason), '') IS NOT NULL THEN
    UPDATE public.school_partner_content SET status = 'stopped', reviewed_at = now(), reviewed_by = p_actor_id, stop_reason = p_reason
      WHERE id = p_content_id AND status IN ('pending', 'approved', 'revision_pending') RETURNING school_id INTO v_school_id;
    IF v_school_id IS NOT NULL THEN
      INSERT INTO public.school_partner_notifications (school_id, member_id, event_kind, event_id)
        SELECT school_id, user_id, 'content_stopped', p_content_id FROM public.school_partner_members
        WHERE school_id = v_school_id AND active ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  IF v_school_id IS NULL THEN RAISE EXCEPTION 'content_conflict'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_school_material_request(
  p_request_id uuid, p_action text, p_actor_id uuid, p_scope text
) RETURNS jsonb LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_request public.school_material_requests%ROWTYPE;
  v_school_id uuid;
  v_access_days integer;
BEGIN
  IF p_scope = 'school' THEN
    SELECT school_id INTO v_school_id FROM public.school_partner_members
      WHERE user_id = p_actor_id AND active FOR SHARE;
    IF v_school_id IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
    SELECT * INTO v_request FROM public.school_material_requests
      WHERE id = p_request_id AND school_id = v_school_id AND status IN ('shared', 'acknowledged', 'shipped')
        AND access_until > now() AND NOT is_test FOR UPDATE;
  ELSIF p_scope = 'operator' THEN
    SELECT * INTO v_request FROM public.school_material_requests WHERE id = p_request_id FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'request_not_found';
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;

  IF p_action = 'viewed' THEN
    NULL;
  ELSIF p_scope = 'school' AND p_action = 'acknowledged' AND v_request.status = 'shared' THEN
    UPDATE public.school_material_requests SET status = 'acknowledged', acknowledged_at = now() WHERE id = p_request_id RETURNING * INTO v_request;
  ELSIF p_scope = 'school' AND p_action = 'shipped' AND v_request.status = 'acknowledged' THEN
    UPDATE public.school_material_requests SET status = 'shipped', shipped_at = now() WHERE id = p_request_id RETURNING * INTO v_request;
  ELSIF p_scope = 'operator' AND p_action = 'shared' AND v_request.status IN ('received', 'held') AND NOT v_request.is_test THEN
    SELECT p.access_days INTO v_access_days FROM public.school_partnerships p JOIN public.schools s ON s.id = p.school_id
      WHERE p.school_id = v_request.school_id AND p.recipient_name = v_request.recipient_name
        AND s.status = 'active' AND s.name = v_request.recipient_label
        AND EXISTS (SELECT 1 FROM public.school_partner_members m WHERE m.school_id = p.school_id AND m.active)
      FOR SHARE OF p, s;
    IF NOT FOUND THEN RAISE EXCEPTION 'request_conflict'; END IF;
    UPDATE public.school_material_requests SET status = 'shared', shared_at = now(), access_until = now() + make_interval(days => v_access_days)
      WHERE id = p_request_id RETURNING * INTO v_request;
    INSERT INTO public.school_partner_notifications (school_id, member_id, event_kind, event_id)
      SELECT school_id, user_id, 'request_shared', p_request_id FROM public.school_partner_members
      WHERE school_id = v_request.school_id AND active ON CONFLICT DO NOTHING;
  ELSIF p_scope = 'operator' AND p_action = 'held' AND v_request.status = 'received' THEN
    UPDATE public.school_material_requests SET status = 'held' WHERE id = p_request_id RETURNING * INTO v_request;
  ELSIF p_scope = 'operator' AND p_action = 'cancelled' AND v_request.status IN ('received', 'held', 'shared', 'acknowledged') THEN
    UPDATE public.school_material_requests SET status = 'cancelled' WHERE id = p_request_id RETURNING * INTO v_request;
  ELSE
    RAISE EXCEPTION 'request_conflict';
  END IF;

  INSERT INTO public.school_material_request_events(request_id, action, actor_scope, actor_id)
    VALUES (p_request_id, p_action, p_scope, p_actor_id);
  IF p_scope = 'school' THEN
    RETURN jsonb_build_object('id', v_request.id, 'status', v_request.status, 'shared_at', v_request.shared_at,
      'acknowledged_at', v_request.acknowledged_at, 'shipped_at', v_request.shipped_at,
      'addressee', v_request.addressee, 'postal_code', v_request.postal_code, 'address', v_request.address, 'phone', v_request.phone);
  END IF;
  RETURN to_jsonb(v_request) - 'source_hash' - 'submission_key';
END;
$$;

REVOKE ALL ON FUNCTION public.submit_school_material_request(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text),
  public.submit_school_partner_content(uuid, text, text, text, text, text),
  public.review_school_partner_content(uuid, text, uuid, text), public.process_school_material_request(uuid, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_school_material_request(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text),
  public.submit_school_partner_content(uuid, text, text, text, text, text),
  public.review_school_partner_content(uuid, text, uuid, text), public.process_school_material_request(uuid, text, uuid, text) TO service_role;

COMMIT;
