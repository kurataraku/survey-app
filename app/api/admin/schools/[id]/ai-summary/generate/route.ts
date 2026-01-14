import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import { callOpenAIForSummary } from '@/lib/openai/client';
import { createHash } from 'crypto';

/**
 * source_signatureを生成（口コミデータのハッシュ）
 */
function generateSourceSignature(
  count: number,
  maxCreatedAt: string | null,
  avgOverallSatisfaction: number | null
): string {
  const roundedAvg = avgOverallSatisfaction
    ? Math.round(avgOverallSatisfaction * 10) / 10
    : 0;
  const data = `${count}|${maxCreatedAt || ''}|${roundedAvg}`;
  return createHash('sha256').update(data).digest('hex');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    const schoolId = resolvedParams.id;

    const supabase = createAdminSupabaseClient();

    // 1. 学校を取得し、存在確認
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, name, status, is_public')
      .eq('id', schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: '学校が見つかりません' },
        { status: 404 }
      );
    }

    // 2. 口コミを取得（最大100件、publicのみ）
    const { data: reviews, error: reviewsError } = await supabase
      .from('survey_responses')
      .select('id, good_comment, bad_comment, overall_satisfaction, created_at')
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

    if (!reviews || reviews.length === 0) {
      return NextResponse.json(
        { error: '口コミがありません。要約を生成するには口コミが必要です。' },
        { status: 400 }
      );
    }

    // 口コミ件数が少ない場合のチェック（3件未満は拒否）
    if (reviews.length < 3) {
      return NextResponse.json(
        {
          error: '口コミが少なすぎます。要約を生成するには最低3件の口コミが必要です。',
        },
        { status: 400 }
      );
    }

    // 3. source_signatureを算出
    const count = reviews.length;
    const maxCreatedAt =
      reviews.length > 0
        ? reviews.reduce((max, r) => {
            return r.created_at > max ? r.created_at : max;
          }, reviews[0].created_at)
        : null;

    const validSatisfactions = reviews
      .map((r) => r.overall_satisfaction)
      .filter((s): s is number => s !== null && s !== undefined && s >= 1 && s <= 5);

    const avgOverallSatisfaction =
      validSatisfactions.length > 0
        ? validSatisfactions.reduce((sum, s) => sum + s, 0) / validSatisfactions.length
        : null;

    const sourceSignature = generateSourceSignature(
      count,
      maxCreatedAt,
      avgOverallSatisfaction
    );

    // 4. OpenAI APIで要約生成
    const openAIResult = await callOpenAIForSummary(
      school.name,
      reviews.map((r) => ({
        good_comment: r.good_comment || '',
        bad_comment: r.bad_comment || '',
        overall_satisfaction: r.overall_satisfaction || 0,
      }))
    );

    // 5. school_ai_summariesにdraftとして保存
    // 既存のdraftがあるか確認
    const { data: existingDraft } = await supabase
      .from('school_ai_summaries')
      .select('id')
      .eq('school_id', schoolId)
      .eq('kind', 'overall')
      .is('topic', null)
      .eq('status', 'draft')
      .single();

    const summaryData = {
      school_id: schoolId,
      kind: 'overall',
      topic: null,
      status: 'draft',
      summary_text: openAIResult.summaryText,
      meta_title: openAIResult.metaTitle,
      meta_description: openAIResult.metaDescription,
      reviews_count_used: reviews.length,
      source_signature: sourceSignature,
      generated_at: new Date().toISOString(),
      created_by: authResult.adminUser.id,
    };

    let savedSummary;
    if (existingDraft) {
      // 既存のdraftを更新
      const { data, error } = await supabase
        .from('school_ai_summaries')
        .update(summaryData)
        .eq('id', existingDraft.id)
        .select()
        .single();

      if (error) {
        console.error('要約更新エラー:', error);
        return NextResponse.json(
          { error: '要約の保存に失敗しました' },
          { status: 500 }
        );
      }
      savedSummary = data;
    } else {
      // 新規作成
      const { data, error } = await supabase
        .from('school_ai_summaries')
        .insert(summaryData)
        .select()
        .single();

      if (error) {
        console.error('要約作成エラー:', error);
        return NextResponse.json(
          { error: '要約の保存に失敗しました' },
          { status: 500 }
        );
      }
      savedSummary = data;
    }

    return NextResponse.json({
      summary: savedSummary,
      tokensUsed: openAIResult.tokensUsed,
    });
  } catch (error) {
    console.error('要約生成APIエラー:', error);
    return NextResponse.json(
      {
        error: '要約の生成に失敗しました',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
