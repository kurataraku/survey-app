import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPartnershipTraffic } from '@/lib/partnerships/analytics';
import { defaultSettings, email, monthRange, normalizeSchoolLink, photoBucket, settingsSchema, uuid, verifiedOfficialLink } from '@/lib/partnerships/model';
import { sendQueuedSchoolNotifications, sendSchoolInvitation } from '@/lib/partnerships/notifications';
import { isSameOrigin, json, privateHeaders, refreshSchool, requirePartnershipOperator, schoolAuthAdmin } from '@/lib/partnerships/server';

const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('settings'), schoolId: uuid, settings: settingsSchema }),
  z.object({ type: z.literal('invite'), schoolId: uuid, email }),
  z.object({ type: z.literal('disable_member'), schoolId: uuid, userId: uuid }),
  z.object({ type: z.literal('request'), id: uuid, action: z.enum(['viewed', 'shared', 'held', 'cancelled']) }),
  z.object({ type: z.literal('content'), id: uuid, action: z.enum(['approve', 'stop']), reason: z.string().trim().max(600).optional() }),
  z.object({ type: z.literal('retry'), id: uuid, kind: z.enum(['request_shared', 'content_stopped']) }),
  z.object({ type: z.literal('clear_school_link'), schoolId: uuid }),
]);

// school_partner_content / school_partner_notifications は schools への外部キーを持たず、
// school_partnerships 経由でしか辿れない。画面側の形（schools: { name }）に揃えて返す。
type EmbeddedSchool = { name: string | null } | { name: string | null }[] | null;
type LinkedRow = { school_partnerships?: { schools: EmbeddedSchool } | { schools: EmbeddedSchool }[] | null };

function withSchoolName<T extends LinkedRow>(rows: T[] | null) {
  return (rows ?? []).map((row) => {
    const { school_partnerships: link, ...rest } = row;
    const node = Array.isArray(link) ? link[0] : link;
    const related = node?.schools ?? null;
    return { ...rest, schools: Array.isArray(related) ? related[0] ?? null : related };
  });
}

