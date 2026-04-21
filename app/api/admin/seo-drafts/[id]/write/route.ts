import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import { runWriter } from '@/lib/seo-generation/writer';

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
      .select(
        'id, keyword, draft_type, school_id, title, intent, audience, outline_json, tokens_used, school:schools!seo_drafts_school_id_fkey(name)'
      )
      .eq('id', id)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json({ error: '下書きが見つかりません' }, { status: 404 });
    }

    if (!draft.outline_json) {
      return NextResponse.json(
        { error: 'アウトラインが未生成です。先にplanを実行してください' },
        { status: 400 }
      );
    }

    await supabase
      .from('seo_drafts')
      .update({ current_step: 'write', status: 'generating' })
      .eq('id', id);

    const { data: evidence } = await supabase
      .from('seo_draft_evidence')
      .select('*')
      .eq('draft_id', id);

    const schoolRecord = draft.school as unknown as { name: string } | null;

    const result = await runWriter({
      keyword: draft.keyword,
      title: draft.title || draft.keyword,
      intent: draft.intent || '',
      audience: draft.audience || '',
      outline: draft.outline_json,
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
      draftType: draft.draft_type,
      schoolName: schoolRecord?.name,
    });

    const prevTokens = (draft.tokens_used || { openai: 0, perplexity: 0, anthropic: 0 }) as {
      openai: number; perplexity: number; anthropic: number;
    };

    const { error: updateError } = await supabase
      .from('seo_drafts')
      .update({
        body_md: result.bodyMd,
        seo_meta: result.seoMeta,
        current_step: 'write',
        tokens_used: {
          ...prevTokens,
          anthropic: prevTokens.anthropic + result.tokensUsed.total,
        },
      })
      .eq('id', id);

    if (updateError) {
      console.error('[write] update error:', updateError);
      return NextResponse.json(
        { error: '結果の保存に失敗しました', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      title: result.seoMeta.metaTitle,
      bodyLength: result.bodyMd.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Writer実行エラー';
    console.error('[write] error:', error);

    const resolvedParams = params instanceof Promise ? await params : params;
    const supabase = createAdminSupabaseClient();
    await supabase
      .from('seo_drafts')
      .update({ status: 'failed', error_message: message, current_step: 'write' })
      .eq('id', resolvedParams.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
