import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import { callPerplexityForSummary } from '@/lib/perplexity/client';

/**
 * 学校概要（intro）を Perplexity で公式サイト検索して生成
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdmin(request);
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

    const result = await callPerplexityForSummary(school.name);

    return NextResponse.json({
      intro: result.summaryText,
      tokensUsed: result.tokensUsed,
      citations: result.citations,
    });
  } catch (error) {
    console.error('[intro/generate]', error);
    const message = error instanceof Error ? error.message : '概要の生成に失敗しました';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