export async function GET(request: NextRequest) {
  const auth = await requirePartnershipOperator(request);
  if (auth instanceof NextResponse) return auth;
  const { db } = auth;
  const params = request.nextUrl.searchParams;
  const schoolId = params.get('school');
  const view = params.get('view');
  const period = monthRange(params.get('month'));
  const page = Math.min(1000, Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1));
  const offset = (page - 1) * 25;
  if (schoolId && !uuid.safeParse(schoolId).success) return json({ error: '学校を選び直してください。' }, 400);

  if (view === 'photo') {
    const id = params.get('id');
    if (!uuid.safeParse(id).success) return json({ error: '写真が見つかりません。' }, 404);
    const { data: photo } = await db.from('school_partner_content').select('photo_path').eq('id', id).eq('kind', 'photo').maybeSingle();
    if (!photo?.photo_path) return json({ error: '写真が見つかりません。' }, 404);
    const { data: image } = await db.storage.from(photoBucket).download(photo.photo_path);
    return image ? new Response(image, { headers: { ...privateHeaders, 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff' } }) : json({ error: '写真が見つかりません。' }, 404);
  }

  if (view === 'report' && schoolId) {
    const [school, aliases] = await Promise.all([
      db.from('schools').select('slug').eq('id', schoolId).maybeSingle(),
      db.from('school_slug_history').select('old_slug').eq('school_id', schoolId).limit(40),
    ]);
    if (!school.data?.slug) return json({ error: '学校が見つかりません。' }, 404);
    const count = (field: 'created_at' | 'shared_at' | 'shipped_at') => db.from('school_material_requests').select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId).eq('is_test', false).neq('status', 'cancelled').gte(field, period.start).lt(field, period.end);
    const [traffic, received, shared, shipped] = await Promise.all([
      getPartnershipTraffic([school.data.slug, ...(aliases.data ?? []).map((row) => row.old_slug)], period.startDate, period.endDate),
      count('created_at'), count('shared_at'), count('shipped_at'),
    ]);
    if (received.error || shared.error || shipped.error) return json({ error: '請求の集計に失敗しました。' }, 503);
    return json({ traffic, received: received.count, shared: shared.count, shipped: shipped.count, month: period.month });
  }

  // 「送信済み」はResendが受け付けたという意味しかないので、実際に届かなかったものを別で示す
  let deliveries = db.from('email_deliveries').select('id, kind, ref_id, school_id, recipient, status, detail, created_at, schools(name)');
  let requests = db.from('school_material_requests').select('id, school_id, recipient_label, status, created_at, shared_at', { count: 'exact' });
  let content = db.from('school_partner_content').select('id, school_id, kind, status, body, caption, alt, stop_reason, created_at, school_partnerships(schools(name))');
  if (schoolId) {
    requests = requests.eq('school_id', schoolId);
    content = content.eq('school_id', schoolId);
    deliveries = deliveries.eq('school_id', schoolId);
  } else {
    requests = requests.in('status', ['received', 'held']);
    content = content.in('status', ['pending', 'revision_pending']);
  }
  const [list, posts, schools, school, settings, members, notices, undelivered, schoolLink] = await Promise.all([
    requests.order('created_at', { ascending: false }).order('id').range(offset, offset + 24),
    content.neq('status', 'superseded').order('created_at', { ascending: true }).limit(40),
    db.from('school_partnerships').select('school_id, schools(name, slug)').limit(300),
    schoolId ? db.from('schools').select('id, name, slug, status, official_url, official_url_verified').eq('id', schoolId).maybeSingle() : null,
    schoolId ? db.from('school_partnerships').select('official_link_enabled, request_enabled, content_enabled, recipient_name, access_days').eq('school_id', schoolId).maybeSingle() : null,
    schoolId ? db.from('school_partner_members').select('user_id, email, active').eq('school_id', schoolId).order('created_at') : null,
    db.from('school_partner_notifications').select('event_kind, event_id, school_id, school_partnerships(schools(name))').in('status', ['pending', 'failed', 'sending'])
      .order('created_at', { ascending: false }).limit(60),
    deliveries.in('status', ['bounced', 'complained', 'unknown']).order('created_at', { ascending: false }).limit(40),
    schoolId ? db.from('school_partnerships').select('school_link_url, school_link_updated_at').eq('school_id', schoolId).maybeSingle() : null,
  ]);
  if ([list, posts, schools, school, settings, members, notices].some((item) => item?.error)) return json({ error: '提携情報を取得できませんでした。データベースの設定をご確認ください。' }, 503);
  // email_deliveries は未適用でも画面全体を落とさない（マイグレーション前でも従来どおり使える）
  if (schoolId && !school?.data) return json({ error: '学校が見つかりません。' }, 404);
  return json({ requests: list.data, requestCount: list.count, content: withSchoolName(posts.data), schools: schools.data, school: school?.data ?? null,
    settings: settings?.data ?? defaultSettings, members: members?.data ?? [], notices: withSchoolName(notices.data), undelivered: undelivered.error ? [] : (undelivered.data ?? []),
    // 学校が自校の管理画面で設定したリンク（列が未作成のときは出さない）
    schoolLink: schoolLink?.error ? null : (schoolLink?.data ?? null), month: period.month, schoolAuthReady: Boolean(schoolAuthAdmin()) });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: '送信元を確認できません。' }, 403);
  const auth = await requirePartnershipOperator(request);
  if (auth instanceof NextResponse) return auth;
  const { db, actorId } = auth;
  const input = actionSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return json({ error: '入力内容を確認してください。' }, 400);
  const action = input.data;

  if (action.type === 'settings') {
    const { data: school } = await db.from('schools').select('status, official_url, official_url_verified').eq('id', action.schoolId).maybeSingle();
    if (!school) return json({ error: '学校が見つかりません。' }, 404);
    if (action.settings.official_link_enabled && !verifiedOfficialLink(school.official_url, school.official_url_verified)) {
      // 学校が自校の管理画面でリンクを設定していれば、運営の公式URLが未確認でも表示できる
      const own = await db.from('school_partnerships').select('school_link_url').eq('school_id', action.schoolId).maybeSingle();
      if (!normalizeSchoolLink(own.data?.school_link_url)) {
        return json({ error: '学校編集画面で公式サイトURLを確認・保存してから公開してください。' }, 409);
      }
    }
    if (action.settings.request_enabled) {
      const { data: member } = await db.from('school_partner_members').select('user_id').eq('school_id', action.schoolId).eq('active', true).limit(1);
      if (!schoolAuthAdmin() || school.status !== 'active' || !action.settings.recipient_name || !member?.length) {
        return json({ error: '公開中の学校、運営法人名、学校担当者の登録、学校向け認証の設定を確認してください。' }, 409);
      }
    }
    const { error } = await db.from('school_partnerships').upsert({ school_id: action.schoolId, ...action.settings, updated_at: new Date().toISOString() });
    if (error) return json({ error: '設定を保存できませんでした。' }, 503);
    await refreshSchool(action.schoolId);
    return json({ ok: true });
  }

  if (action.type === 'clear_school_link') {
    // 学校が設定したリンクに問題があるとき、運営が外す（外すと運営が確認した公式URLに戻る）
    const { data, error } = await db.from('school_partnerships').update({ school_link_url: null, school_link_updated_at: new Date().toISOString(), school_link_updated_by: actorId })
      .eq('school_id', action.schoolId).select('school_id').maybeSingle();
    if (error || !data) return json({ error: 'リンクを外せませんでした。' }, 503);
    await refreshSchool(action.schoolId);
    return json({ ok: true });
  }

  if (action.type === 'invite') {
    const externalAuth = schoolAuthAdmin();
    if (!externalAuth) return json({ error: '学校向けの認証プロジェクトを設定してください。' }, 503);
    const [school, existing] = await Promise.all([
      db.from('schools').select('name').eq('id', action.schoolId).eq('status', 'active').maybeSingle(),
      db.from('school_partner_members').select('school_id, user_id').eq('email', action.email).maybeSingle(),
    ]);
    if (school.error || existing.error) return json({ error: '担当者の登録状況を取得できませんでした。' }, 503);
    if (!school.data) return json({ error: '公開中の学校を選んでください。' }, 404);
    if (existing.data && existing.data.school_id !== action.schoolId) return json({ error: 'このメールは別の学校に登録されています。' }, 409);
    const { error: settingsError } = await db.from('school_partnerships').upsert({ school_id: action.schoolId }, { onConflict: 'school_id', ignoreDuplicates: true });
    if (settingsError) return json({ error: '提携設定を作成できませんでした。' }, 503);

    let memberId = existing.data?.user_id;
    if (!memberId) {
      const { data, error } = await externalAuth.auth.admin.createUser({ email: action.email, email_confirm: true }) // 運営が学校から受け取った業務用アドレスなので確認済みで作る。
      // 未確認のままだと、初回ログインのコード送信が新規登録とみなされ、新規登録オフの設定に弾かれる（signup_disabled）。;
      if (error || !data.user) return json({ error: '学校アカウントを登録できませんでした。認証プロジェクトの登録状況をご確認ください。' }, 409);
      memberId = data.user.id;
      const { error: insertError } = await db.from('school_partner_members').insert({ user_id: memberId, school_id: action.schoolId, email: action.email });
      if (insertError) {
        const { data: saved, error: lookupError } = await db.from('school_partner_members').select('user_id').eq('user_id', memberId).maybeSingle();
        if (!lookupError && !saved) await externalAuth.auth.admin.deleteUser(memberId);
        return json({ error: '学校と担当者を紐づけられませんでした。' }, 503);
      }
    } else {
      const { error } = await db.from('school_partner_members').update({ active: true }).eq('user_id', memberId).eq('school_id', action.schoolId);
      if (error) return json({ error: '担当者を有効化できませんでした。' }, 503);
    }
    const notified = await sendSchoolInvitation(db, action.email, school.data.name, action.schoolId, memberId);
    return json({ ok: true, notified });
  }

  if (action.type === 'disable_member') {
    const { error } = await db.from('school_partner_members').update({ active: false }).eq('user_id', action.userId).eq('school_id', action.schoolId);
    if (error) return json({ error: '担当者を停止できませんでした。' }, 503);
    await refreshSchool(action.schoolId);
    return json({ ok: true });
  }

  if (action.type === 'request') {
    const { data, error } = await db.rpc('process_school_material_request', { p_request_id: action.id, p_action: action.action, p_actor_id: actorId, p_scope: 'operator' });
    if (error) return json({ error: '請求の状態または提供先を確認してください。' }, 409);
    if (action.action === 'viewed') return json(data);
    const notified = action.action === 'shared' ? await sendQueuedSchoolNotifications(db, 'request_shared', action.id) : true;
    return json({ ok: true, notified });
  }

  if (action.type === 'content') {
    if (action.action === 'stop' && !action.reason) return json({ error: '掲載停止の理由を入力してください。' }, 400);
    const { data: item } = await db.from('school_partner_content').select('school_id').eq('id', action.id).maybeSingle();
    if (!item) return json({ error: '掲載内容が見つかりません。' }, 404);
    const { error } = await db.rpc('review_school_partner_content', { p_content_id: action.id, p_action: action.action, p_actor_id: actorId, p_reason: action.reason ?? null });
    if (error) return json({ error: '掲載内容が更新されています。確認し直してください。' }, 409);
    await refreshSchool(item.school_id);
    const notified = action.action === 'stop' ? await sendQueuedSchoolNotifications(db, 'content_stopped', action.id) : true;
    return json({ ok: true, notified });
  }

  return json({ ok: true, notified: await sendQueuedSchoolNotifications(db, action.kind, action.id) });
}
