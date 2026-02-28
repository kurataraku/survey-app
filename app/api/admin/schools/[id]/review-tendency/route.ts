import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdminOrAgent } from '@/lib/auth/admin';

/** 1件の要約行 */
function toRow(r: { id: string; status: string; summary_text: string; generated_at: string | null; reviews_count_used: number }) {
  return {
    id: r.id,
    status: r.status,
    summary_text: r.summary_text,
    generated_at: r.generated_at,
    reviews_count_used: r.reviews_count_used,
  };
}

/**
 * 学校の「良い点・改善してほしい点の傾向」要約を取得（draft / published 両方）
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdminOrAgent(_request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const schoolId = resolvedParams.id;

    const supabase = createAdminSupabaseClient();

    const { data: rows, error } = await supabase
      .from('school_ai_summaries')
      .select('id, status, summary_text, generated_at, reviews_count_used')
      .eq('school_id', schoolId)
      .eq('kind', 'review_tendency')
      .is('topic', null);

    if (error) {
      console.error('review-tendency 取得エラー:', error);
      return NextResponse.json(
        { error: '良い点・改善点の傾向の取得に失敗しました' },
        { status: 500 }
      );
    }

    const draft = rows?.find((r) => r.status === 'draft');
    const published = rows?.find((r) => r.status === 'published');

    return NextResponse.json({
      draft: draft ? toRow(draft) : null,
      published: published ? toRow(published) : null,
    });
  } catch (error) {
    console.error('review-tendency APIエラー:', error);
    return NextResponse.json(
      {
        error: '取得に失敗しました',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
