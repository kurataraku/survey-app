import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateSlug } from '@/lib/utils';

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
    const category = searchParams.get('category') || '';
    const q = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    // 記事検索クエリを構築（非公開含む）
    let query = supabase
      .from('articles')
      .select('*', { count: 'exact' });

    // カテゴリでのフィルタリング
    if (category && (category === 'interview' || category === 'useful_info')) {
      query = query.eq('category', category);
    }

    // タイトルでの検索
    if (q) {
      query = query.ilike('title', `%${q}%`);
    }

    // ページネーションとソート
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: articles, error, count } = await query;

    if (error) {
      console.error('記事検索エラー:', error);
      return NextResponse.json(
        { error: '記事検索に失敗しました', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      articles: articles || [],
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
      title,
      slug,
      category,
      content,
      excerpt,
      featured_image_url,
      is_public,
      meta_title,
      meta_description,
    } = body;

    // バリデーション
    if (!title || !slug || !category) {
      return NextResponse.json(
        { error: 'タイトル、スラッグ、カテゴリは必須です' },
        { status: 400 }
      );
    }

    if (category !== 'interview' && category !== 'useful_info') {
      return NextResponse.json(
        { error: 'カテゴリはinterviewまたはuseful_infoである必要があります' },
        { status: 400 }
      );
    }

    // スラッグの重複チェック
    const { data: existingArticle } = await supabase
      .from('articles')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingArticle) {
      return NextResponse.json(
        { error: 'このスラッグは既に使用されています' },
        { status: 400 }
      );
    }

    // 公開フラグがtrueの場合、published_atを設定
    const publishedAt = is_public ? new Date().toISOString() : null;

    // 記事を作成
    const { data: article, error: insertError } = await supabase
      .from('articles')
      .insert({
        title,
        slug,
        category,
        content: content || null,
        excerpt: excerpt || null,
        featured_image_url: featured_image_url || null,
        is_public: is_public || false,
        published_at: publishedAt,
        meta_title: meta_title || null,
        meta_description: meta_description || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('記事作成エラー:', insertError);
      return NextResponse.json(
        { error: '記事の作成に失敗しました', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

