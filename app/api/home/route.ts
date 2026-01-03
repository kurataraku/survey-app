import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    console.log('[API] /api/home - リクエスト開始');
    console.log('[API] /api/home - タイムスタンプ:', new Date().toISOString());
    
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

    console.log('[API] /api/home - Supabaseクライアント作成');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. ランキングTOP5を取得（総合満足度）
    console.log('[API] /api/home - 学校一覧を取得中');
    // prefectures配列も取得を試みる（マイグレーション未実行時はエラーになる可能性があるため、エラーハンドリングを追加）
    let allSchools: any[] | null = null;
    let schoolsError: any = null;
    
    // まずprefecturesを含めて取得を試みる
    const resultWithPrefectures = await supabase
      .from('schools')
      .select('id, name, prefecture, prefectures, slug')
      .eq('is_public', true);
    
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
          .eq('is_public', true);
        allSchools = resultWithoutPrefectures.data;
        schoolsError = resultWithoutPrefectures.error;
      } else {
        // その他のエラーの場合
        allSchools = resultWithPrefectures.data;
        schoolsError = resultWithPrefectures.error;
      }
    } else {
      // エラーがない場合
      allSchools = resultWithPrefectures.data;
      schoolsError = null;
    }

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

          const prefecturesArray = (school.prefectures && Array.isArray(school.prefectures) && school.prefectures.length > 0) 
            ? school.prefectures 
            : null;
          
          // デバッグログ（N高の場合のみ）
          if (school.name === 'N高') {
            console.log(`[API] /api/home - N高のprefectures:`, school.prefectures);
            console.log(`[API] /api/home - N高のprefecturesArray:`, prefecturesArray);
            console.log(`[API] /api/home - N高のprefecture:`, school.prefecture);
          }
          
          return {
            id: school.id,
            name: school.name,
            prefecture: school.prefecture,
            prefectures: prefecturesArray,
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
            prefectures: (school.prefectures && Array.isArray(school.prefectures) && school.prefectures.length > 0) ? school.prefectures : null, // マイグレーション未実行時はnull
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
        status,
        overall_satisfaction,
        good_comment,
        bad_comment,
        created_at,
        answers
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
        
        // answers JSONBから情報を取得
        let answers: any = {};
        try {
          if (review.answers) {
            answers = typeof review.answers === 'string' ? JSON.parse(review.answers) : review.answers;
          }
        } catch (error) {
          console.warn('answersパースエラー:', error);
          answers = {};
        }

        // campus_prefectureを取得（配列または単一の値に対応、後方互換性のため）
        let campusPrefecture: string | null = null;
        
        // まず、既知のキー名をチェック（優先順位順）
        if (answers.campus_prefecture) {
          if (Array.isArray(answers.campus_prefecture)) {
            // 配列の場合は最初の要素を使用（後方互換性）
            campusPrefecture = answers.campus_prefecture.length > 0 
              ? String(answers.campus_prefecture[0]).trim() 
              : null;
          } else if (String(answers.campus_prefecture).trim() !== '') {
            campusPrefecture = String(answers.campus_prefecture).trim();
          }
        } else if (answers.campusPrefecture) {
          if (Array.isArray(answers.campusPrefecture)) {
            campusPrefecture = answers.campusPrefecture.length > 0 
              ? String(answers.campusPrefecture[0]).trim() 
              : null;
          } else if (String(answers.campusPrefecture).trim() !== '') {
            campusPrefecture = String(answers.campusPrefecture).trim();
          }
        } else if (answers['主に通っていたキャンパス']) {
          if (Array.isArray(answers['主に通っていたキャンパス'])) {
            campusPrefecture = answers['主に通っていたキャンパス'].length > 0 
              ? String(answers['主に通っていたキャンパス'][0]).trim() 
              : null;
          } else if (String(answers['主に通っていたキャンパス']).trim() !== '') {
            campusPrefecture = String(answers['主に通っていたキャンパス']).trim();
          }
        } else if (answers['campus']) {
          if (Array.isArray(answers['campus'])) {
            campusPrefecture = answers['campus'].length > 0 
              ? String(answers['campus'][0]).trim() 
              : null;
          } else if (String(answers['campus']).trim() !== '') {
            campusPrefecture = String(answers['campus']).trim();
          }
        } else if (answers['prefecture']) {
          if (Array.isArray(answers['prefecture'])) {
            campusPrefecture = answers['prefecture'].length > 0 
              ? String(answers['prefecture'][0]).trim() 
              : null;
          } else if (String(answers['prefecture']).trim() !== '') {
            campusPrefecture = String(answers['prefecture']).trim();
          }
        } else {
          // 上記で見つからなかった場合、すべてのキーをチェックして、都道府県らしい値を探す
          const allKeys = Object.keys(answers);
          for (const key of allKeys) {
            const value = answers[key];
            // 都道府県名のパターン（47都道府県）をチェック
            if (typeof value === 'string' && value.length > 0) {
              const prefecturePatterns = ['都', '道', '府', '県'];
              if (prefecturePatterns.some(pattern => value.includes(pattern))) {
                campusPrefecture = value.trim();
                break;
              }
            } else if (Array.isArray(value) && value.length > 0) {
              const prefecturePatterns = ['都', '道', '府', '県'];
              const found = value.find((v: any) => 
                typeof v === 'string' && prefecturePatterns.some(pattern => v.includes(pattern))
              );
              if (found) {
                campusPrefecture = String(found).trim();
                break;
              }
            }
          }
        }
        
        // デバッグ用ログ（学校名が'test'の場合のみ詳細ログ）
        if (review.school_name === 'test') {
          console.log(`[API] Review ${review.id} - 学校名: ${review.school_name}`);
          console.log(`[API] Review ${review.id} - answers全体:`, JSON.stringify(answers, null, 2));
          console.log(`[API] Review ${review.id} - answersのキー一覧:`, Object.keys(answers));
          console.log(`[API] Review ${review.id} - answers.campus_prefecture:`, answers.campus_prefecture);
          console.log(`[API] Review ${review.id} - 検出されたcampus_prefecture:`, campusPrefecture);
          console.log(`[API] Review ${review.id} - reason_for_choosing:`, answers.reason_for_choosing);
          console.log(`[API] Review ${review.id} - attendance_frequency:`, answers.attendance_frequency);
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
          reason_for_choosing: Array.isArray(answers.reason_for_choosing) ? answers.reason_for_choosing : [],
          attendance_frequency: answers.attendance_frequency || null,
          campus_prefecture: campusPrefecture || null,
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

    console.log('[API] /api/home - レスポンス準備完了');
    const responseData = {
      topRankedSchools: rankedSchools || [],
      popularSchools: popularSchools || [],
      latestReviews: latestReviews || [],
      latestArticles: latestArticles || [],
    };
    
    console.log('[API] /api/home - レスポンスデータ:', {
      topRankedSchoolsCount: responseData.topRankedSchools.length,
      popularSchoolsCount: responseData.popularSchools.length,
      latestReviewsCount: responseData.latestReviews.length,
      latestArticlesCount: responseData.latestArticles.length,
    });
    
    return NextResponse.json(responseData);
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

