import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import { runVerifier } from '@/lib/seo-generation/verifier';

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
      .select('id, keyword, title, body_md, tokens_used')
      .eq('id', id)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json({ error: '下書きが見つかりません' }, { status: 404 });
    }

    if (!draft.body_md) {
      return NextResponse.json(
        { error: '本文が未生成です。先にwriteを実行してください' },
        { status: 400 }
      );
    }

    await supabase
      .from('seo_drafts')
      .update({ current_step: 'verify', status: 'generating' })
      .eq('id', id);

    const { data: evidence } = await supabase
      .from('seo_draft_evidence')
      .select('*')
      .eq('draft_id', id);

    const result = await runVerifier({
      keyword: draft.keyword,
      title: draft.title || draft.keyword,
      bodyMd: draft.body_md,
      evidence: (evidence || []).map((e) => ({
        kind: e.kind,
        source_id: e.source_id,
        url: e.url,
        title: e.title,
        excerpt: e.excerpt,
        summary: e.summary,
        section_ref: e.section_ref,
        confidence: e.confidence,
      })),
    });

    const prevTokens = (draft.tokens_used || { openai: 0, perplexity: 0, anthropic: 0 }) as {
      openai: number; perplexity: number; anthropic: number;
    };

    const { error: updateError } = await supabase
      .from('seo_drafts')
      .update({
        quality_score: result.qualityScore,
        status: 'draft',
        current_step: null,
        tokens_used: {
          ...prevTokens,
          openai: prevTokens.openai + result.tokensUsed.total,
        },
      })
      .eq('id', id);

    if (updateError) {
      console.error('[verify] update error:', updateError);
      return NextResponse.json(
        { error: '結果の保存に失敗しました', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      qualityScore: result.qualityScore,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verifier実行エラー';
    console.error('[verify] error:', error);

    const resolvedParams = params instanceof Promise ? await params : params;
    const supabase = createAdminSupabaseClient();
    await supabase
      .from('seo_drafts')
      .update({ status: 'failed', error_message: message, current_step: 'verify' })
      .eq('id', resolvedParams.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
