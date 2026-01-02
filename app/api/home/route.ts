import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    console.log('[API] /api/home - リクエスト開始');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[API] /api/home - 環境変数が設定されていません');
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    console.log('[API] /api/home - Supabaseクライアント作成');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. ランキングTOP5を取得（総合満足度）
    console.log('[API] /api/home - 学校一覧を取得中');
    const { data: allSchools, error: schoolsError } = await supabase
      .from('schools')
      .select('id, name, prefecture, slug')
      .eq('is_public', true);

    if (schoolsError) {
      console.error('[API] /api/home - 学校一覧取得エラー:', schoolsError);
      console.error('[API] /api/home - エラーコード:', schoolsError.code);
      console.error('[API] /api/home - エラーメッセージ:', schoolsError.message);
      console.error('[API] /api/home - エラー詳細:', JSON.stringify(schoolsError, null, 2));
      
      // テーブルが存在しない場合は空配列を返す
      if (schoolsError.code === '42P01' || schoolsError.message?.includes('does not exist') || schoolsError.message?.includes('relation') || schoolsError.message?.includes('table')) {
        console.warn('[API] /api/home - schoolsテーブルが存在しないようです。空の結果を返します。');
        return NextResponse.json({
          topRankedSchools: [],
          popularSchools: [],
          latestReviews: [],
          latestArticles: [],
        });
      }
      
      return NextResponse.json(
        { 
          error: '学校一覧の取得に失敗しました', 
          details: schoolsError.message, 
          code: schoolsError.code,
          hint: schoolsError.code === '42P01' ? 'schoolsテーブルが存在しない可能性があります。Supabaseでテーブルを作成してください。' : undefined
        },
        { status: 500 }
      );
    }

    console.log('[API] /api/home - 学校数:', allSchools?.length || 0);

    console.log('[API] /api/home - 学校統計を計算中');
    const schoolsWithStats = await Promise.all(
      (allSchools || []).map(async (school) => {
        try {
          const { count: reviewCount, error: countError } = await supabase
            .from('survey_responses')
            .select('*', { count: 'exact', head: true })
            .eq('school_name', school.name);

          if (countError) {
            console.warn(`[API] /api/home - 口コミ数取得エラー (${school.name}):`, countError);
          }

          const { data: reviews, error: reviewsError } = await supabase
            .from('survey_responses')
            .select('overall_satisfaction')
            .eq('school_name', school.name)
            .not('overall_satisfaction', 'is', null);

          if (reviewsError) {
            console.warn(`[API] /api/home - 評価取得エラー (${school.name}):`, reviewsError);
          }

        // 評価値6（該当なし）を除外し、1-5の範囲のみで平均を計算
        const validRatings = reviews
          ?.filter(r => r.overall_satisfaction !== null && r.overall_satisfaction !== 6 && r.overall_satisfaction >= 1 && r.overall_satisfaction <= 5)
          .map(r => r.overall_satisfaction) || [];

        const overallAvg = validRatings.length > 0
          ? validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length
          : null;

          return {
            id: school.id,
            name: school.name,
            prefecture: school.prefecture,
            slug: school.slug,
            review_count: reviewCount || 0,
            overall_avg: overallAvg ? parseFloat(overallAvg.toFixed(2)) : null,
          };
        } catch (error) {
          console.error(`[API] /api/home - 学校統計計算エラー (${school.name}):`, error);
          return {
            id: school.id,
            name: school.name,
            prefecture: school.prefecture,
            slug: school.slug,
            review_count: 0,
            overall_avg: null,
          };
        }
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

    // 口コミ数順TOP3
    const popularSchools = [...schoolsWithStats]
      .filter((s) => s.review_count > 0)
      .sort((a, b) => b.review_count - a.review_count)
      .slice(0, 3);

    console.log('[API] /api/home - 口コミ一覧を取得中');
    // 2. 注目の口コミ（いいね数順）3件を取得
    const { data: allReviewsData, error: reviewsDataError } = await supabase
      .from('survey_responses')
      .select(`
        id,
        school_name,
        overall_satisfaction,
        good_comment,
        bad_comment,
        created_at
      `);

    if (reviewsDataError) {
      console.error('[API] /api/home - 口コミ一覧取得エラー:', reviewsDataError);
      // エラーが発生しても続行（空配列を返す）
    }

    console.log('[API] /api/home - 口コミ数:', allReviewsData?.length || 0);
    
    // 学校情報を取得するために、school_nameでschoolsテーブルと結合
    const reviewsWithSchools = await Promise.all(
      (allReviewsData || []).map(async (review: any) => {
        let school = null;
        if (review.school_name) {
          const { data: schoolData, error: schoolError } = await supabase
            .from('schools')
            .select('id, name, slug')
            .eq('name', review.school_name)
            .eq('is_public', true)
            .maybeSingle();
          
          // エラーが発生した場合（PGRST116は「行が見つからない」エラーで正常）
          if (schoolError && schoolError.code !== 'PGRST116') {
            console.warn('学校検索エラー:', schoolError);
          } else {
            school = schoolData;
          }
        }
        return {
          ...review,
          school_id: school?.id || null,
          schools: school,
        };
      })
    );

    // 各口コミのいいね数を取得
    const reviewsWithLikes = await Promise.all(
      (reviewsWithSchools || []).map(async (review: any) => {
        let likeCount = 0;
        try {
          const { count, error: likesError } = await supabase
            .from('review_likes')
            .select('*', { count: 'exact', head: true })
            .eq('review_id', review.id);
          
          if (likesError) {
            console.warn('いいね数取得エラー（テーブルが存在しない可能性があります）:', likesError);
            likeCount = 0;
          } else {
            likeCount = count || 0;
          }
        } catch (error) {
          console.warn('いいね数取得でエラーが発生しました:', error);
          likeCount = 0;
        }

        const school = review.schools;

        return {
          id: review.id,
          school_id: review.school_id,
          school_name: review.school_name,
          overall_satisfaction: review.overall_satisfaction,
          good_comment: review.good_comment,
          bad_comment: review.bad_comment,
          created_at: review.created_at,
          like_count: likeCount,
          schools: school ? {
            id: school.id,
            name: school.name,
            slug: school.slug,
          } : null,
        };
      })
    );

    // いいね数順でソートして上位3件を取得
    const latestReviews = reviewsWithLikes
      .sort((a, b) => b.like_count - a.like_count)
      .slice(0, 3);

    // 3. 最新記事3件を取得
    let latestArticles = [];
    try {
      const { data: articlesData, error: articlesError } = await supabase
        .from('articles')
        .select('id, title, slug, excerpt, featured_image_url, published_at, category')
        .eq('is_public', true)
        .order('published_at', { ascending: false })
        .limit(3);
      
      if (articlesError) {
        console.warn('記事取得エラー（テーブルが存在しない可能性があります）:', articlesError);
        latestArticles = [];
      } else {
        latestArticles = articlesData || [];
      }
    } catch (error) {
      console.warn('記事取得でエラーが発生しました:', error);
      latestArticles = [];
    }

    return NextResponse.json({
      topRankedSchools: rankedSchools,
      popularSchools: popularSchools,
      latestReviews: latestReviews || [],
      latestArticles: latestArticles || [],
    });
  } catch (error) {
    console.error('[API] /api/home - エラー発生:', error);
    const errorMessage = error instanceof Error ? error.message : '不明なエラーが発生しました';
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorName = error instanceof Error ? error.constructor.name : typeof error;
    
    console.error('[API] /api/home - エラー詳細:', {
      name: errorName,
      message: errorMessage,
      stack: errorStack,
      error: error
    });
    
    return NextResponse.json(
      { 
        error: 'サーバーエラーが発生しました',
        message: errorMessage,
        name: errorName,
        ...(process.env.NODE_ENV === 'development' && { 
          stack: errorStack,
          fullError: String(error)
        })
      },
      { status: 500 }
    );
  }
}

