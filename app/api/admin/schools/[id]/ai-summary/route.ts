import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';

/**
 * 学校のAI要約を取得（draftまたはpublished）
 */
export async function GET(
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

    // draftまたはpublishedの要約を取得（publishedを優先）
    const { data: publishedSummary } = await supabase
      .from('school_ai_summaries')
      .select('*')
      .eq('school_id', schoolId)
      .eq('kind', 'overall')
      .is('topic', null)
      .eq('status', 'published')
      .single();

    if (publishedSummary) {
      return NextResponse.json({ summary: publishedSummary });
    }

    // publishedがない場合はdraftを取得
    const { data: draftSummary } = await supabase
      .from('school_ai_summaries')
      .select('*')
      .eq('school_id', schoolId)
      .eq('kind', 'overall')
      .is('topic', null)
      .eq('status', 'draft')
      .single();

    if (draftSummary) {
      return NextResponse.json({ summary: draftSummary });
    }

    // どちらもない場合は空のレスポンス（404ではなく200で空を返す）
    return NextResponse.json({ summary: null });
  } catch (error) {
    console.error('要約取得APIエラー:', error);
    return NextResponse.json(
      {
        error: '要約の取得に失敗しました',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
