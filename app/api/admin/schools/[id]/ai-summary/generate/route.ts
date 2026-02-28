import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdminOrAgent } from '@/lib/auth/admin';
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
  const authResult = await requireAdminOrAgent(request);
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
    let openAIResult;
    try {
      openAIResult = await callOpenAIForSummary(
        school.name,
        reviews.map((r) => ({
          good_comment: r.good_comment || '',
          bad_comment: r.bad_comment || '',
          overall_satisfaction: r.overall_satisfaction || 0,
        }))
      );
    } catch (openAIError) {
      // エラーの詳細情報を取得
      const errorMessage = openAIError instanceof Error ? openAIError.message : String(openAIError);
      const errorDetails = (openAIError as any)?.errorDetails || {};
      const originalError = (openAIError as any)?.originalError;
      
      // 429エラー（クォータ超過）の場合、より分かりやすいエラーメッセージを返す
      if (errorDetails.status === 429 || errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('billing')) {
        let detailedMsg = 'OpenAI APIの利用制限に達しました。';
        
        // エラーの詳細情報に基づいて追加情報を提供
        if (errorDetails.responseData) {
          detailedMsg += ` エラー詳細: ${JSON.stringify(errorDetails.responseData)}`;
        } else {
          detailedMsg += ` エラーメッセージ: ${errorMessage}`;
        }
        
        detailedMsg += '\n\n以下を確認してください:\n';
        detailedMsg += '1. OpenAIダッシュボード (https://platform.openai.com) でプランと請求設定を確認\n';
        detailedMsg += '2. クレジットカードが正常に登録されているか確認\n';
        detailedMsg += '3. 利用制限（Rate Limits）を確認\n';
        detailedMsg += '4. gpt-4oモデルは有料プランが必要です。プランを確認してください\n';
        detailedMsg += '5. アカウントが一時的に制限されていないか確認';
        
        throw new Error(detailedMsg);
      }
      
      throw openAIError;
    }

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
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // OpenAI API関連のエラーの場合、より具体的なメッセージを返す
    let userFriendlyMessage = '要約の生成に失敗しました';
    if (errorMessage.includes('OPENAI_API_KEY') || errorMessage.includes('環境変数')) {
      userFriendlyMessage = 'OpenAI APIキーが設定されていません。環境変数を確認してください。';
    } else if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('billing')) {
      userFriendlyMessage = 'OpenAI APIの利用制限に達しました。プランと請求設定（クレジットカードの登録状況や残高）を確認してください。';
    } else if (errorMessage.includes('401') || errorMessage.includes('Invalid API key')) {
      userFriendlyMessage = 'OpenAI APIキーが無効です。APIキーを確認してください。';
    }
    
    return NextResponse.json(
      {
        error: userFriendlyMessage,
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
