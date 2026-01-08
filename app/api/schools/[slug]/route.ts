import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> | { slug: string } }
) {
  try {
    console.log('[API] /api/schools/[slug] - Request started');
    
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log('[API] /api/schools/[slug] - Environment check:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseServiceKey,
      urlLength: supabaseUrl?.length || 0,
      keyLength: supabaseServiceKey?.length || 0
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[API] /api/schools/[slug] - Missing environment variables');
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Next.jsのAPIルートではparamsはすでにデコードされているため、そのまま使用
    // ただし、ブラウザからエンコードされて送られてくる場合もあるため、両方に対応
    let slug = resolvedParams.slug;
    
    // デコードが必要な場合（%が含まれている場合）
    if (slug.includes('%')) {
      try {
        slug = decodeURIComponent(slug);
      } catch (e) {
        // デコードに失敗した場合はそのまま使用
        console.warn('[API] Slug decode failed, using original:', slug);
      }
    }
    
    // デバッグ用ログ
    console.log('[API] /api/schools/[slug] - Received slug (raw):', resolvedParams.slug);
    console.log('[API] /api/schools/[slug] - Processed slug:', slug);
    console.log('[API] /api/schools/[slug] - Slug type:', typeof slug);
    console.log('[API] /api/schools/[slug] - Slug length:', slug?.length);

    // 学校情報を取得（status='active'のみ）
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('*')
      .eq('slug', slug)
      .eq('is_public', true)
      .eq('status', 'active') // 承認済み（active）のみ
      .single();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/schools/[slug]/route.ts:60',message:'学校詳細取得:ステータス確認',data:{slug,schoolId:school?.id,schoolStatus:school?.status,found:!!school},timestamp:Date.now(),sessionId:'debug-session',runId:'pending-check',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    if (schoolError || !school) {
      console.log('[API] /api/schools/[slug] - School not found. Error:', schoolError);
      console.log('[API] /api/schools/[slug] - Searching for slug:', slug);
      console.log('[API] /api/schools/[slug] - Slug type:', typeof slug);
      console.log('[API] /api/schools/[slug] - Slug length:', slug?.length);
      
      // すべての学校のslugを取得してデバッグ
      const { data: schoolsList } = await supabase
        .from('schools')
        .select('id, name, slug')
        .eq('is_public', true)
        .limit(100);
      
      console.log('[API] /api/schools/[slug] - Total schools found:', schoolsList?.length);
      console.log('[API] /api/schools/[slug] - Available slugs:', schoolsList?.map(s => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        slugType: typeof s.slug,
        slugLength: s.slug?.length,
        slugMatches: s.slug === slug,
        slugIncludes: s.slug?.includes(slug) || slug?.includes(s.slug || '')
      })));
      
      // 大文字小文字を区別しない検索を試行（参考用）
      const { data: caseInsensitiveSchools } = await supabase
        .from('schools')
        .select('id, name, slug')
        .eq('is_public', true)
        .ilike('slug', slug);
      
      if (caseInsensitiveSchools && caseInsensitiveSchools.length > 0) {
        console.log('[API] /api/schools/[slug] - Found with case-insensitive search:', caseInsensitiveSchools);
      }
      
      return NextResponse.json(
        { 
          error: '学校が見つかりません', 
          received_slug: slug,
          received_slug_encoded: resolvedParams.slug,
          available_slugs_count: schoolsList?.length || 0
        },
        { status: 404 }
      );
    }

    // 口コミ数を取得（school_idでフィルタリング、pending状態の学校の口コミを除外）
    const { count: reviewCount } = await supabase
      .from('survey_responses')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', school.id); // school_idでフィルタリング（pending状態の学校の口コミを除外）

    // 評価の平均値を計算（school_idでフィルタリング、pending状態の学校の口コミを除外）
    const { data: reviews } = await supabase
      .from('survey_responses')
      .select('overall_satisfaction, answers')
      .eq('school_id', school.id); // school_idでフィルタリング（pending状態の学校の口コミを除外）

    // overall_satisfactionの平均と外れ値件数を計算
    const overallValues = reviews?.map(r => r.overall_satisfaction) || [];
    const validOverallValues = overallValues.filter((v): v is number => v !== null && v !== undefined && v !== 6 && v >= 1 && v <= 5);
    const overallOutlierCount = overallValues.filter((v): v is number => v === 6).length;
    const overallAvg = validOverallValues.length > 0
      ? parseFloat((validOverallValues.reduce((sum, v) => sum + v, 0) / validOverallValues.length).toFixed(2))
      : null;

    // answers JSONBから評価データを取得
    // 評価値は1-5の範囲で、6は「評価できない」を意味するため除外
    const staffRatings = reviews && reviews.length > 0
      ? reviews
          .map(r => r.answers?.staff_rating)
          .filter((rating): rating is string => rating !== null && rating !== undefined && rating !== '' && rating !== '6')
          .map(r => parseInt(r, 10))
          .filter(r => !isNaN(r) && r >= 1 && r <= 5)
      : [];

    const atmosphereRatings = reviews && reviews.length > 0
      ? reviews
          .map(r => r.answers?.atmosphere_fit_rating)
          .filter((rating): rating is string => rating !== null && rating !== undefined && rating !== '' && rating !== '6')
          .map(r => parseInt(r, 10))
          .filter(r => !isNaN(r) && r >= 1 && r <= 5)
      : [];

    const creditRatings = reviews && reviews.length > 0
      ? reviews
          .map(r => r.answers?.credit_rating)
          .filter((rating): rating is string => rating !== null && rating !== undefined && rating !== '' && rating !== '6')
          .map(r => parseInt(r, 10))
          .filter(r => !isNaN(r) && r >= 1 && r <= 5)
      : [];

    const tuitionRatings = reviews && reviews.length > 0
      ? reviews
          .map(r => r.answers?.tuition_rating)
          .filter((rating): rating is string => rating !== null && rating !== undefined && rating !== '' && rating !== '6')
          .map(r => parseInt(r, 10))
          .filter(r => !isNaN(r) && r >= 1 && r <= 5)
      : [];

    // 外れ値（評価値6）の件数をカウント
    const staffOutlierCount = reviews && reviews.length > 0
      ? reviews.filter(r => r.answers?.staff_rating === '6' || r.answers?.staff_rating === 6).length
      : 0;

    const atmosphereOutlierCount = reviews && reviews.length > 0
      ? reviews.filter(r => r.answers?.atmosphere_fit_rating === '6' || r.answers?.atmosphere_fit_rating === 6).length
      : 0;

    const creditOutlierCount = reviews && reviews.length > 0
      ? reviews.filter(r => r.answers?.credit_rating === '6' || r.answers?.credit_rating === 6).length
      : 0;

    const tuitionOutlierCount = reviews && reviews.length > 0
      ? reviews.filter(r => r.answers?.tuition_rating === '6' || r.answers?.tuition_rating === 6).length
      : 0;

    const staffRatingAvg = staffRatings.length > 0
      ? parseFloat((staffRatings.reduce((sum, r) => sum + r, 0) / staffRatings.length).toFixed(2))
      : null;

    const atmosphereFitRatingAvg = atmosphereRatings.length > 0
      ? parseFloat((atmosphereRatings.reduce((sum, r) => sum + r, 0) / atmosphereRatings.length).toFixed(2))
      : null;

    const creditRatingAvg = creditRatings.length > 0
      ? parseFloat((creditRatings.reduce((sum, r) => sum + r, 0) / creditRatings.length).toFixed(2))
      : null;

    const tuitionRatingAvg = tuitionRatings.length > 0
      ? parseFloat((tuitionRatings.reduce((sum, r) => sum + r, 0) / tuitionRatings.length).toFixed(2))
      : null;

    // サイト全体の評価平均を計算するために全口コミを取得
    const { data: allGlobalReviews } = await supabase
      .from('survey_responses')
      .select('overall_satisfaction, answers');

    const toValidRatings = (rows: any[] | null | undefined, key: string) =>
      rows && rows.length > 0
        ? rows
            .map((r) => r.answers?.[key])
            .filter(
              (rating: any): rating is string =>
                rating !== null &&
                rating !== undefined &&
                rating !== '' &&
                rating !== '6'
            )
            .map((r: string) => parseInt(r, 10))
            .filter((r: number) => !isNaN(r) && r >= 1 && r <= 5)
        : [];

    const globalFlexibilityRatings = toValidRatings(
      allGlobalReviews,
      'flexibility_rating'
    );
    const globalStaffRatings = toValidRatings(allGlobalReviews, 'staff_rating');
    const globalSupportRatings = toValidRatings(
      allGlobalReviews,
      'support_rating'
    );
    const globalAtmosphereRatings = toValidRatings(
      allGlobalReviews,
      'atmosphere_fit_rating'
    );
    const globalCreditRatings = toValidRatings(
      allGlobalReviews,
      'credit_rating'
    );
    const globalUniqueCourseRatings = toValidRatings(
      allGlobalReviews,
      'unique_course_rating'
    );
    const globalCareerSupportRatings = toValidRatings(
      allGlobalReviews,
      'career_support_rating'
    );
    const globalCampusLifeRatings = toValidRatings(
      allGlobalReviews,
      'campus_life_rating'
    );
    const globalTuitionRatings = toValidRatings(
      allGlobalReviews,
      'tuition_rating'
    );

    const averageOrNull = (values: number[]) =>
      values.length > 0
        ? parseFloat(
            (
              values.reduce((sum: number, v: number) => sum + v, 0) /
              values.length
            ).toFixed(2)
          )
        : null;

    const globalFlexibilityRatingAvg = averageOrNull(globalFlexibilityRatings);
    const globalStaffRatingAvg = averageOrNull(globalStaffRatings);
    const globalSupportRatingAvg = averageOrNull(globalSupportRatings);
    const globalAtmosphereFitRatingAvg = averageOrNull(globalAtmosphereRatings);
    const globalCreditRatingAvg = averageOrNull(globalCreditRatings);
    const globalUniqueCourseRatingAvg = averageOrNull(globalUniqueCourseRatings);
    const globalCareerSupportRatingAvg = averageOrNull(
      globalCareerSupportRatings
    );
    const globalCampusLifeRatingAvg = averageOrNull(globalCampusLifeRatings);
    const globalTuitionRatingAvg = averageOrNull(globalTuitionRatings);

    // 統計情報を取得するために全口コミを取得（この学校のみ、school_idでフィルタリング）
    const { data: allReviewsForStats } = await supabase
      .from('survey_responses')
      .select('respondent_role, status, graduation_path, answers')
      .eq('school_id', school.id); // school_idでフィルタリング（pending状態の学校の口コミを除外）

    // 基本情報の統計
    const respondentRoleStats = {
      本人: allReviewsForStats?.filter(r => r.respondent_role === '本人').length || 0,
      保護者: allReviewsForStats?.filter(r => r.respondent_role === '保護者').length || 0,
    };

    const statusStats = {
      在籍中: allReviewsForStats?.filter(r => r.status === '在籍中').length || 0,
      卒業した: allReviewsForStats?.filter(r => r.status === '卒業した').length || 0,
      '以前在籍していた（転校・退学など）': allReviewsForStats?.filter(r => r.status === '以前在籍していた（転校・退学など）').length || 0,
    };

    const graduationPathStats: Record<string, number> = {};
    allReviewsForStats?.forEach(r => {
      if (r.graduation_path) {
        graduationPathStats[r.graduation_path] = (graduationPathStats[r.graduation_path] || 0) + 1;
      }
    });

    // 通信制を選んだ理由の統計
    const reasonForChoosingStats: Record<string, number> = {};
    allReviewsForStats?.forEach(r => {
      const reasons = r.answers?.reason_for_choosing;
      if (Array.isArray(reasons)) {
        reasons.forEach((reason: string) => {
          reasonForChoosingStats[reason] = (reasonForChoosingStats[reason] || 0) + 1;
        });
      }
    });

    // 入学タイミングの統計
    const enrollmentTypeStats: Record<string, number> = {};
    allReviewsForStats?.forEach(r => {
      const enrollmentType = r.answers?.enrollment_type;
      if (enrollmentType) {
        enrollmentTypeStats[enrollmentType] = (enrollmentTypeStats[enrollmentType] || 0) + 1;
      }
    });

    // 通学頻度の統計
    const attendanceFrequencyStats: Record<string, number> = {};
    allReviewsForStats?.forEach(r => {
      const frequency = r.answers?.attendance_frequency;
      if (frequency) {
        attendanceFrequencyStats[frequency] = (attendanceFrequencyStats[frequency] || 0) + 1;
      }
    });

    // 授業スタイルの統計
    const teachingStyleStats: Record<string, number> = {};
    allReviewsForStats?.forEach(r => {
      const styles = r.answers?.teaching_style;
      if (Array.isArray(styles)) {
        styles.forEach((style: string) => {
          teachingStyleStats[style] = (teachingStyleStats[style] || 0) + 1;
        });
      }
    });

    // 生徒の雰囲気の統計
    const studentAtmosphereStats: Record<string, number> = {};
    allReviewsForStats?.forEach(r => {
      const atmospheres = r.answers?.student_atmosphere;
      if (Array.isArray(atmospheres)) {
        atmospheres.forEach((atmosphere: string) => {
          studentAtmosphereStats[atmosphere] = (studentAtmosphereStats[atmosphere] || 0) + 1;
        });
      }
    });

    // 追加の評価項目の平均を計算
    const flexibilityRatings = reviews && reviews.length > 0
      ? reviews
          .map(r => r.answers?.flexibility_rating)
          .filter((rating): rating is string => rating !== null && rating !== undefined && rating !== '' && rating !== '6')
          .map(r => parseInt(r, 10))
          .filter(r => !isNaN(r) && r >= 1 && r <= 5)
      : [];

    const supportRatings = reviews && reviews.length > 0
      ? reviews
          .map(r => r.answers?.support_rating)
          .filter((rating): rating is string => rating !== null && rating !== undefined && rating !== '' && rating !== '6')
          .map(r => parseInt(r, 10))
          .filter(r => !isNaN(r) && r >= 1 && r <= 5)
      : [];

    const uniqueCourseRatings = reviews && reviews.length > 0
      ? reviews
          .map(r => r.answers?.unique_course_rating)
          .filter((rating): rating is string => rating !== null && rating !== undefined && rating !== '' && rating !== '6')
          .map(r => parseInt(r, 10))
          .filter(r => !isNaN(r) && r >= 1 && r <= 5)
      : [];

    const careerSupportRatings = reviews && reviews.length > 0
      ? reviews
          .map(r => r.answers?.career_support_rating)
          .filter((rating): rating is string => rating !== null && rating !== undefined && rating !== '' && rating !== '6')
          .map(r => parseInt(r, 10))
          .filter(r => !isNaN(r) && r >= 1 && r <= 5)
      : [];

    const campusLifeRatings = reviews && reviews.length > 0
      ? reviews
          .map(r => r.answers?.campus_life_rating)
          .filter((rating): rating is string => rating !== null && rating !== undefined && rating !== '' && rating !== '6')
          .map(r => parseInt(r, 10))
          .filter(r => !isNaN(r) && r >= 1 && r <= 5)
      : [];

    const flexibilityRatingAvg = flexibilityRatings.length > 0
      ? parseFloat((flexibilityRatings.reduce((sum, r) => sum + r, 0) / flexibilityRatings.length).toFixed(2))
      : null;

    const supportRatingAvg = supportRatings.length > 0
      ? parseFloat((supportRatings.reduce((sum, r) => sum + r, 0) / supportRatings.length).toFixed(2))
      : null;

    const uniqueCourseRatingAvg = uniqueCourseRatings.length > 0
      ? parseFloat((uniqueCourseRatings.reduce((sum, r) => sum + r, 0) / uniqueCourseRatings.length).toFixed(2))
      : null;

    const careerSupportRatingAvg = careerSupportRatings.length > 0
      ? parseFloat((careerSupportRatings.reduce((sum, r) => sum + r, 0) / careerSupportRatings.length).toFixed(2))
      : null;

    const campusLifeRatingAvg = campusLifeRatings.length > 0
      ? parseFloat((campusLifeRatings.reduce((sum, r) => sum + r, 0) / campusLifeRatings.length).toFixed(2))
      : null;

    // すべての口コミを取得して、いいね数でソート（school_idでフィルタリング）
    const { data: allReviews } = await supabase
      .from('survey_responses')
      .select('id, overall_satisfaction, good_comment, bad_comment, created_at')
      .eq('school_id', school.id); // school_idでフィルタリング（pending状態の学校の口コミを除外）

    // 各口コミのいいね数を取得
    const reviewsWithLikes = await Promise.all(
      (allReviews || []).map(async (review) => {
        let likeCount = 0;
        try {
          const { count, error: likesError } = await supabase
            .from('review_likes')
            .select('*', { count: 'exact', head: true })
            .eq('review_id', review.id);
          
          if (!likesError) {
            likeCount = count || 0;
          }
        } catch (error) {
          // review_likesテーブルが存在しない場合は0を返す
          console.warn('いいね数取得エラー:', error);
        }
        return {
          ...review,
          like_count: likeCount,
        };
      })
    );

    // いいね数順でソートして上位3件を取得
    const latestReviews = reviewsWithLikes
      .sort((a, b) => b.like_count - a.like_count)
      .slice(0, 3);

    return NextResponse.json({
      id: school.id,
      name: school.name,
      prefecture: school.prefecture,
      prefectures: school.prefectures || (school.prefecture ? [school.prefecture] : []),
      slug: school.slug,
      intro: school.intro,
      highlights: school.highlights,
      faq: school.faq,
      review_count: reviewCount || 0,
      overall_avg: overallAvg,
      staff_rating_avg: staffRatingAvg,
      atmosphere_fit_rating_avg: atmosphereFitRatingAvg,
      credit_rating_avg: creditRatingAvg,
      tuition_rating_avg: tuitionRatingAvg,
      outlier_counts: {
        overall: overallOutlierCount,
        staff: staffOutlierCount,
        atmosphere: atmosphereOutlierCount,
        credit: creditOutlierCount,
        tuition: tuitionOutlierCount,
      },
      latest_reviews: latestReviews?.map(review => ({
        id: review.id,
        overall_satisfaction: review.overall_satisfaction,
        good_comment: review.good_comment,
        bad_comment: review.bad_comment,
        created_at: review.created_at,
        like_count: review.like_count || 0,
      })) || [],
      // 追加の評価項目
      flexibility_rating_avg: flexibilityRatingAvg,
      support_rating_avg: supportRatingAvg,
      unique_course_rating_avg: uniqueCourseRatingAvg,
      career_support_rating_avg: careerSupportRatingAvg,
      campus_life_rating_avg: campusLifeRatingAvg,
      // サイト全体の平均（レーダーチャート用）
      global_averages: {
        flexibility_rating_avg: globalFlexibilityRatingAvg,
        staff_rating_avg: globalStaffRatingAvg,
        support_rating_avg: globalSupportRatingAvg,
        atmosphere_fit_rating_avg: globalAtmosphereFitRatingAvg,
        credit_rating_avg: globalCreditRatingAvg,
        unique_course_rating_avg: globalUniqueCourseRatingAvg,
        career_support_rating_avg: globalCareerSupportRatingAvg,
        campus_life_rating_avg: globalCampusLifeRatingAvg,
        tuition_rating_avg: globalTuitionRatingAvg,
      },
      // 統計情報
      statistics: {
        respondent_role: respondentRoleStats,
        status: statusStats,
        graduation_path: graduationPathStats,
        reason_for_choosing: reasonForChoosingStats,
        enrollment_type: enrollmentTypeStats,
        attendance_frequency: attendanceFrequencyStats,
        teaching_style: teachingStyleStats,
        student_atmosphere: studentAtmosphereStats,
      },
    });
  } catch (error) {
    console.error('[API] /api/schools/[slug] - Error occurred:', error);
    console.error('[API] /api/schools/[slug] - Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[API] /api/schools/[slug] - Error message:', error instanceof Error ? error.message : String(error));
    
    return NextResponse.json(
      { 
        error: 'サーバーエラーが発生しました',
        message: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.constructor.name : typeof error
      },
      { status: 500 }
    );
  }
}

