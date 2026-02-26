import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import { callOpenAIForSeoSection, callOpenAIForFaq } from '@/lib/openai/client';
import {
  SEO_SECTION_KEYS,
  FAQ_TOPIC,
  isSeoSectionKey,
} from '@/lib/seo-sections';
import { createHash } from 'crypto';

function sourceSignature(count: number, maxCreatedAt: string | null): string {
  const data = `${count}|${maxCreatedAt || ''}`;
  return createHash('sha256').update(data).digest('hex');
}

/**
 * 指定セクションまたはFAQをGPTで生成し、draftとして保存
 * Body: { section: 'good_bad' | 'tuition' | ... | 'faq' }
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

    const body = await request.json().catch(() => ({}));
    const section = typeof body.section === 'string' ? body.section.trim() : '';
    const validSections = [...SEO_SECTION_KEYS, FAQ_TOPIC];
    if (!section || !validSections.includes(section)) {
      return NextResponse.json(
        {
          error: '不正なセクションです',
          section: body.section,
          valid: validSections,
        },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, name, intro')
      .eq('id', schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: '学校が見つかりません' },
        { status: 404 }
      );
    }

    const { data: reviews = [], error: reviewsError } = await supabase
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

    const officialText = [school.intro].filter(Boolean).join('\n');
    const reviewCount = reviews.length;
    const maxCreatedAt =
      reviews.length > 0
        ? reviews.reduce((max, r) => (r.created_at > max ? r.created_at : max), reviews[0].created_at)
        : null;

    if (section === FAQ_TOPIC) {
      const { items, tokensUsed } = await callOpenAIForFaq(
        school.name,
        reviews.map((r) => ({
          good_comment: r.good_comment || '',
          bad_comment: r.bad_comment || '',
          overall_satisfaction: r.overall_satisfaction ?? 0,
          answers: r.answers,
        })),
        officialText
      );
      const summaryText = JSON.stringify(items);

      const existing = await supabase
        .from('school_ai_summaries')
        .select('id')
        .eq('school_id', schoolId)
        .eq('kind', 'seo')
        .eq('topic', FAQ_TOPIC)
        .eq('status', 'draft')
        .single();

      const row = {
        school_id: schoolId,
        kind: 'seo',
        topic: FAQ_TOPIC,
        status: 'draft',
        summary_text: summaryText,
        meta_title: null,
        meta_description: null,
        reviews_count_used: reviewCount,
        source_signature: sourceSignature(reviewCount, maxCreatedAt),
        generated_at: new Date().toISOString(),
        created_by: authResult.adminUser.id,
      };

      if (existing.data?.id) {
        const { data: updated, error: updateError } = await supabase
          .from('school_ai_summaries')
          .update(row)
          .eq('id', existing.data.id)
          .select()
          .single();
        if (updateError) {
          console.error('FAQ更新エラー:', updateError);
          return NextResponse.json(
            { error: 'FAQの保存に失敗しました' },
            { status: 500 }
          );
        }
        return NextResponse.json({
          summary: updated,
          section: FAQ_TOPIC,
          tokensUsed,
        });
      }

      const { data: inserted, error: insertError } = await supabase
        .from('school_ai_summaries')
        .insert(row)
        .select()
        .single();
      if (insertError) {
        console.error('FAQ作成エラー:', insertError);
        return NextResponse.json(
          { error: 'FAQの保存に失敗しました' },
          { status: 500 }
        );
      }
      return NextResponse.json({
        summary: inserted,
        section: FAQ_TOPIC,
        tokensUsed,
      });
    }

    if (!isSeoSectionKey(section)) {
      return NextResponse.json(
        { error: '不正なセクションです' },
        { status: 400 }
      );
    }

    const { summaryText, tokensUsed } = await callOpenAIForSeoSection(
      school.name,
      section,
      reviews.map((r) => ({
        good_comment: r.good_comment || '',
        bad_comment: r.bad_comment || '',
        overall_satisfaction: r.overall_satisfaction ?? 0,
        answers: r.answers,
      })),
      officialText
    );

    const existing = await supabase
      .from('school_ai_summaries')
      .select('id')
      .eq('school_id', schoolId)
      .eq('kind', 'seo')
      .eq('topic', section)
      .eq('status', 'draft')
      .single();

    const row = {
      school_id: schoolId,
      kind: 'seo',
      topic: section,
      status: 'draft',
      summary_text: summaryText,
      meta_title: null,
      meta_description: null,
      reviews_count_used: reviewCount,
      source_signature: sourceSignature(reviewCount, maxCreatedAt),
      generated_at: new Date().toISOString(),
      created_by: authResult.adminUser.id,
    };

    if (existing.data?.id) {
      const { data: updated, error: updateError } = await supabase
        .from('school_ai_summaries')
        .update(row)
        .eq('id', existing.data.id)
        .select()
        .single();
      if (updateError) {
        console.error('SEOセクション更新エラー:', updateError);
        return NextResponse.json(
          { error: 'セクションの保存に失敗しました' },
          { status: 500 }
        );
      }
      return NextResponse.json({
        summary: updated,
        section,
        tokensUsed,
      });
    }

    const { data: inserted, error: insertError } = await supabase
      .from('school_ai_summaries')
      .insert(row)
      .select()
      .single();
    if (insertError) {
      console.error('SEOセクション作成エラー:', insertError);
      return NextResponse.json(
        { error: 'セクションの保存に失敗しました' },
        { status: 500 }
      );
    }
    return NextResponse.json({
      summary: inserted,
      section,
      tokensUsed,
    });
  } catch (error) {
    console.error('SEOセクション生成APIエラー:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: '生成に失敗しました',
        message: msg,
      },
      { status: 500 }
    );
  }
}
