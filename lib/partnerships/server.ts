import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminUser } from '@/lib/auth/admin';
import { appPath } from '@/lib/base-path';
import { createAdminSupabaseClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { normalizeSchoolLink, verifiedOfficialLink } from './model';

export const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' };

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: privateHeaders });
}

export function schoolAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SCHOOL_AUTH_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SCHOOL_AUTH_SUPABASE_ANON_KEY;
  if (!url || !anonKey || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  try {
    if (new URL(url).origin === new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin) return null;
    return { url, anonKey };
  } catch {
    return null;
  }
}

export function schoolAuthAdmin() {
  const config = schoolAuthConfig();
  const key = process.env.SCHOOL_AUTH_SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !key) return null;
  return createClient(config.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function schoolAuthServer() {
  const config = schoolAuthConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    },
  });
}

export async function requireSchoolMember() {
  const auth = await schoolAuthServer();
  if (!auth) return json({ error: '学校向け認証の準備中です。' }, 503);
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user?.email || !user.email_confirmed_at) return json({ error: 'ログインしてください。', code: 'login' }, 401);

  const db = createAdminSupabaseClient();
  const { data: member, error: memberError } = await db.from('school_partner_members')
    .select('user_id, school_id, email').eq('user_id', user.id).eq('active', true).maybeSingle();
  if (memberError) return json({ error: '担当者の確認に失敗しました。' }, 503);
  if (!member || member.email !== user.email.toLowerCase()) return json({ error: '学校の閲覧権限がありません。' }, 403);

  const { data: assurance } = await auth.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== 'aal2') return json({ error: '二要素認証を完了してください。', code: 'mfa' }, 403);
  return { db, member: { userId: user.id, schoolId: member.school_id as string } };
}

export async function requirePartnershipOperator(request: NextRequest) {
  const admin = await getAdminUser(request);
  if (!admin || admin.adminUser.email.trim().toLowerCase() !== admin.user.email.trim().toLowerCase()) {
    return json({ error: '運営管理者の権限が必要です。', code: 'login' }, 403);
  }
  const auth = await createServerSupabaseClient();
  const { data: assurance } = await auth.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== 'aal2') return json({ error: '二要素認証を完了してください。', code: 'mfa' }, 403);
  return { db: createAdminSupabaseClient(), actorId: admin.user.id };
}

export function isSameOrigin(request: NextRequest) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const host = new URL(origin).host;
    return host === request.nextUrl.host || host === request.headers.get('host');
  } catch {
    return false;
  }
}

export async function refreshSchool(schoolId: string) {
  const db = createAdminSupabaseClient();
  const { data } = await db.from('schools').select('slug').eq('id', schoolId).maybeSingle();
  if (data?.slug) {
    const path = `/schools/${encodeURIComponent(data.slug)}`;
    revalidatePath(path);
    revalidatePath(appPath(path));
  }
}

export interface PublicPartnership {
  officialUrl: string | null;
  requestEnabled: boolean;
  photo: { id: string; caption: string | null; alt: string } | null;
  message: string | null;
}

export async function getPublicPartnership(schoolId: string): Promise<PublicPartnership | null> {
  const db = createAdminSupabaseClient();
  const base = 'official_link_enabled, request_enabled, content_enabled';
  let loaded = await db.from('school_partnerships').select(`${base}, school_link_url`).eq('school_id', schoolId).maybeSingle();
  // school_link_url の列を追加するマイグレーションが未適用でも、公開ページの提携カードは従来どおり出す
  if (loaded.error) loaded = await db.from('school_partnerships').select(base).eq('school_id', schoolId).maybeSingle() as typeof loaded;
  const settings = loaded.data as { official_link_enabled: boolean; request_enabled: boolean; content_enabled: boolean; school_link_url?: string | null } | null;
  if (!settings) return null;

  // 学校が自校の管理画面で設定したリンクを優先し、無ければ運営が確認した公式URLを使う
  const schoolLink = settings.official_link_enabled ? normalizeSchoolLink(settings.school_link_url) : null;
  const [official, content, members] = await Promise.all([
    settings.official_link_enabled && !schoolLink ? db.from('schools').select('official_url, official_url_verified').eq('id', schoolId).maybeSingle() : null,
    settings.content_enabled ? db.from('school_partner_content').select('id, kind, body, caption, alt').eq('school_id', schoolId).in('status', ['pending', 'approved']) : null,
    settings.request_enabled ? db.from('school_partner_members').select('user_id').eq('school_id', schoolId).eq('active', true).limit(1) : null,
  ]);
  const photo = content?.data?.find((item) => item.kind === 'photo');
  return {
    officialUrl: schoolLink ?? verifiedOfficialLink(official?.data?.official_url, official?.data?.official_url_verified),
    requestEnabled: Boolean(settings.request_enabled && members?.data?.length),
    photo: photo ? { id: photo.id, caption: photo.caption, alt: photo.alt ?? '' } : null,
    message: content?.data?.find((item) => item.kind === 'message')?.body ?? null,
  };
}

export async function getRequestTarget(slug: string) {
  const db = createAdminSupabaseClient();
  const { data: school } = await db.from('schools').select('id, name, slug').eq('slug', slug).eq('status', 'active').maybeSingle();
  if (!school) return null;
  const [settings, members] = await Promise.all([
    db.from('school_partnerships').select('recipient_name').eq('school_id', school.id).eq('request_enabled', true).maybeSingle(),
    db.from('school_partner_members').select('user_id').eq('school_id', school.id).eq('active', true).limit(1),
  ]);
  return settings.data?.recipient_name && members.data?.length
    ? { id: school.id as string, name: school.name as string, slug: school.slug as string, recipient: settings.data.recipient_name as string }
    : null;
}
