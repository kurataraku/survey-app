import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { z } from 'zod';
import { monthRange, normalizeSchoolLink, photoBucket, schoolLinkError, uuid } from '@/lib/partnerships/model';
import { isSameOrigin, json, privateHeaders, refreshSchool, requireSchoolMember } from '@/lib/partnerships/server';

const requestAction = z.object({ id: uuid, action: z.enum(['viewed', 'acknowledged', 'shipped']) });
const linkAction = z.object({ type: z.literal('official_link'), url: z.string().max(600) });
const messageInput = z.string().trim().min(1).max(300);
const captionInput = z.string().trim().max(120);
const altInput = z.string().trim().min(1).max(120);

export async function GET(request: NextRequest) {
  const auth = await requireSchoolMember();
  if (auth instanceof NextResponse) return auth;
  const { db, member } = auth;
  const params = request.nextUrl.searchParams;
  const photoId = params.get('photo');
  if (photoId) {
    if (!uuid.safeParse(photoId).success) return json({ error: '写真が見つかりません。' }, 404);
    const { data: photo } = await db.from('school_partner_content').select('photo_path').eq('id', photoId)
      .eq('school_id', member.schoolId).eq('kind', 'photo').neq('status', 'superseded').maybeSingle();
    if (!photo?.photo_path) return json({ error: '写真が見つかりません。' }, 404);
    const { data: image } = await db.storage.from(photoBucket).download(photo.photo_path);
    if (!image) return json({ error: '写真が見つかりません。' }, 404);
    return new Response(image, { headers: { ...privateHeaders, 'Content-Type': 'image/webp', 'X-Content-Type-Options': 'nosniff' } });
  }

  const period = monthRange(params.get('month'));
  const page = Math.min(1000, Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1));
  const offset = (page - 1) * 25;
  const count = (status: string) => db.from('school_material_requests').select('id', { count: 'exact', head: true })
    .eq('school_id', member.schoolId).eq('status', status).eq('is_test', false).gte('shared_at', period.start).lt('shared_at', period.end);
  const [school, settings, content, list, shared, acknowledged, shipped] = await Promise.all([
    db.from('schools').select('name, slug, status').eq('id', member.schoolId).single(),
    db.from('school_partnerships').select('content_enabled, request_enabled').eq('school_id', member.schoolId).single(),
    db.from('school_partner_content').select('id, kind, status, body, caption, alt, stop_reason, created_at').eq('school_id', member.schoolId).neq('status', 'superseded'),
    db.from('school_material_requests').select('id, status, shared_at, access_until').eq('school_id', member.schoolId)
      .eq('is_test', false).in('status', ['shared', 'acknowledged', 'shipped']).gte('shared_at', period.start).lt('shared_at', period.end)
      .order('shared_at', { ascending: false }).order('id').range(offset, offset + 24),
    count('shared'), count('acknowledged'), count('shipped'),
  ]);
  if ([school, settings, content, list, shared, acknowledged, shipped].some((item) => item.error)) return json({ error: '学校の情報を取得できませんでした。' }, 503);
  const requests = (list.data ?? []).map(({ access_until, ...row }) => ({ ...row, can_view: Date.parse(access_until) > Date.now() }));
  // 公式サイトボタンのリンク先。列が未作成（マイグレーション前）の場合は、この機能だけ使えない状態にする。
  const link = await db.from('school_partnerships').select('school_link_url').eq('school_id', member.schoolId).single();
  const officialLink = link.error ? null : { url: normalizeSchoolLink(link.data.school_link_url) };
  return json({ school: school.data, settings: settings.data, content: content.data, requests, official_link: officialLink,
    counts: { shared: shared.count ?? 0, acknowledged: acknowledged.count ?? 0, shipped: shipped.count ?? 0 }, month: period.month });
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: '送信元を確認できません。' }, 403);
  const auth = await requireSchoolMember();
  if (auth instanceof NextResponse) return auth;
  const { db, member } = auth;
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data')) {
    const body = await request.json().catch(() => null);
    const link = linkAction.safeParse(body);
    if (link.success) {
      // 公式サイトボタンのリンク先。空欄で送ると設定を外す（運営が確認した公式URLに戻る）。
      const raw = link.data.url.trim();
      const url = raw ? normalizeSchoolLink(raw) : null;
      if (raw && !url) return json({ error: schoolLinkError }, 400);
      const changes = { school_link_url: url, school_link_updated_at: new Date().toISOString(), school_link_updated_by: member.userId };
      // 保存のたびに「運営は未確認」に戻す（承認一覧に出る）。確認用の列が未作成の環境では、リンクの保存だけ行う。
      let saved = await db.from('school_partnerships').update({ ...changes, school_link_reviewed_at: null }).eq('school_id', member.schoolId).select('school_id').maybeSingle();
      if (saved.error) saved = await db.from('school_partnerships').update(changes).eq('school_id', member.schoolId).select('school_id').maybeSingle();
      if (saved.error || !saved.data) return json({ error: 'リンク先を保存できませんでした。' }, 503);
      await refreshSchool(member.schoolId);
      return json({ url });
    }
    const input = requestAction.safeParse(body);
    if (!input.success) return json({ error: '操作が不正です。' }, 400);
    const { data, error } = await db.rpc('process_school_material_request', {
      p_request_id: input.data.id, p_action: input.data.action, p_actor_id: member.userId, p_scope: 'school',
    });
    if (error) return error.message === 'request_not_found'
      ? json({ error: '請求が見つからないか、閲覧期限が過ぎています。' }, 404)
      : json({ error: '対応状況が変わりました。ページを再読み込みしてください。' }, 409);
    return json(data);
  }

  const settings = await db.from('school_partnerships').select('content_enabled').eq('school_id', member.schoolId).maybeSingle();
  if (settings.error || !settings.data?.content_enabled) return json({ error: '掲載の更新は停止しています。' }, 403);
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
    photoPath = `${member.schoolId}/${randomUUID()}.webp`;
    const { error } = await db.storage.from(photoBucket).upload(photoPath, image, { contentType: 'image/webp' });
    if (error) return json({ error: '写真をアップロードできませんでした。' }, 503);
    caption = captionValue.data || null;
    alt = altValue.data;
  } else {
    return json({ error: '掲載する項目が不正です。' }, 400);
  }

  const { data, error } = await db.rpc('submit_school_partner_content', {
    p_member_id: member.userId, p_kind: kind, p_body: body, p_photo_path: photoPath, p_caption: caption, p_alt: alt,
  });
  if (error) {
    if (photoPath && (error.message === 'content_unavailable' || error.code === '23514')) {
      await db.storage.from(photoBucket).remove([photoPath]);
    }
    return json({ error: '掲載内容を保存できませんでした。' }, 409);
  }
  await refreshSchool(member.schoolId);
  return json({ id: data }, 201);
}
