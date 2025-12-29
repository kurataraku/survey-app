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

    // クエリパラメータを取得
    const searchParams = request.nextUrl.searchParams;
    const schoolId = searchParams.get('school_id');
    const schoolSlug = searchParams.get('school_slug');
    const sort = searchParams.get('sort') || 'newest';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    // 学校スラッグから学校IDを取得（必要な場合）
    let targetSchoolId = schoolId;
    if (schoolSlug && !targetSchoolId) {
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('slug', schoolSlug)
        .eq('is_public', true)
        .single();
      if (school) {
        targetSchoolId = school.id;
      }
    }

    // 口コミ検索クエリを構築
    let query = supabase
      .from('survey_responses')
      .select(`
        id,
        school_id,
        school_name,
        overall_satisfaction,
        good_comment,
        bad_comment,
        enrollment_year,
        attendance_frequency,
        staff_rating,
        atmosphere_fit_rating,
        credit_rating,
        tuition_rating,
        created_at,
        schools(slug, name)
      `, { count: 'exact' })
      .eq('is_public', true);

    // 学校IDでフィルタリング
    if (targetSchoolId) {
      query = query.eq('school_id', targetSchoolId);
    }

    // ソート順を設定
    switch (sort) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'rating_desc':
        query = query.order('overall_satisfaction', { ascending: false });
        break;
      case 'rating_asc':
        query = query.order('overall_satisfaction', { ascending: true });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // ページネーション
    query = query.range(offset, offset + limit - 1);

    const { data: reviews, error, count } = await query;

    if (error) {
      console.error('口コミ取得エラー:', error);
      return NextResponse.json(
        { error: '口コミ取得に失敗しました', details: error.message },
        { status: 500 }
      );
    }

    // 各口コミのいいね数を取得
    const reviewsWithLikes = await Promise.all(
      (reviews || []).map(async (review: any) => {
        const { count: likeCount } = await supabase
          .from('review_likes')
          .select('*', { count: 'exact', head: true })
          .eq('review_id', review.id);

        const school = Array.isArray(review.schools) ? review.schools[0] : review.schools;

        return {
          id: review.id,
          school_id: review.school_id,
          school_name: review.school_name,
          school_slug: school?.slug || null,
          overall_satisfaction: review.overall_satisfaction,
          good_comment: review.good_comment,
          bad_comment: review.bad_comment,
          enrollment_year: review.enrollment_year,
          attendance_frequency: review.attendance_frequency,
          staff_rating: review.staff_rating,
          atmosphere_fit_rating: review.atmosphere_fit_rating,
          credit_rating: review.credit_rating,
          tuition_rating: review.tuition_rating,
          like_count: likeCount || 0,
          created_at: review.created_at,
        };
      })
    );

    return NextResponse.json({
      reviews: reviewsWithLikes,
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

