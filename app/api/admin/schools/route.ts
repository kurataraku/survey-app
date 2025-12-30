import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
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

    // クエリパラメータを取得
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    // 学校検索クエリを構築（非公開含む）
    let query = supabase
      .from('schools')
      .select('*', { count: 'exact' });

    // 学校名での検索
    if (q) {
      query = query.ilike('name', `%${q}%`);
    }

    // ページネーションとソート
    query = query
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    const { data: schools, error, count } = await query;

    if (error) {
      console.error('学校検索エラー:', error);
      return NextResponse.json(
        { error: '学校検索に失敗しました', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      schools: schools || [],
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

