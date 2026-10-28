import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const authorType = searchParams.get('author_type');
    const moderationStatus = searchParams.get('moderation_status');
    const limit = 20;
    const offset = (page - 1) * limit;

    const filterByModeration =
      moderationStatus === 'pending' ||
      moderationStatus === 'approved' ||
      moderationStatus === 'rejected';
    const surveyJoin = filterByModeration ? 'survey_responses!inner' : 'survey_responses';

    let query = supabase
      .from('contest_entries')
      .select(
        `
        id,
        survey_response_id,
        entry_source,
        author_type,
        pen_name,
        title,
        effort_summary,
        before_enrollment,
        after_enrollment,
        learning_and_change,
        future_goal,
        current_life,
        wants_feedback,
        publication_consent,
        created_at,
        ${surveyJoin} (
          id,
          school_name,
          email,
          respondent_role,
          status,
          overall_satisfaction,
          good_comment,
          bad_comment,
          moderation_status,
          rejection_reason,
          created_at
        )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (authorType === '在校生' || authorType === '卒業生') {
      query = query.eq('author_type', authorType);
    }

    if (filterByModeration) {
      query = query.eq('survey_responses.moderation_status', moderationStatus);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('コンテスト応募一覧取得エラー:', error);
      return NextResponse.json(
        { error: 'コンテスト応募一覧の取得に失敗しました', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        entries: data ?? [],
        total: count ?? 0,
        page,
        limit,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('コンテスト応募一覧APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
