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
    const { is_public, answers } = body;

    // 口コミの存在確認
    const { data: existingReview } = await supabase
      .from('survey_responses')
      .select('id, answers')
      .eq('id', id)
      .single();

    if (!existingReview) {
      return NextResponse.json(
        { error: '口コミが見つかりません' },
        { status: 404 }
      );
    }

    // 更新するデータを準備
    const updateData: any = {};

    // answers JSONBの更新
    if (answers !== undefined) {
      // 既存のanswersとマージ（部分更新をサポート）
      const existingAnswers = existingReview.answers || {};
      updateData.answers = { ...existingAnswers, ...answers };
    }

    // 更新データが空の場合はエラー
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '更新するデータが指定されていません' },
        { status: 400 }
      );
    }

    // 口コミを更新
    const { data: review, error: updateError } = await supabase
      .from('survey_responses')
      .update(updateData)
      .eq('id', id)
      .select()
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

export async function DELETE(
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

    // 口コミを削除
    const { error: deleteError } = await supabase
      .from('survey_responses')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('口コミ削除エラー:', deleteError);
      return NextResponse.json(
        { error: '口コミの削除に失敗しました', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '口コミを削除しました',
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}





