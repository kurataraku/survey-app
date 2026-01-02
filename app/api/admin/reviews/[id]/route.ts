import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const { is_public } = body;

    // バリデーション
    if (typeof is_public !== 'boolean') {
      return NextResponse.json(
        { error: 'is_publicはboolean型である必要があります' },
        { status: 400 }
      );
    }

    // 口コミの存在確認
    const { data: existingReview } = await supabase
      .from('survey_responses')
      .select('id')
      .eq('id', id)
      .single();

    if (!existingReview) {
      return NextResponse.json(
        { error: '口コミが見つかりません' },
        { status: 404 }
      );
    }

    // 口コミのis_publicフラグを更新
    const { data: review, error: updateError } = await supabase
      .from('survey_responses')
      .update({ is_public })
      .eq('id', id)
      .select('id, is_public')
      .single();

    if (updateError) {
      console.error('口コミ更新エラー:', updateError);
      return NextResponse.json(
        { error: '口コミの更新に失敗しました', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      review,
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}




