import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import type { DraftType } from '@/lib/seo-generation/types';

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const supabase = createAdminSupabaseClient();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const draftType = searchParams.get('draft_type');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('seo_drafts')
      .select('*, school:schools!seo_drafts_school_id_fkey(id, name, slug)', {
        count: 'exact',
      });

    if (status) {
      query = query.eq('status', status);
    }
    if (draftType) {
      query = query.eq('draft_type', draftType);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[seo-drafts] GET error:', error);
      return NextResponse.json(
        { error: '下書き一覧の取得に失敗しました', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      drafts: data || [],
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error('[seo-drafts] GET error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const supabase = createAdminSupabaseClient();
    const body = await request.json();
    const { keyword, draft_type, school_id } = body as {
      keyword: string;
      draft_type: DraftType;
      school_id?: string;
    };

    if (!keyword?.trim()) {
      return NextResponse.json(
        { error: 'キーワードは必須です' },
        { status: 400 }
      );
    }

    if (draft_type === 'school' && !school_id) {
      return NextResponse.json(
        { error: '学校別記事の場合、対象学校は必須です' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('seo_drafts')
      .insert({
        keyword: keyword.trim(),
        draft_type: draft_type || 'knowledge',
        school_id: school_id || null,
        status: 'generating',
        current_step: 'plan',
        created_by: authResult.user.email,
      })
      .select()
      .single();

    if (error) {
      console.error('[seo-drafts] POST error:', error);
      return NextResponse.json(
        { error: '下書きの作成に失敗しました', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('[seo-drafts] POST error:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
