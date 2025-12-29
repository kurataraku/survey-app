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

    // 口コミ情報を取得
    const { data: review, error: reviewError } = await supabase
      .from('survey_responses')
      .select(`
        id,
        school_id,
        school_name,
        respondent_role,
        status,
        overall_satisfaction,
        good_comment,
        bad_comment,
        enrollment_year,
        attendance_frequency,
        reason_for_choosing,
        staff_rating,
        atmosphere_fit_rating,
        credit_rating,
        tuition_rating,
        created_at,
        schools!inner(slug, name)
      `)
      .eq('id', reviewId)
      .eq('is_public', true)
      .single();

    if (reviewError || !review) {
      return NextResponse.json(
        { error: '口コミが見つかりません' },
        { status: 404 }
      );
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

    const school = Array.isArray((review as any).schools) 
      ? (review as any).schools[0] 
      : (review as any).schools;

    return NextResponse.json({
      id: review.id,
      school_id: review.school_id,
      school_name: review.school_name,
      school_slug: school?.slug || null,
      respondent_role: review.respondent_role,
      status: review.status,
      overall_satisfaction: review.overall_satisfaction,
      good_comment: review.good_comment,
      bad_comment: review.bad_comment,
      enrollment_year: review.enrollment_year,
      attendance_frequency: review.attendance_frequency,
      reason_for_choosing: review.reason_for_choosing || [],
      staff_rating: review.staff_rating,
      atmosphere_fit_rating: review.atmosphere_fit_rating,
      credit_rating: review.credit_rating,
      tuition_rating: review.tuition_rating,
      like_count: likeCount || 0,
      is_liked: (userLikeCount || 0) > 0,
      created_at: review.created_at,
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

