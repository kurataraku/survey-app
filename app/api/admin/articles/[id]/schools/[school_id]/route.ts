import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; school_id: string }> | { id: string; school_id: string } }
) {
  try {
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    const articleId = resolvedParams.id;
    const schoolId = resolvedParams.school_id;

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
    const { display_order, note } = body;

    // 関連付けを更新
    const updateData: any = {};
    if (display_order !== undefined) updateData.display_order = display_order;
    if (note !== undefined) updateData.note = note;

    const { data: articleSchool, error: updateError } = await supabase
      .from('article_schools')
      .update(updateData)
      .eq('article_id', articleId)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (updateError) {
      console.error('関連付け更新エラー:', updateError);
      return NextResponse.json(
        { error: '関連付けの更新に失敗しました', details: updateError.message },
        { status: 500 }
      );
    }

    if (!articleSchool) {
      return NextResponse.json(
        { error: '関連付けが見つかりません' },
        { status: 404 }
      );
    }

    return NextResponse.json(articleSchool);
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
  { params }: { params: Promise<{ id: string; school_id: string }> | { id: string; school_id: string } }
) {
  try {
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    const articleId = resolvedParams.id;
    const schoolId = resolvedParams.school_id;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 関連付けを削除
    const { error: deleteError } = await supabase
      .from('article_schools')
      .delete()
      .eq('article_id', articleId)
      .eq('school_id', schoolId);

    if (deleteError) {
      console.error('関連付け削除エラー:', deleteError);
      return NextResponse.json(
        { error: '関連付けの削除に失敗しました', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

