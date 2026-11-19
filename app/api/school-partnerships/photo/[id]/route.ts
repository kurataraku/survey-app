import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { photoBucket, uuid } from '@/lib/partnerships/model';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return new Response(null, { status: 404 });
  const db = createAdminSupabaseClient();
  const { data: photo } = await db.from('school_partner_content').select('school_id, photo_path').eq('id', id)
    .eq('kind', 'photo').in('status', ['pending', 'approved']).maybeSingle();
  if (!photo?.photo_path) return new Response(null, { status: 404 });
  const [settings, school] = await Promise.all([
    db.from('school_partnerships').select('school_id').eq('school_id', photo.school_id).eq('content_enabled', true).maybeSingle(),
    db.from('schools').select('id').eq('id', photo.school_id).eq('status', 'active').maybeSingle(),
  ]);
  if (!settings.data || !school.data) return new Response(null, { status: 404 });
  const { data } = await db.storage.from(photoBucket).download(photo.photo_path);
  if (!data) return new Response(null, { status: 404 });
  return new Response(data, { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
