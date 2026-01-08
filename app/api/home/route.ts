import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/home/route.ts:5',message:'ホームページAPI開始',data:{timestamp:startTime},timestamp:Date.now(),sessionId:'debug-session',runId:'performance-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
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
    let schoolsFetchError: any | null = null;
    
    // まずprefecturesを含めて取得を試みる（status='active'のみ）
    const resultWithPrefectures = await supabase
      .from('schools')
      .select('id, name, prefecture, prefectures, slug, status')
      .eq('is_public', true)
      .eq('status', 'active'); // 承認済み（active）のみ
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/home/route.ts:42',message:'ホームページ:学校一覧取得',data:{schoolsCount:resultWithPrefectures.data?.length||0,allActive:resultWithPrefectures.data?.every(s=>s.status==='active')},timestamp:Date.now(),sessionId:'debug-session',runId:'pending-check',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
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

    console.log('[API] /api/home - 学校数:', allSchools?.length || 0);

    const schoolsStatsStartTime = Date.now();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/home/route.ts:108',message:'学校統計計算開始',data:{schoolsCount:allSchools?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'performance-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    console.log('[API] /api/home - 学校統計を計算中（最適化版）');
    
    // 最適化: 1回のクエリで全学校の統計を取得
    const schoolIds = (allSchools || []).map(s => s.id);
    
    // 口コミ数と評価を1回のクエリで取得
    const { data: allReviewsStats, error: reviewsStatsError } = await supabase
      .from('survey_responses')
      .select('school_id, overall_satisfaction')
      .in('school_id', schoolIds)
      .eq('is_public', true)
      .not('school_id', 'is', null);
    
    if (reviewsStatsError) {
      console.warn('[API] /api/home - 口コミ統計取得エラー:', reviewsStatsError);
    }
    
    // 学校IDごとに集計
    const statsMap = new Map<string, { count: number; ratings: number[] }>();
    
    (allReviewsStats || []).forEach((review: any) => {
      if (!review.school_id) return;
      
      const schoolId = review.school_id;
      if (!statsMap.has(schoolId)) {
        statsMap.set(schoolId, { count: 0, ratings: [] });
      }
      
      const stats = statsMap.get(schoolId)!;
      stats.count++;
      
      // 評価値6（該当なし）を除外し、1-5の範囲のみを集計
      if (review.overall_satisfaction !== null && 
          review.overall_satisfaction !== 6 && 
          review.overall_satisfaction >= 1 && 
          review.overall_satisfaction <= 5) {
        stats.ratings.push(review.overall_satisfaction);
      }
    });
    
    // 学校データと統計を結合
    const schoolsWithStats = (allSchools || []).map((school) => {
      const prefecturesArray = (school.prefectures && Array.isArray(school.prefectures) && school.prefectures.length > 0) 
        ? school.prefectures 
        : null;
      
      const stats = statsMap.get(school.id) || { count: 0, ratings: [] };
      const overallAvg = stats.ratings.length > 0
        ? stats.ratings.reduce((sum, r) => sum + r, 0) / stats.ratings.length
        : null;
      
      return {
        id: school.id,
        name: school.name,
        prefecture: school.prefecture,
        prefectures: prefecturesArray,
        slug: school.slug,
        review_count: stats.count,
        overall_avg: overallAvg ? parseFloat(overallAvg.toFixed(2)) : null,
      };
    });
    
    const schoolsStatsEndTime = Date.now();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/home/route.ts:175',message:'学校統計計算全体完了',data:{schoolsCount:allSchools?.length||0,totalDuration:schoolsStatsEndTime-schoolsStatsStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'performance-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

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
    // pending状態の学校の口コミを除外するため、school_idが存在する口コミのみを取得
    const { data: allReviewsData, error: reviewsDataError } = await supabase
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
      .not('school_id', 'is', null); // school_idがnullの口コミは除外

    if (reviewsDataError) {
      console.error('[API] /api/home - 口コミ一覧取得エラー:', reviewsDataError);
      // エラーが発生しても続行（空配列を返す）
    }

    console.log('[API] /api/home - 口コミ数:', allReviewsData?.length || 0);
    
    const reviewsWithSchoolsStartTime = Date.now();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/home/route.ts:220',message:'口コミ学校情報取得開始',data:{reviewsCount:allReviewsData?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'performance-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    // 最適化: school_idを使用して学校情報を一括取得
    const reviewSchoolIds = [...new Set((allReviewsData || [])
      .map((r: any) => r.school_id)
      .filter((id: any) => id !== null))];
    
    // 学校情報を一括取得
    const { data: schoolsData, error: schoolsError } = await supabase
      .from('schools')
      .select('id, name, slug, status')
      .in('id', reviewSchoolIds)
      .eq('is_public', true)
      .eq('status', 'active');
    
    if (schoolsError) {
      console.warn('[API] /api/home - 学校情報一括取得エラー:', schoolsError);
    }
    
    // 学校IDをキーとするマップを作成
    const schoolsMap = new Map<string, any>();
    (schoolsData || []).forEach((school: any) => {
      schoolsMap.set(school.id, school);
    });
    
    // 口コミデータに学校情報を結合
    const reviewsWithSchools = (allReviewsData || []).map((review: any) => {
      const school = review.school_id ? schoolsMap.get(review.school_id) || null : null;
      return {
        ...review,
        school_id: school?.id || review.school_id || null,
        schools: school,
      };
    });
    
    const reviewsWithSchoolsEndTime = Date.now();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/home/route.ts:250',message:'口コミ学校情報取得全体完了',data:{reviewsCount:allReviewsData?.length||0,totalDuration:reviewsWithSchoolsEndTime-reviewsWithSchoolsStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'performance-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    const reviewsWithLikesStartTime = Date.now();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/home/route.ts:252',message:'口コミいいね数取得開始',data:{reviewsCount:reviewsWithSchools?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'performance-fix',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // 最適化: 全口コミのいいね数を1回のクエリで取得
    const reviewIds = (reviewsWithSchools || []).map((r: any) => r.id);
    
    const { data: allLikes, error: likesError } = await supabase
      .from('review_likes')
      .select('review_id')
      .in('review_id', reviewIds);
    
    if (likesError) {
      console.warn('[API] /api/home - いいね数一括取得エラー（テーブルが存在しない可能性があります）:', likesError);
    }
    
    // 口コミIDごとによいね数を集計
    const likesMap = new Map<string, number>();
    (allLikes || []).forEach((like: any) => {
      const reviewId = like.review_id;
      likesMap.set(reviewId, (likesMap.get(reviewId) || 0) + 1);
    });
    
    // 各口コミのいいね数を取得
    const reviewsWithLikes = (reviewsWithSchools || []).map((review: any) => {
        const likeCount = likesMap.get(review.id) || 0;

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
      });
    
    const reviewsWithLikesEndTime = Date.now();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/home/route.ts:386',message:'口コミいいね数取得全体完了',data:{reviewsCount:reviewsWithSchools?.length||0,totalDuration:reviewsWithLikesEndTime-reviewsWithLikesStartTime},timestamp:Date.now(),sessionId:'debug-session',runId:'performance-fix',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    // いいね数順でソートして上位3件を取得（pending状態の学校の口コミを除外）
    const latestReviews = reviewsWithLikes
      .filter((review) => {
        // 学校が見つからない（pending状態の学校）またはstatusが'active'でない口コミを除外
        const school = review.schools;
        const shouldInclude = school && school.status === 'active';
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/home/route.ts:373',message:'ホームページ:口コミフィルタリング',data:{reviewId:review.id,schoolName:review.school_name,schoolStatus:school?.status,shouldInclude},timestamp:Date.now(),sessionId:'debug-session',runId:'pending-check',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        return shouldInclude;
      })
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/home/route.ts:431',message:'ホームページAPI完了',data:{totalDuration},timestamp:Date.now(),sessionId:'debug-session',runId:'performance-fix',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    
    console.log('[API] /api/home - レスポンス準備完了');
    console.log('[API] /api/home - 総実行時間:', totalDuration, 'ms');
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

