import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import { SEO_SECTION_KEYS, FAQ_TOPIC } from '@/lib/seo-sections';

/**
 * 学校のSEO本文・FAQセクション一覧を取得（draft/published 両方）
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdmin(_request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const schoolId = resolvedParams.id;

    const supabase = createAdminSupabaseClient();

    const { data: rows, error } = await supabase
      .from('school_ai_summaries')
      .select('id, kind, topic, status, summary_text, generated_at')
      .eq('school_id', schoolId)
      .eq('kind', 'seo');

    if (error) {
      console.error('SEOセクション取得エラー:', error);
      return NextResponse.json(
        { error: 'SEOセクションの取得に失敗しました' },
        { status: 500 }
      );
    }

    const sections: Record<string, { id: string; status: string; summary_text: string; generated_at: string | null }> = {};
    for (const key of SEO_SECTION_KEYS) {
      const row = rows?.find((r) => r.topic === key);
      if (row) {
        sections[key] = {
          id: row.id,
          status: row.status,
          summary_text: row.summary_text,
          generated_at: row.generated_at,
        };
      }
    }

    const faqRow = rows?.find((r) => r.topic === FAQ_TOPIC);
    const faq = faqRow
      ? {
          id: faqRow.id,
          status: faqRow.status,
          summary_text: faqRow.summary_text,
          generated_at: faqRow.generated_at,
        }
      : null;

    return NextResponse.json({ sections, faq });
  } catch (error) {
    console.error('SEOセクション一覧APIエラー:', error);
    return NextResponse.json(
      {
        error: 'SEOセクションの取得に失敗しました',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
