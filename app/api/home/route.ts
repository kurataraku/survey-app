import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    // パフォーマンス最適化: デバッグログを削減
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[API] /api/home - 環境変数が設定されていません');
      console.error('[API] /api/home - supabaseUrl:', supabaseUrl ? '設定済み' : '未設定');
      console.error('[API] /api/home - supabaseServiceKey:', supabaseServiceKey ? '設定済み' : '未設定');
      return NextResponse.json(
        { 
          topRankedSchools: [],
          popularSchools: [],
          latestReviews: [],
          latestArticles: [],
          error: 'Supabase環境変数が設定されていません' 
        },
        { status: 200 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // パフォーマンス最適化: 並列処理で複数のクエリを同時実行
    // 1. ランキングTOP5を取得（総合満足度）
    // prefectures配列も取得を試みる（マイグレーション未実行時はエラーになる可能性があるため、エラーハンドリングを追加）
    let allSchools: any[] | null = null;
    let schoolsFetchError: any | null = null;
    
    // まずprefecturesを含めて取得を試みる（status='active'のみ）
    const resultWithPrefectures = await supabase
      .from('schools')
      .select('id, name, prefecture, prefectures, slug, status')
      .eq('is_public', true)
      .eq('status', 'active'); // 承認済み（active）のみ
    
    // prefecturesカラムが存在しない場合（エラーコード42703: undefined_column）は、prefectureのみで再試行
    if (resultWithPrefectures.error) {
      const errorCode = resultWithPrefectures.error.code;
      const errorMessage = resultWithPrefectures.error.message || '';
      
      // カラムが存在しないエラーの場合（42703）または、エラーメッセージに"prefectures"が含まれる場合
      const isColumnNotFoundError = errorCode === '42703' 
        || errorMessage.includes('prefectures') 
        || (errorMessage.includes('column') && errorMessage.includes('does not exist'));
      
      if (isColumnNotFoundError) {
        console.warn('[API] /api/home - prefecturesカラムが存在しません。prefectureのみで再試行します。マイグレーションを実行してください。');
        const resultWithoutPrefectures = await supabase
          .from('schools')
          .select('id, name, prefecture, slug')
          .eq('is_public', true)
          .eq('status', 'active'); // 承認済み（active）のみ
        allSchools = resultWithoutPrefectures.data;
        schoolsFetchError = resultWithoutPrefectures.error;
      } else {
        // その他のエラーの場合
        allSchools = resultWithPrefectures.data;
        schoolsFetchError = resultWithPrefectures.error;
      }
    } else {
      // エラーがない場合
      allSchools = resultWithPrefectures.data;
      schoolsFetchError = null;
    }

    if (schoolsFetchError) {
      console.error('[API] /api/home - 学校一覧取得エラー:', schoolsFetchError);
      console.error('[API] /api/home - エラーコード:', schoolsFetchError.code);
      console.error('[API] /api/home - エラーメッセージ:', schoolsFetchError.message);
      console.error('[API] /api/home - エラー詳細:', JSON.stringify(schoolsFetchError, null, 2));
      
      // テーブルが存在しない場合は空配列を返す
      if (schoolsFetchError.code === '42P01' || schoolsFetchError.message?.includes('does not exist') || schoolsFetchError.message?.includes('relation') || schoolsFetchError.message?.includes('table')) {
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
          details: schoolsFetchError.message, 
          code: schoolsFetchError.code,
          hint: schoolsFetchError.code === '42P01' ? 'schoolsテーブルが存在しない可能性があります。Supabaseでテーブルを作成してください。' : undefined
        },
        { status: 500 }
      );
    }

    // パフォーマンス最適化: ログを削減
    
    // パフォーマンス最適化: 並列処理で学校統計と口コミデータを同時取得
    const schoolIds = (allSchools || []).map(s => s.id);
    
    // 並列処理: 学校統計と口コミデータを同時に取得
    const [reviewsStatsResult, reviewsDataResult] = await Promise.all([
      // 学校統計を取得
      schoolIds.length > 0
        ? supabase
            .from('survey_responses')
            .select('school_id, overall_satisfaction')
            .in('school_id', schoolIds)
            .eq('is_public', true)
            .not('school_id', 'is', null)
        : Promise.resolve({ data: [], error: null }),
      
      // 口コミデータを取得（並列実行）
      supabase
        .from('survey_responses')
        .select(`
          id,
          school_id,
          school_name,
          status,
          overall_satisfaction,
          good_comment,
          bad_comment,
          created_at,
          answers
        `)
        .eq('is_public', true)
        .not('school_id', 'is', null)
        .limit(50),
    ]);
    
    const { data: allReviewsStats, error: reviewsStatsError } = reviewsStatsResult;
    const { data: allReviewsData, error: reviewsDataError } = reviewsDataResult;
    
    if (reviewsStatsError) {
      console.warn('[API] /api/home - 口コミ統計取得エラー:', reviewsStatsError);
    }
    
    if (reviewsDataError) {
      console.error('[API] /api/home - 口コミ一覧取得エラー:', reviewsDataError);
    }
    
    // 学校IDごとに集計（最適化版）
    const statsMap = new Map<string, { count: number; sum: number; validCount: number }>();
    
    (allReviewsStats || []).forEach((review: any) => {
      if (!review.school_id) return;
      const schoolId = review.school_id;
      if (!statsMap.has(schoolId)) {
        statsMap.set(schoolId, { count: 0, sum: 0, validCount: 0 });
      }
      const stats = statsMap.get(schoolId)!;
      stats.count++;
      if (review.overall_satisfaction !== null && 
          review.overall_satisfaction !== 6 && 
          review.overall_satisfaction >= 1 && 
          review.overall_satisfaction <= 5) {
        stats.sum += review.overall_satisfaction;
        stats.validCount++;
      }
    });
    
    // 学校データと統計を結合
    const schoolsWithStats = (allSchools || []).map((school) => {
      const prefecturesArray = (school.prefectures && Array.isArray(school.prefectures) && school.prefectures.length > 0) 
        ? school.prefectures 
        : null;
      
      const stats = statsMap.get(school.id) || { count: 0, sum: 0, validCount: 0 };
      const overallAvg = stats.validCount > 0
        ? parseFloat((stats.sum / stats.validCount).toFixed(2))
        : null;
      
      return {
        id: school.id,
        name: school.name,
        prefecture: school.prefecture,
        prefectures: prefecturesArray,
        slug: school.slug,
        review_count: stats.count,
        overall_avg: overallAvg,
      };
    });
    

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

    // 2. 注目の口コミ（いいね数順）3件を取得
    // allReviewsDataは既に並列処理で取得済み
    
    // 最適化: school_idを使用して学校情報を一括取得
    const reviewSchoolIds = [...new Set((allReviewsData || [])
      .map((r: any) => r.school_id)
      .filter((id: any) => id !== null))];
    
    // 学校情報を一括取得（activeのみ）
    const { data: schoolsData, error: schoolsError } = await supabase
      .from('schools')
      .select('id, name, slug, status')
      .in('id', reviewSchoolIds)
      .eq('is_public', true)
      .eq('status', 'active');
    
    // 早期フィルタリング: activeな学校の口コミのみを処理
    const activeSchoolIds = new Set((schoolsData || []).map((s: any) => s.id));
    const activeReviews = (allReviewsData || []).filter((r: any) => 
      r.school_id && activeSchoolIds.has(r.school_id)
    );
    
    if (schoolsError) {
      console.warn('[API] /api/home - 学校情報一括取得エラー:', schoolsError);
    }
    
    // 学校IDをキーとするマップを作成
    const schoolsMap = new Map<string, any>();
    (schoolsData || []).forEach((school: any) => {
      schoolsMap.set(school.id, school);
    });
    
    // 口コミデータに学校情報を結合（activeな学校の口コミのみ）
    const reviewsWithSchools = activeReviews.map((review: any) => {
      const school = review.school_id ? schoolsMap.get(review.school_id) || null : null;
      return {
        ...review,
        school_id: school?.id || review.school_id || null,
        schools: school,
      };
    });
    
    
    // 最適化: 口コミのいいね数を1回のクエリで取得（必要な口コミのみ）
    const reviewIds = reviewsWithSchools.map((r: any) => r.id);
    
    // レビューIDが空の場合はスキップ
    const { data: allLikes, error: likesError } = reviewIds.length > 0
      ? await supabase
          .from('review_likes')
          .select('review_id')
          .in('review_id', reviewIds)
      : { data: [], error: null };
    
    if (likesError) {
      console.warn('[API] /api/home - いいね数一括取得エラー（テーブルが存在しない可能性があります）:', likesError);
    }
    
    // 口コミIDごとによいね数を集計
    const likesMap = new Map<string, number>();
    (allLikes || []).forEach((like: any) => {
      const reviewId = like.review_id;
      likesMap.set(reviewId, (likesMap.get(reviewId) || 0) + 1);
    });
    
    // 各口コミのいいね数を取得（パフォーマンス最適化: 簡易版）
    const reviewsWithLikes = reviewsWithSchools.map((review: any) => {
        const likeCount = likesMap.get(review.id) || 0;
        const school = review.schools;
        
        // answers JSONBから情報を取得（簡易版: 必要な情報のみ）
        let reasonForChoosing: string[] = [];
        let attendanceFrequency: string | null = null;
        let campusPrefecture: string | null = null;
        
        try {
          if (review.answers) {
            const answers = typeof review.answers === 'string' 
              ? JSON.parse(review.answers) 
              : review.answers;
            
            // 必要な情報のみを取得（パフォーマンス向上）
            reasonForChoosing = Array.isArray(answers.reason_for_choosing) 
              ? answers.reason_for_choosing 
              : [];
            attendanceFrequency = answers.attendance_frequency || null;
            
            // campus_prefectureの簡易取得（最初の候補のみチェック）
            if (answers.campus_prefecture) {
              campusPrefecture = Array.isArray(answers.campus_prefecture)
                ? (answers.campus_prefecture[0] || null)
                : String(answers.campus_prefecture).trim() || null;
            }
          }
        } catch (error) {
          // パースエラーは無視（デフォルト値を使用）
        }

        return {
          id: review.id,
          school_id: review.school_id,
          school_name: review.school_name,
          status: review.status,
          overall_satisfaction: review.overall_satisfaction,
          good_comment: review.good_comment,
          bad_comment: review.bad_comment,
          created_at: review.created_at,
          like_count: likeCount,
          reason_for_choosing: reasonForChoosing,
          attendance_frequency: attendanceFrequency,
          campus_prefecture: campusPrefecture,
          schools: school ? {
            id: school.id,
            name: school.name,
            slug: school.slug,
          } : null,
        };
      });
    

    // いいね数順でソートして上位3件を取得
    // 既にactiveな学校の口コミのみが含まれているため、フィルタリング不要
    const latestReviews = reviewsWithLikes
      .sort((a, b) => b.like_count - a.like_count)
      .slice(0, 3);

    // 3. 最新記事3件を取得
    let latestArticles: Array<{
      id: string;
      title: string;
      slug: string;
      excerpt: string | null;
      featured_image_url: string | null;
      published_at: string | null;
      category: 'interview' | 'useful_info';
    }> = [];
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

    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    // パフォーマンスログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('[API] /api/home - 総実行時間:', totalDuration, 'ms');
    }
    
    const responseData = {
      topRankedSchools: rankedSchools || [],
      popularSchools: popularSchools || [],
      latestReviews: latestReviews || [],
      latestArticles: latestArticles || [],
    };
    
    // キャッシュヘッダーを追加（パフォーマンス向上）
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
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
    
    // エラー時でも空のデータを返して、フロントエンドがクラッシュしないようにする
    return NextResponse.json(
      { 
        topRankedSchools: [],
        popularSchools: [],
        latestReviews: [],
        latestArticles: [],
        error: 'サーバーエラーが発生しました',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { 
          name: errorName,
          stack: errorStack,
        })
      },
      { status: 200 } // エラーでも200を返して、フロントエンドが表示できるようにする
    );
  }
}

