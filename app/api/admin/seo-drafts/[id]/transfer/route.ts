import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import { cleanMdBody, mdToHtml, generateSeoSlug } from '@/lib/seo-generation/transfer-utils';

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
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json(
        { error: '下書きが見つかりません' },
        { status: 404 }
      );
    }

    if (!draft.body_md) {
      return NextResponse.json(
        { error: '本文がない下書きは転送できません' },
        { status: 400 }
      );
    }

    const seoMeta = draft.seo_meta as {
      metaTitle?: string;
      metaDescription?: string;
      excerpt?: string;
      focusKeyword?: string;
      secondaryKeywords?: string[];
    } | null;

    const title = seoMeta?.metaTitle || draft.title || draft.keyword;
    let slug = generateSeoSlug(draft.keyword, title);

    const { data: existingSlug } = await supabase
      .from('articles')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Clean the Markdown body: remove code fences, SEO_META section, trailing artifacts
    const cleanedMd = cleanMdBody(draft.body_md);

    // Remove H1 heading from body since title is stored separately in the articles table
    const bodyWithoutH1 = cleanedMd.replace(/^# .+\n*/m, '');

    // Convert Markdown to HTML for the article content field (RichTextEditor uses HTML)
    const contentHtml = mdToHtml(bodyWithoutH1);

    const excerpt = seoMeta?.excerpt || seoMeta?.metaDescription || null;

    const { data: article, error: insertError } = await supabase
      .from('articles')
      .insert({
        title,
        slug,
        category: 'useful_info',
        content: contentHtml,
        excerpt,
        featured_image_url: draft.featured_image_url || null,
        is_public: false,
        meta_title: seoMeta?.metaTitle || title,
        meta_description: seoMeta?.metaDescription || null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[transfer] article insert error:', insertError);
      return NextResponse.json(
        { error: '記事の作成に失敗しました', details: insertError.message },
        { status: 500 }
      );
    }

    if (draft.draft_type === 'school' && draft.school_id) {
      await supabase.from('article_schools').insert({
        article_id: article.id,
        school_id: draft.school_id,
        display_order: 1,
      });
    }

    await supabase
      .from('seo_drafts')
      .update({ status: 'approved' })
      .eq('id', id);

    return NextResponse.json({
      articleId: article.id,
      slug,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '転送エラー';
    console.error('[transfer] error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
