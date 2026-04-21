import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;
    const supabase = createAdminSupabaseClient();

    const { data: draft, error: draftError } = await supabase
      .from('seo_drafts')
      .select('*, school:schools!seo_drafts_school_id_fkey(id, name, slug)')
      .eq('id', id)
      .single();

    if (draftError || !draft) {
      return NextResponse.json(
        { error: '下書きが見つかりません' },
        { status: 404 }
      );
    }

    const { data: evidence, error: evidenceError } = await supabase
      .from('seo_draft_evidence')
      .select('*')
      .eq('draft_id', id)
      .order('retrieved_at', { ascending: true });

    if (evidenceError) {
      console.error('[seo-drafts] evidence GET error:', evidenceError);
    }

    return NextResponse.json({
      ...draft,
      evidence: evidence || [],
    });
  } catch (error) {
    console.error('[seo-drafts] GET [id] error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;
    const supabase = createAdminSupabaseClient();
    const body = await request.json();

    const allowedFields = [
      'title',
      'body_md',
      'seo_meta',
      'status',
      'featured_image_url',
    ];
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '更新するフィールドがありません' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('seo_drafts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[seo-drafts] PUT error:', error);
      return NextResponse.json(
        { error: '下書きの更新に失敗しました', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[seo-drafts] PUT error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;
    const supabase = createAdminSupabaseClient();

    const { error } = await supabase
      .from('seo_drafts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[seo-drafts] DELETE error:', error);
      return NextResponse.json(
        { error: '下書きの削除に失敗しました', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[seo-drafts] DELETE error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
