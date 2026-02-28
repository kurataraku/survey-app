import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdminOrAgent } from '@/lib/auth/admin';

/**
 * AI要約の下書きを更新
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ summaryId: string }> | { summaryId: string } }
) {
  const authResult = await requireAdminOrAgent(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    const summaryId = resolvedParams.summaryId;

    const supabase = createAdminSupabaseClient();

    const body = await request.json();
    const { summary_text, meta_title, meta_description } = body;

    // 対象の要約を取得し、存在確認
    const { data: summary, error: summaryError } = await supabase
      .from('school_ai_summaries')
      .select('id, status, summary_text, meta_title, meta_description')
      .eq('id', summaryId)
      .single();

    if (summaryError || !summary) {
      return NextResponse.json(
        { error: '要約が見つかりません' },
        { status: 404 }
      );
    }

    // 下書き・公開済みどちらも内容（要約テキスト・メタ）のみ更新可能
    const { data: updatedSummary, error: updateError } = await supabase
      .from('school_ai_summaries')
      .update({
        summary_text: summary_text || summary.summary_text,
        meta_title: meta_title !== undefined ? meta_title : summary.meta_title,
        meta_description:
          meta_description !== undefined ? meta_description : summary.meta_description,
      })
      .eq('id', summaryId)
      .select()
      .single();

    if (updateError) {
      console.error('要約更新エラー:', updateError);
      return NextResponse.json(
        { error: '要約の更新に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ summary: updatedSummary });
  } catch (error) {
    console.error('要約更新APIエラー:', error);
    return NextResponse.json(
      {
        error: '要約の更新に失敗しました',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
