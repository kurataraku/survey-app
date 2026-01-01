import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    const articleId = resolvedParams.id;

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
    const { school_id, display_order, note } = body;

    // バリデーション
    if (!school_id) {
      return NextResponse.json(
        { error: 'school_idは必須です' },
        { status: 400 }
      );
    }

    // 記事の存在確認
    const { data: article } = await supabase
      .from('articles')
      .select('id')
      .eq('id', articleId)
      .single();

    if (!article) {
      return NextResponse.json(
        { error: '記事が見つかりません' },
        { status: 404 }
      );
    }

    // 学校の存在確認
    const { data: school } = await supabase
      .from('schools')
      .select('id')
      .eq('id', school_id)
      .single();

    if (!school) {
      return NextResponse.json(
        { error: '学校が見つかりません' },
        { status: 404 }
      );
    }

    // 既存の関連付けをチェック
    const { data: existing } = await supabase
      .from('article_schools')
      .select('id')
      .eq('article_id', articleId)
      .eq('school_id', school_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'この学校は既に記事に紐づけられています' },
        { status: 400 }
      );
    }

    // 関連付けを作成
    const { data: articleSchool, error: insertError } = await supabase
      .from('article_schools')
      .insert({
        article_id: articleId,
        school_id: school_id,
        display_order: display_order || 0,
        note: note || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('学校関連付けエラー:', insertError);
      return NextResponse.json(
        { error: '学校の関連付けに失敗しました', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(articleSchool, { status: 201 });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}



