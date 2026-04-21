import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import { runPlanner } from '@/lib/seo-generation/planner';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;
    const supabase = createAdminSupabaseClient();

    const { data: draft, error: fetchError } = await supabase
      .from('seo_drafts')
      .select('id, keyword, draft_type, school_id, tokens_used, school:schools!seo_drafts_school_id_fkey(name)')
      .eq('id', id)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json({ error: '下書きが見つかりません' }, { status: 404 });
    }

    await supabase
      .from('seo_drafts')
      .update({ current_step: 'plan', status: 'generating' })
      .eq('id', id);

    const schoolRecord = draft.school as unknown as { name: string } | null;

    const result = await runPlanner({
      keyword: draft.keyword,
      draftType: draft.draft_type,
      schoolName: schoolRecord?.name,
    });

    const prevTokens = (draft.tokens_used || { openai: 0, perplexity: 0, anthropic: 0 }) as {
      openai: number; perplexity: number; anthropic: number;
    };

    const { error: updateError } = await supabase
      .from('seo_drafts')
      .update({
        intent: result.intent,
        audience: result.audience,
        title: result.title,
        outline_json: result.outline,
        current_step: 'plan',
        tokens_used: {
          ...prevTokens,
          openai: prevTokens.openai + result.tokensUsed.total,
        },
      })
      .eq('id', id);

    if (updateError) {
      console.error('[plan] update error:', updateError);
      return NextResponse.json(
        { error: '結果の保存に失敗しました', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      title: result.title,
      intent: result.intent,
      outline: result.outline,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Planner実行エラー';
    console.error('[plan] error:', error);

    const resolvedParams = params instanceof Promise ? await params : params;
    const supabase = createAdminSupabaseClient();
    await supabase
      .from('seo_drafts')
      .update({ status: 'failed', error_message: message, current_step: 'plan' })
      .eq('id', resolvedParams.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
