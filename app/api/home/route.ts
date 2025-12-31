import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. ランキングTOP5を取得（総合満足度）
    const { data: allSchools } = await supabase
      .from('schools')
      .select('id, name, prefecture, slug')
      .eq('is_public', true);

    const schoolsWithStats = await Promise.all(
      (allSchools || []).map(async (school) => {
        const { count: reviewCount } = await supabase
          .from('survey_responses')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)
          .eq('is_public', true);

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
          id: school.id,
          name: school.name,
          prefecture: school.prefecture,
          slug: school.slug,
          review_count: reviewCount || 0,
          overall_avg: overallAvg ? parseFloat(overallAvg.toFixed(2)) : null,
        };
      })
    );

    // 評価順でソート（評価あり、口コミ数3件以上）
    const rankedSchools = schoolsWithStats
      .filter((s) => s.overall_avg !== null && s.review_count >= 3)
      .sort((a, b) => {
        if (a.overall_avg === null) return 1;
        if (b.overall_avg === null) return -1;
        return b.overall_avg - a.overall_avg;
      })
      .slice(0, 5);

    // 口コミ数順TOP5
    const popularSchools = [...schoolsWithStats]
      .filter((s) => s.review_count > 0)
      .sort((a, b) => b.review_count - a.review_count)
      .slice(0, 5);

    // 2. 最新口コミ5件を取得
    const { data: latestReviewsData } = await supabase
      .from('survey_responses')
      .select(`
        id,
        school_id,
        school_name,
        overall_satisfaction,
        good_comment,
        created_at,
        schools(id, name, slug)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(5);

    // 各口コミのいいね数を取得
    const latestReviews = await Promise.all(
      (latestReviewsData || []).map(async (review: any) => {
        const { count: likeCount } = await supabase
          .from('review_likes')
          .select('*', { count: 'exact', head: true })
          .eq('review_id', review.id);

        const school = Array.isArray(review.schools) ? review.schools[0] : review.schools;

        return {
          id: review.id,
          school_id: review.school_id,
          school_name: review.school_name,
          overall_satisfaction: review.overall_satisfaction,
          good_comment: review.good_comment,
          created_at: review.created_at,
          like_count: likeCount || 0,
          schools: school ? {
            id: school.id,
            name: school.name,
            slug: school.slug,
          } : null,
        };
      })
    );

    // 3. 最新記事3件を取得
    const { data: latestArticles } = await supabase
      .from('articles')
      .select('id, title, slug, excerpt, featured_image_url, published_at, category')
      .eq('is_public', true)
      .order('published_at', { ascending: false })
      .limit(3);

    return NextResponse.json({
      topRankedSchools: rankedSchools,
      popularSchools: popularSchools,
      latestReviews: latestReviews || [],
      latestArticles: latestArticles || [],
    });
  } catch (error) {
    console.error('ホームAPIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

