import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdminOrAgent } from '@/lib/auth/admin';
import { callOpenAIForReviewTendency } from '@/lib/openai/client';
import { createHash } from 'crypto';

function sourceSignature(count: number, maxCreatedAt: string | null): string {
  const data = `${count}|${maxCreatedAt || ''}`;
  return createHash('sha256').update(data).digest('hex');
}

/**
 * 良い点・改善してほしい点の傾向をGPTで生成し、draftとして保存
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdminOrAgent(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const schoolId = resolvedParams.id;

    const supabase = createAdminSupabaseClient();

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, name')
      .eq('id', schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: '学校が見つかりません' },
        { status: 404 }
      );
    }

    const { data: reviewsData, error: reviewsError } = await supabase
      .from('survey_responses')
      .select('id, good_comment, bad_comment, overall_satisfaction, created_at, answers')
      .eq('school_id', schoolId)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(100);

    if (reviewsError) {
      console.error('口コミ取得エラー:', reviewsError);
      return NextResponse.json(
        { error: '口コミの取得に失敗しました' },
        { status: 500 }
      );
    }

    const reviewsList = reviewsData ?? [];
    const reviewCount = reviewsList.length;
    const maxCreatedAt =
      reviewsList.length > 0
        ? reviewsList.reduce((max, r) => (r.created_at > max ? r.created_at : max), reviewsList[0].created_at)
        : null;

    if (reviewCount === 0) {
      return NextResponse.json(
        { error: '口コミが1件もないため要約を生成できません' },
        { status: 400 }
      );
    }

    const { summary, tokensUsed } = await callOpenAIForReviewTendency(
      school.name,
      reviewsList.map((r) => ({
        good_comment: r.good_comment || '',
        bad_comment: r.bad_comment || '',
        overall_satisfaction: r.overall_satisfaction ?? 0,
        answers: r.answers,
      }))
    );

    const summaryText = JSON.stringify(summary);
    const row = {
      school_id: schoolId,
      kind: 'review_tendency' as const,
      topic: null as string | null,
      status: 'draft' as const,
      summary_text: summaryText,
      meta_title: null,
      meta_description: null,
      reviews_count_used: reviewCount,
      source_signature: sourceSignature(reviewCount, maxCreatedAt),
      generated_at: new Date().toISOString(),
      created_by: authResult.adminUser.id,
    };

    const existingDraft = await supabase
      .from('school_ai_summaries')
      .select('id')
      .eq('school_id', schoolId)
      .eq('kind', 'review_tendency')
      .is('topic', null)
      .eq('status', 'draft')
      .maybeSingle();

    if (existingDraft.data?.id) {
      const { error: updateError } = await supabase
        .from('school_ai_summaries')
        .update({
          summary_text: row.summary_text,
          reviews_count_used: row.reviews_count_used,
          source_signature: row.source_signature,
          generated_at: row.generated_at,
          created_by: row.created_by,
        })
        .eq('id', existingDraft.data.id);

      if (updateError) {
        console.error('review_tendency 更新エラー:', updateError);
        return NextResponse.json(
          { error: '下書きの保存に失敗しました' },
          { status: 500 }
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from('school_ai_summaries')
        .insert(row);

      if (insertError) {
        console.error('review_tendency 挿入エラー:', insertError);
        return NextResponse.json(
          { error: '下書きの保存に失敗しました' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      tokensUsed: tokensUsed.total,
    });
  } catch (error) {
    console.error('review-tendency 生成APIエラー:', error);
    return NextResponse.json(
      {
        error: '生成に失敗しました',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
