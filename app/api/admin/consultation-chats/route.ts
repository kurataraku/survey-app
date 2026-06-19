import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin';

const LIST_COLUMNS =
  'id, created_at, session_id, source, page_url, user_question, assistant_reply, intent, focus_label, prefecture, model, rag_doc_count, status, is_reviewed, latency_ms';

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
    const status = searchParams.get('status');
    const intent = searchParams.get('intent');
    const isReviewedParam = searchParams.get('is_reviewed');
    const search = searchParams.get('search')?.trim();
    const limit = Math.min(Number.parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200);
    const offset = Math.max(Number.parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);

    let query = supabase
      .from('consultation_chat_logs')
      .select(LIST_COLUMNS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (intent) {
      query = query.eq('intent', intent);
    }
    if (isReviewedParam === 'true' || isReviewedParam === 'false') {
      query = query.eq('is_reviewed', isReviewedParam === 'true');
    }
    if (search) {
      query = query.or(
        `user_question.ilike.%${search}%,assistant_reply.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('相談AIログ一覧取得エラー:', error);
      return NextResponse.json(
        { error: '相談AIログ一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      logs: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
