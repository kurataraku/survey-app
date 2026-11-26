import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { z } from 'zod';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { monthRange, normalizeSchoolLink, photoBucket, schoolLinkError, uuid } from './model';
import { json, privateHeaders, refreshSchool } from './server';

// 学校向け画面のデータ取得と更新。学校担当者（/api/school-portal）と、運営の代理表示
// （/api/admin/partnerships/school-view）の両方から使う。認証と学校の特定は呼び出し側で済ませておく。

type Db = ReturnType<typeof createAdminSupabaseClient>;
export type PortalActor = { scope: 'school' | 'operator'; userId: string };

const requestAction = z.object({ id: uuid, action: z.enum(['viewed', 'acknowledged', 'shipped']) });
const linkAction = z.object({ type: z.literal('official_link'), url: z.string().max(600) });
const messageInput = z.string().trim().min(1).max(300);
const captionInput = z.string().trim().max(120);
const altInput = z.string().trim().min(1).max(120);

export async function portalGet(db: Db, schoolId: string, params: URLSearchParams) {
  const photoId = params.get('photo');
  if (photoId) {
    if (!uuid.safeParse(photoId).success) return json({ error: '写真が見つかりません。' }, 404);
    const { data: photo } = await db.from('school_partner_content').select('photo_path').eq('id', photoId)
      .eq('school_id', schoolId).eq('kind', 'photo').neq('status', 'superseded').maybeSingle();
    if (!photo?.photo_path) return json({ error: '写真が見つかりません。' }, 404);
    const { data: image } = await db.storage.from(photoBucket).download(photo.photo_path);
    if (!image) return json({ error: '写真が見つかりません。' }, 404);
    return new Response(image, { headers: { ...privateHeaders, 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff' } });
  }

  const period = monthRange(params.get('month'));
  const page = Math.min(1000, Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1));
  const offset = (page - 1) * 25;
  const count = (status: string) => db.from('school_material_requests').select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId).eq('status', status).eq('is_test', false).gte('shared_at', period.start).lt('shared_at', period.end);
  const contentBase = 'id, kind, status, body, caption, alt, stop_reason, created_at';
  const [school, settings, list, shared, acknowledged, shipped] = await Promise.all([
    db.from('schools').select('name, slug, status').eq('id', schoolId).single(),
    db.from('school_partnerships').select('content_enabled, request_enabled').eq('school_id', schoolId).maybeSingle(),
    db.from('school_material_requests').select('id, status, shared_at, access_until').eq('school_id', schoolId)
      .eq('is_test', false).in('status', ['shared', 'acknowledged', 'shipped']).gte('shared_at', period.start).lt('shared_at', period.end)
      .order('shared_at', { ascending: false }).order('id').range(offset, offset + 24),
    count('shared'), count('acknowledged'), count('shipped'),
  ]);
  if ([school, settings, list, shared, acknowledged, shipped].some((item) => item.error)) return json({ error: '学校の情報を取得できませんでした。' }, 503);
  if (!settings.data) return json({ error: 'この学校の提携設定がまだありません。' }, 404);
  // 登録者（学校／運営）の列は代理登録のマイグレーションで追加。未適用でも画面は従来どおり出す。
  let content = await db.from('school_partner_content').select(`${contentBase}, submitted_scope`).eq('school_id', schoolId).neq('status', 'superseded');
  if (content.error) content = await db.from('school_partner_content').select(contentBase).eq('school_id', schoolId).neq('status', 'superseded') as typeof content;
  if (content.error) return json({ error: '学校の情報を取得できませんでした。' }, 503);
  const requests = (list.data ?? []).map(({ access_until, ...row }) => ({ ...row, can_view: Date.parse(access_until) > Date.now() }));
  // 公式サイトボタンのリンク先。列が未作成（マイグレーション前）の場合は、この機能だけ使えない状態にする。
  const link = await db.from('school_partnerships').select('school_link_url').eq('school_id', schoolId).single();
  const officialLink = link.error ? null : { url: normalizeSchoolLink(link.data.school_link_url) };
  return json({ school: school.data, settings: settings.data, content: content.data, requests, official_link: officialLink,
    counts: { shared: shared.count ?? 0, acknowledged: acknowledged.count ?? 0, shipped: shipped.count ?? 0 }, month: period.month });
}

async function saveLink(db: Db, schoolId: string, actor: PortalActor, rawUrl: string) {
  const raw = rawUrl.trim();
  const url = raw ? normalizeSchoolLink(raw) : null;
  if (raw && !url) return json({ error: schoolLinkError }, 400);
  const now = new Date().toISOString();
  const changes = { school_link_url: url, school_link_updated_at: now, school_link_updated_by: actor.userId };
  // 学校が保存したら「運営は未確認」に戻して承認一覧に出す。運営が代理で設定したものは確認済みとする。
  const reviewed = { school_link_reviewed_at: actor.scope === 'operator' && url ? now : null };
  // 新しい列が未作成の環境でも保存できるよう、列を減らしながら試す
  const attempts = [{ ...changes, ...reviewed, school_link_updated_scope: actor.scope }, { ...changes, ...reviewed }, changes];
  let saved: { data: unknown; error: unknown } = { data: null, error: true };
  for (const attempt of attempts) {
    saved = await db.from('school_partnerships').update(attempt).eq('school_id', schoolId).select('school_id').maybeSingle();
    if (!saved.error) break;
  }
  if (saved.error || !saved.data) return json({ error: 'リンク先を保存できませんでした。' }, 503);
  await refreshSchool(schoolId);
  return json({ url });
}

async function processRequest(db: Db, schoolId: string, actor: PortalActor, input: z.infer<typeof requestAction>) {
  // 確認済み・発送済みは学校だけが記録できる（運営が押すと「学校が発送した」記録と食い違うため）
  if (actor.scope === 'operator' && input.action !== 'viewed') {
    return json({ error: '確認済み・発送済みの記録は、学校の担当者だけが行えます。' }, 403);
  }
  if (actor.scope === 'operator') {
    // 運営の閲覧は学校を問わず通るので、表示中の学校の請求であることをここで確かめる
    const { data: owner } = await db.from('school_material_requests').select('school_id').eq('id', input.id).maybeSingle();
    if (owner?.school_id !== schoolId) return json({ error: '請求が見つかりません。' }, 404);
  }
  const { data, error } = await db.rpc('process_school_material_request', {
    p_request_id: input.id, p_action: input.action, p_actor_id: actor.userId, p_scope: actor.scope,
  });
  if (error) return error.message === 'request_not_found'
    ? json({ error: '請求が見つからないか、閲覧期限が過ぎています。' }, 404)
    : json({ error: '対応状況が変わりました。ページを再読み込みしてください。' }, 409);
  return json(data);
}

async function saveContent(request: NextRequest, db: Db, schoolId: string, actor: PortalActor) {
  if (actor.scope === 'school') {
    const settings = await db.from('school_partnerships').select('content_enabled').eq('school_id', schoolId).maybeSingle();
    if (settings.error || !settings.data?.content_enabled) return json({ error: '掲載の更新は停止しています。' }, 403);
  }
  const form = await request.formData().catch(() => null);
  const kind = form?.get('kind');
  let body: string | null = null;
  let photoPath: string | null = null;
  let caption: string | null = null;
  let alt: string | null = null;

  if (kind === 'message') {
    const value = messageInput.safeParse(form?.get('body'));
    if (!value.success) return json({ error: 'メッセージを300字以内で入力してください。' }, 400);
    body = value.data;
  } else if (kind === 'photo') {
    const file = form?.get('file');
    const captionValue = captionInput.safeParse(form?.get('caption'));
    const altValue = altInput.safeParse(form?.get('alt'));
    if (!(file instanceof File) || !file.size || file.size > 3 * 1024 * 1024 || !captionValue.success || !altValue.success || form?.get('permission') !== 'on') {
      return json({ error: '3MB以内の画像、画像の説明、掲載許可を確認してください。' }, 400);
    }
    const image = await (async () => {
      try {
        const input = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 20_000_000 });
        const metadata = await input.metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '')) return null;
        return await input.rotate().resize({ width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
      } catch { return null; }
    })();
    if (!image) return json({ error: 'JPEG、PNG、WebPの画像を選んでください。' }, 400);
    photoPath = `${schoolId}/${randomUUID()}.webp`;
    const { error } = await db.storage.from(photoBucket).upload(photoPath, image, { contentType: 'image/webp' });
    if (error) return json({ error: '写真をアップロードできませんでした。' }, 503);
    caption = captionValue.data || null;
    alt = altValue.data;
  } else {
    return json({ error: '掲載する項目が不正です。' }, 400);
  }

  const { data, error } = actor.scope === 'operator'
    ? await db.rpc('submit_school_partner_content_by_operator', {
      p_school_id: schoolId, p_actor_id: actor.userId, p_kind: kind, p_body: body, p_photo_path: photoPath, p_caption: caption, p_alt: alt,
    })
    : await db.rpc('submit_school_partner_content', {
      p_member_id: actor.userId, p_kind: kind, p_body: body, p_photo_path: photoPath, p_caption: caption, p_alt: alt,
    });
  if (error) {
    if (photoPath) await db.storage.from(photoBucket).remove([photoPath]);
    return json({ error: actor.scope === 'operator' && error.code === 'PGRST202'
      ? '代理登録の準備ができていません（データベースの更新が必要です）。'
      : '掲載内容を保存できませんでした。' }, 409);
  }
  await refreshSchool(schoolId);
  return json({ id: data }, 201);
}

export async function portalPost(request: NextRequest, db: Db, schoolId: string, actor: PortalActor) {
  if (request.headers.get('content-type')?.startsWith('multipart/form-data')) return saveContent(request, db, schoolId, actor);
  const body = await request.json().catch(() => null);
  const link = linkAction.safeParse(body);
  if (link.success) return saveLink(db, schoolId, actor, link.data.url);
  const input = requestAction.safeParse(body);
  if (!input.success) return json({ error: '操作が不正です。' }, 400);
  return processRequest(db, schoolId, actor, input.data);
}
