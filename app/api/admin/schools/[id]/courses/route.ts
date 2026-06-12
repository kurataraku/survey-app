import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import { sanitizeCourseListingInput } from '@/lib/courses/sanitize';

/**
 * コース一覧の取得（管理画面用）
 * published / 最新draft / 最新rejected を返す
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const schoolId = resolvedParams.id;

    const supabase = createAdminSupabaseClient();
    const { data: rows, error } = await supabase
      .from('school_course_listings')
      .select('*')
      .eq('school_id', schoolId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[courses GET] 取得エラー:', error);
      return NextResponse.json({ error: 'コース一覧の取得に失敗しました' }, { status: 500 });
    }

    const published = rows?.find((r) => r.status === 'published') ?? null;
    const draft = rows?.find((r) => r.status === 'draft') ?? null;
    const rejected = rows?.find((r) => r.status === 'rejected') ?? null;

    return NextResponse.json({ published, draft, rejected });
  } catch (error) {
    console.error('[courses GET] APIエラー:', error);
    return NextResponse.json({ error: 'コース一覧の取得に失敗しました' }, { status: 500 });
  }
}

/**
 * コース一覧のdraft保存（upsert）
 * 既存のdraftがあれば更新、なければ新規作成する。published には触れない。
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const schoolId = resolvedParams.id;
    const body = (await request.json()) as Record<string, unknown>;

    const supabase = createAdminSupabaseClient();

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id')
      .eq('id', schoolId)
      .single();
    if (schoolError || !school) {
      return NextResponse.json({ error: '学校が見つかりません' }, { status: 404 });
    }

    const input = sanitizeCourseListingInput(body);
    const createdBy =
      authResult.adminUser.id !== 'agent' ? authResult.adminUser.id : null;

    const { data: existingDraft } = await supabase
      .from('school_course_listings')
      .select('id')
      .eq('school_id', schoolId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let result;
    if (existingDraft) {
      result = await supabase
        .from('school_course_listings')
        .update({ ...input, origin: 'manual' })
        .eq('id', existingDraft.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('school_course_listings')
        .insert({
          school_id: schoolId,
          ...input,
          origin: 'manual',
          status: 'draft',
          created_by: createdBy,
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error('[courses PUT] 保存エラー:', result.error);
      return NextResponse.json({ error: 'コース一覧の保存に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ draft: result.data });
  } catch (error) {
    console.error('[courses PUT] APIエラー:', error);
    return NextResponse.json({ error: 'コース一覧の保存に失敗しました' }, { status: 500 });
  }
}
