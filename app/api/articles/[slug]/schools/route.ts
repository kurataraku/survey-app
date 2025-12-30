import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> | { slug: string } }
) {
  try {
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    const slug = resolvedParams.slug;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 記事を取得（公開済みのみ）
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('id')
      .eq('slug', slug)
      .eq('is_public', true)
      .single();

    if (articleError || !article) {
      return NextResponse.json(
        { error: '記事が見つかりません' },
        { status: 404 }
      );
    }

    // 記事に紐づく学校を取得
    const { data: articleSchools, error: schoolsError } = await supabase
      .from('article_schools')
      .select(`
        id,
        article_id,
        school_id,
        display_order,
        note,
        schools (
          id,
          name,
          prefecture,
          slug
        )
      `)
      .eq('article_id', article.id)
      .order('display_order', { ascending: true });

    if (schoolsError) {
      console.error('学校取得エラー:', schoolsError);
      return NextResponse.json(
        { error: '学校の取得に失敗しました', details: schoolsError.message },
        { status: 500 }
      );
    }

    // 学校の集計データを取得
    const schoolsWithStats = await Promise.all(
      (articleSchools || []).map(async (articleSchool: any) => {
        const school = articleSchool.schools;
        if (!school) return null;

        // 口コミ数を取得
        const { count: reviewCount } = await supabase
          .from('survey_responses')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)
          .eq('is_public', true);

        // 平均評価を取得
        const { data: reviews } = await supabase
          .from('survey_responses')
          .select('overall_satisfaction')
          .eq('school_id', school.id)
          .eq('is_public', true)
          .not('overall_satisfaction', 'is', null);

        const overallAvg = reviews && reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.overall_satisfaction, 0) / reviews.length
          : null;

        return {
          id: articleSchool.id,
          article_id: articleSchool.article_id,
          school_id: articleSchool.school_id,
          display_order: articleSchool.display_order,
          note: articleSchool.note,
          school: {
            id: school.id,
            name: school.name,
            prefecture: school.prefecture,
            slug: school.slug,
            review_count: reviewCount || 0,
            overall_avg: overallAvg ? parseFloat(overallAvg.toFixed(2)) : null,
          },
        };
      })
    );

    return NextResponse.json({
      schools: schoolsWithStats.filter(s => s !== null),
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

