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

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const schoolSlug = searchParams.get('school_slug');
    const sort = searchParams.get('sort') || 'newest';
    const offset = (page - 1) * limit;

    // 学校slugが指定されている場合、学校IDを取得
    let schoolId: string | null = null;
    if (schoolSlug) {
      const decodedSlug = decodeURIComponent(schoolSlug);
      const { data: school } = await supabase
        .from('schools')
        .select('id')
        .eq('slug', decodedSlug)
        .eq('is_public', true)
        .single();
      
      if (school) {
        schoolId = school.id;
      } else {
        // 学校が見つからない場合は空の結果を返す
        return NextResponse.json({
          reviews: [],
          total: 0,
          page,
          total_pages: 0,
          limit,
        });
      }
    }

    // クエリビルダーを作成
    let countQuery = supabase
      .from('survey_responses')
      .select('*', { count: 'exact', head: true })
      .eq('is_public', true);

    let reviewsQuery = supabase
      .from('survey_responses')
      .select(`
        id,
        school_id,
        school_name,
        overall_satisfaction,
        good_comment,
        bad_comment,
        created_at,
        enrollment_year,
        attendance_frequency,
        schools(id, name, slug)
      `)
      .eq('is_public', true);

    // 学校IDでフィルタリング
    if (schoolId) {
      countQuery = countQuery.eq('school_id', schoolId);
      reviewsQuery = reviewsQuery.eq('school_id', schoolId);
    }

    // ソート順を設定
    let orderColumn = 'created_at';
    let orderAscending = false;
    
    if (sort === 'oldest') {
      orderAscending = true;
    } else if (sort === 'rating_desc') {
      orderColumn = 'overall_satisfaction';
      orderAscending = false;
    } else if (sort === 'rating_asc') {
      orderColumn = 'overall_satisfaction';
      orderAscending = true;
    }

    // 総件数を取得
    const { count: totalCount } = await countQuery;

    // レビュー一覧を取得
    const { data: reviewsData, error } = await reviewsQuery
      .order(orderColumn, { ascending: orderAscending })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('レビュー取得エラー:', error);
      return NextResponse.json(
        { error: 'レビューの取得に失敗しました' },
        { status: 500 }
      );
    }

    // 各口コミのいいね数を取得
    const reviews = await Promise.all(
      (reviewsData || []).map(async (review: any) => {
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

    const totalPages = Math.ceil((totalCount || 0) / limit);

    return NextResponse.json({
      reviews,
      total: totalCount || 0,
      page,
      total_pages: totalPages,
      limit,
    });
  } catch (error) {
    console.error('レビュー一覧APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
