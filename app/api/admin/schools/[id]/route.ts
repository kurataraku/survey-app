import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 学校を取得（非公開含む）
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('*')
      .eq('id', id)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: '学校が見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json(school);
  } catch (error) {
    console.error('APIエラー:', error);
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
  try {
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;

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

    // 学校名の重複チェック（自分自身を除く）
    const { data: nameConflict } = await supabase
      .from('schools')
      .select('id')
      .eq('name', name)
      .neq('id', id)
      .single();

    if (nameConflict) {
      return NextResponse.json(
        { error: 'この学校名は既に使用されています' },
        { status: 400 }
      );
    }

    // スラッグの重複チェック（自分自身を除く）
    const { data: slugConflict } = await supabase
      .from('schools')
      .select('id')
      .eq('slug', slug)
      .neq('id', id)
      .single();

    if (slugConflict) {
      return NextResponse.json(
        { error: 'このスラッグは既に使用されています' },
        { status: 400 }
      );
    }

    // 学校情報を更新
    const updateData: any = {
      name,
      prefecture,
      prefectures: prefecturesArray,
      slug,
      intro: intro || null,
      highlights: highlights || null,
      faq: faq || null,
      is_public: is_public !== undefined ? is_public : true,
    };

    const { data: school, error: updateError } = await supabase
      .from('schools')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('学校更新エラー:', updateError);
      return NextResponse.json(
        { error: '学校情報の更新に失敗しました', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(school);
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}





