import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Next.js 16ではparamsがPromiseの可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const reviewId = resolvedParams.id;

    // 口コミ情報を取得（answers JSONBも含める）
    const { data: review, error: reviewError } = await supabase
      .from('survey_responses')
      .select(`
        id,
        school_name,
        respondent_role,
        status,
        graduation_path,
        graduation_path_other,
        overall_satisfaction,
        good_comment,
        bad_comment,
        answers,
        created_at
      `)
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      console.error('口コミ取得エラー:', reviewError);
      return NextResponse.json(
        { error: '口コミが見つかりません', details: reviewError?.message },
        { status: 404 }
      );
    }

    // school_nameからschoolsテーブルから情報を取得
    let schoolSlug: string | null = null;
    if (review.school_name) {
      try {
        const { data: school, error: schoolError } = await supabase
          .from('schools')
          .select('slug, name')
          .eq('name', review.school_name)
          .single();
        
        if (!schoolError && school) {
          schoolSlug = school.slug || null;
        }
      } catch (error) {
        console.warn('学校情報取得エラー:', error);
      }
    }

    // いいね数を取得
    let likeCount = 0;
    let userLikeCount = 0;
    try {
      const clientIp = request.headers.get('x-forwarded-for') || 
                       request.headers.get('x-real-ip') || 
                       'unknown';
      
      const { count } = await supabase
        .from('review_likes')
        .select('*', { count: 'exact', head: true })
        .eq('review_id', reviewId);
      likeCount = count || 0;

      const { count: userCount } = await supabase
        .from('review_likes')
        .select('*', { count: 'exact', head: true })
        .eq('review_id', reviewId)
        .eq('user_ip', clientIp);
      userLikeCount = userCount || 0;
    } catch (error) {
      // review_likesテーブルが存在しない場合は0を返す
      console.warn('review_likesテーブルが存在しません:', error);
    }

    // answers JSONBから情報を取得
    let answers: any = {};
    try {
      if (review.answers) {
        // JSONBは既にオブジェクトとしてパースされているはず
        answers = typeof review.answers === 'string' ? JSON.parse(review.answers) : review.answers;
      }
    } catch (error) {
      console.warn('answersパースエラー:', error);
      answers = {};
    }

    // 学校全体の外れ値（評価値6）の件数を取得
    let outlierCounts = {
      overall: 0,
      staff: 0,
      atmosphere: 0,
      credit: 0,
      tuition: 0,
    };

    if (review.school_name) {
      try {
        const { data: allReviews, error: allReviewsError } = await supabase
          .from('survey_responses')
          .select('overall_satisfaction, answers')
          .eq('school_name', review.school_name);

        if (allReviewsError) {
          console.warn('外れ値カウント取得エラー:', allReviewsError);
        } else if (allReviews) {
          outlierCounts.overall = allReviews.filter(r => r.overall_satisfaction === 6).length;
          outlierCounts.staff = allReviews.filter(r => {
            const answers = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || {});
            return answers?.staff_rating === '6' || answers?.staff_rating === 6;
          }).length;
          outlierCounts.atmosphere = allReviews.filter(r => {
            const answers = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || {});
            return answers?.atmosphere_fit_rating === '6' || answers?.atmosphere_fit_rating === 6;
          }).length;
          outlierCounts.credit = allReviews.filter(r => {
            const answers = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || {});
            return answers?.credit_rating === '6' || answers?.credit_rating === 6;
          }).length;
          outlierCounts.tuition = allReviews.filter(r => {
            const answers = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || {});
            return answers?.tuition_rating === '6' || answers?.tuition_rating === 6;
          }).length;
        }
      } catch (error) {
        console.warn('外れ値カウント取得エラー:', error);
      }
    }

    // 評価値を数値に変換（文字列の場合は数値に変換）
    const parseRating = (rating: any): number | null => {
      try {
        if (rating === null || rating === undefined || rating === '' || rating === '6' || rating === 6) {
          return null;
        }
        const num = typeof rating === 'string' ? parseInt(rating, 10) : rating;
        return !isNaN(num) && num >= 1 && num <= 5 ? num : null;
      } catch (error) {
        console.warn('評価値パースエラー:', error, rating);
        return null;
      }
    };

    return NextResponse.json({
      id: review.id,
      school_id: null,
      school_name: review.school_name,
      school_slug: schoolSlug,
      respondent_role: review.respondent_role,
      status: review.status,
      graduation_path: review.graduation_path,
      graduation_path_other: review.graduation_path_other,
      overall_satisfaction: review.overall_satisfaction,
      good_comment: review.good_comment,
      bad_comment: review.bad_comment,
      // Step1: 基本情報
      reason_for_choosing: Array.isArray(answers.reason_for_choosing) ? answers.reason_for_choosing : [],
      course: answers.course || null,
      enrollment_type: answers.enrollment_type || null,
      enrollment_year: answers.enrollment_year || null,
      // Step2: 学習/環境
      attendance_frequency: answers.attendance_frequency || null,
      campus_prefecture: answers.campus_prefecture || null,
      teaching_style: Array.isArray(answers.teaching_style) ? answers.teaching_style : [],
      student_atmosphere: Array.isArray(answers.student_atmosphere) ? answers.student_atmosphere : [],
      atmosphere_other: answers.atmosphere_other || null,
      // Step3: 評価
      flexibility_rating: parseRating(answers.flexibility_rating),
      staff_rating: parseRating(answers.staff_rating),
      support_rating: parseRating(answers.support_rating),
      atmosphere_fit_rating: parseRating(answers.atmosphere_fit_rating),
      credit_rating: parseRating(answers.credit_rating),
      unique_course_rating: parseRating(answers.unique_course_rating),
      career_support_rating: parseRating(answers.career_support_rating),
      campus_life_rating: parseRating(answers.campus_life_rating),
      tuition_rating: parseRating(answers.tuition_rating),
      like_count: likeCount || 0,
      is_liked: (userLikeCount || 0) > 0,
      created_at: review.created_at,
      outlier_counts: outlierCounts,
    });
  } catch (error: any) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { 
        error: 'サーバーエラーが発生しました',
        details: error?.message || String(error),
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
      },
      { status: 500 }
    );
  }
}
