import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import { runResearcher } from '@/lib/seo-generation/researcher';

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
      .select('id, keyword, draft_type, school_id, tokens_used')
      .eq('id', id)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json({ error: '下書きが見つかりません' }, { status: 404 });
    }

    await supabase
      .from('seo_drafts')
      .update({ current_step: 'research', status: 'generating' })
      .eq('id', id);

    const result = await runResearcher({
      draftId: id,
      keyword: draft.keyword,
      draftType: draft.draft_type,
      schoolId: draft.school_id || undefined,
    });

    if (result.evidence.length > 0) {
      const rows = result.evidence.map((e) => ({
        draft_id: id,
        kind: e.kind,
        source_id: e.source_id,
        url: e.url,
        title: e.title,
        excerpt: e.excerpt,
        summary: e.summary,
        section_ref: e.section_ref,
        confidence: e.confidence,
      }));

      const { error: insertError } = await supabase
        .from('seo_draft_evidence')
        .insert(rows);

      if (insertError) {
        console.error('[research] evidence insert error:', insertError);
      }
    }

    const prevTokens = (draft.tokens_used || { openai: 0, perplexity: 0, anthropic: 0 }) as {
      openai: number; perplexity: number; anthropic: number;
    };

    await supabase
      .from('seo_drafts')
      .update({
        current_step: 'research',
        tokens_used: {
          ...prevTokens,
          anthropic: prevTokens.anthropic + result.tokensUsed.total,
        },
      })
      .eq('id', id);

    return NextResponse.json({
      evidenceCount: result.evidence.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Researcher実行エラー';
    console.error('[research] error:', error);

    const resolvedParams = params instanceof Promise ? await params : params;
    const supabase = createAdminSupabaseClient();
    await supabase
      .from('seo_drafts')
      .update({ status: 'failed', error_message: message, current_step: 'research' })
      .eq('id', resolvedParams.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
