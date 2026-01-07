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
    const status = searchParams.get('status') || '';
    const prefecture = searchParams.get('prefecture') || '';
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

    // statusフィルタ
    if (status) {
      query = query.eq('status', status);
    }

    // 都道府県フィルタ
    if (prefecture) {
      query = query.contains('prefectures', [prefecture]);
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

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      name,
      prefecture,
      prefectures,
      slug,
      intro,
      highlights,
      faq,
      is_public,
    } = body;

    // バリデーション
    if (!name || !prefecture || !slug) {
      return NextResponse.json(
        { error: '学校名、都道府県、スラッグは必須です' },
        { status: 400 }
      );
    }

    // prefectures配列を準備（prefecturesが指定されていない場合はprefectureから作成）
    const prefecturesArray = prefectures && Array.isArray(prefectures) && prefectures.length > 0
      ? prefectures
      : [prefecture];

    // 学校名の重複チェック
    const { data: nameConflict } = await supabase
      .from('schools')
      .select('id')
      .eq('name', name)
      .single();

    if (nameConflict) {
      return NextResponse.json(
        { error: 'この学校名は既に使用されています' },
        { status: 400 }
      );
    }

    // スラッグの重複チェック
    const { data: slugConflict } = await supabase
      .from('schools')
      .select('id')
      .eq('slug', slug)
      .single();

    if (slugConflict) {
      return NextResponse.json(
        { error: 'このスラッグは既に使用されています' },
        { status: 400 }
      );
    }

    // 学校情報を作成
    const insertData: any = {
      name,
      prefecture,
      prefectures: prefecturesArray,
      slug,
      intro: intro || null,
      highlights: highlights || null,
      faq: faq || null,
      is_public: is_public !== undefined ? is_public : true,
    };

    const { data: school, error: insertError } = await supabase
      .from('schools')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('学校作成エラー:', insertError);
      return NextResponse.json(
        { error: '学校情報の作成に失敗しました', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(school, { status: 201 });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}




