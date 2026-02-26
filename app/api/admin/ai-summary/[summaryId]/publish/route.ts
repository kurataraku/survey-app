import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';

/**
 * 要約を公開状態に切り替える（トランザクション処理）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ summaryId: string }> | { summaryId: string } }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    const summaryId = resolvedParams.summaryId;

    const supabase = createAdminSupabaseClient();

    // 1. 対象の要約を取得し、存在確認
    const { data: summary, error: summaryError } = await supabase
      .from('school_ai_summaries')
      .select('id, school_id, kind, topic, status')
      .eq('id', summaryId)
      .single();

    if (summaryError || !summary) {
      return NextResponse.json(
        { error: '要約が見つかりません' },
        { status: 404 }
      );
    }

    if (summary.status !== 'draft') {
      return NextResponse.json(
        { error: '公開できるのは下書き状態の要約のみです' },
        { status: 400 }
      );
    }

    // 2. トランザクション処理: 既存のpublishedをdraftに戻し、対象をpublishedにする
    // Supabaseでは直接トランザクションを実行できないため、2つのUPDATEを順次実行
    // 部分ユニークインデックスにより、publishedは1件のみ保証される

    // まず既存のpublishedをdraftに戻す（存在する場合）
    let unpublishQuery = supabase
      .from('school_ai_summaries')
      .update({ status: 'draft' })
      .eq('school_id', summary.school_id)
      .eq('kind', summary.kind || 'overall')
      .eq('status', 'published');
    unpublishQuery =
      summary.topic == null
        ? unpublishQuery.is('topic', null)
        : unpublishQuery.eq('topic', summary.topic);
    const { error: unpublishError } = await unpublishQuery;

    if (unpublishError) {
      console.error('既存公開要約の非公開化エラー:', unpublishError);
      // エラーでも続行（既存のpublishedがない場合もある）
    }

    // 対象をpublishedにする
    const { data: publishedSummary, error: publishError } = await supabase
      .from('school_ai_summaries')
      .update({ status: 'published' })
      .eq('id', summaryId)
      .select()
      .single();

    if (publishError) {
      console.error('要約公開エラー:', publishError);
      // 部分ユニークインデックスの制約違反の可能性
      if (publishError.code === '23505') {
        return NextResponse.json(
          { error: '既に公開済みの要約が存在します。先に非公開にしてください。' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: '要約の公開に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({ summary: publishedSummary });
  } catch (error) {
    console.error('要約公開APIエラー:', error);
    return NextResponse.json(
      {
        error: '要約の公開に失敗しました',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
