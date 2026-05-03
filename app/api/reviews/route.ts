import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  publicSurveyResponsesOrFilter,
  shouldIncludeSurveyOnSchoolHubPage,
} from '@/lib/reviews/schoolReviewLinkage';

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

    // フィルタパラメータを取得
    const role = searchParams.get('role') || undefined;
    const graduationPath = searchParams.get('graduation_path') || undefined;
    const enrollmentType = searchParams.get('enrollment_type') || undefined;
    const attendanceFrequency = searchParams.get('attendance_frequency') || undefined;
    const campusPrefecture = searchParams.get('campus_prefecture') || undefined;
    const reasonForChoosing = searchParams.get('reason_for_choosing'); // カンマ区切り
    const reasonForChoosingArray = reasonForChoosing
      ? reasonForChoosing.split(',').filter((r) => r.trim() !== '')
      : undefined;

    // 学校slugが指定されている場合、学校ID・名前を取得（status='active'のみ）
    let schoolId: string | null = null;
    let schoolNameForPage: string | null = null;
    let pageSchoolSlug: string | null = null;
    if (schoolSlug) {
      const decodedSlug = decodeURIComponent(schoolSlug);
      const { data: school } = await supabase
        .from('schools')
        .select('id, name, slug')
        .eq('slug', decodedSlug)
        .eq('is_public', true)
        .eq('status', 'active') // 承認済み（active）のみ
        .single();
      
      if (school) {
        schoolId = school.id;
        schoolNameForPage = school.name;
        pageSchoolSlug = school.slug;
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

    const schoolScopeOr =
      schoolId && schoolNameForPage
        ? publicSurveyResponsesOrFilter(schoolId, schoolNameForPage)
        : null;

    // クエリビルダーを作成（全校一覧は school_id 必須。学校指定時は管理画面と同スコープの OR + サーバ側で重複除外）
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
        respondent_role,
        graduation_path,
        answers,
        schools(id, name, slug, status)
      `)
      .eq('is_public', true);

    if (schoolScopeOr) {
      countQuery = countQuery.or(schoolScopeOr);
      reviewsQuery = reviewsQuery.or(schoolScopeOr);
    } else {
      countQuery = countQuery.not('school_id', 'is', null);
      reviewsQuery = reviewsQuery.not('school_id', 'is', null);
    }

    // フィルタリング: 通常カラム
    if (role) {
      countQuery = countQuery.eq('respondent_role', role);
      reviewsQuery = reviewsQuery.eq('respondent_role', role);
    }

    if (graduationPath) {
      countQuery = countQuery.eq('graduation_path', graduationPath);
      reviewsQuery = reviewsQuery.eq('graduation_path', graduationPath);
    }

    // フィルタリング: JSONBカラム（answers）
    // 入学タイミング
    if (enrollmentType) {
      countQuery = countQuery.eq('answers->>enrollment_type', enrollmentType);
      reviewsQuery = reviewsQuery.eq('answers->>enrollment_type', enrollmentType);
    }

    // 通学頻度
    if (attendanceFrequency) {
      countQuery = countQuery.eq('answers->>attendance_frequency', attendanceFrequency);
      reviewsQuery = reviewsQuery.eq('answers->>attendance_frequency', attendanceFrequency);
    }

    // 都道府県のフィルタリングはアプリ側で行う（配列対応のため）

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

    // レビュー一覧を取得（フィルタ適用前、全件取得してアプリ側でフィルタリング）
    // 理由: JSONB配列の複雑なフィルタリング（reason_for_choosing）を確実に処理するため
    const { data: allReviewsData, error: allReviewsError } = await reviewsQuery
      .order(orderColumn, { ascending: orderAscending });

    if (allReviewsError) {
      console.error('レビュー取得エラー:', allReviewsError);
      return NextResponse.json(
        { error: 'レビューの取得に失敗しました' },
        { status: 500 }
      );
    }

    let hubScoped = allReviewsData || [];
    if (schoolId && schoolNameForPage) {
      hubScoped = hubScoped.filter((review: any) =>
        shouldIncludeSurveyOnSchoolHubPage(review, schoolId, schoolNameForPage)
      );
    }

    const totalCountBeforeFilter = schoolId && schoolNameForPage
      ? hubScoped.length
      : (await countQuery).count ?? 0;

    // アプリ側でフィルタリング（reason_for_choosingのOR条件、都道府県の配列対応、pending状態の学校の口コミ除外など）
    let filteredReviews = hubScoped.filter((review: any) => {
      if (!schoolId || !schoolNameForPage) {
        const school = Array.isArray(review.schools) ? review.schools[0] : review.schools;
        if (!school || school.status !== 'active') {
          return false;
        }
      }

      // reason_for_choosingのフィルタリング（OR条件）
      if (reasonForChoosingArray && reasonForChoosingArray.length > 0) {
        const answers = review.answers || {};
        const reviewReasons = Array.isArray(answers.reason_for_choosing)
          ? answers.reason_for_choosing
          : [];
        
        // 選択された理由のいずれかが含まれているかチェック（OR条件）
        const hasMatchingReason = reasonForChoosingArray.some((filterReason) =>
          reviewReasons.includes(filterReason)
        );
        
        if (!hasMatchingReason) {
          return false;
        }
      }

      // 都道府県のフィルタリング（配列対応）
      if (campusPrefecture) {
        const answers = review.answers || {};
        const reviewPrefecture = answers.campus_prefecture;
        if (Array.isArray(reviewPrefecture)) {
          if (!reviewPrefecture.includes(campusPrefecture)) {
            return false;
          }
        } else if (String(reviewPrefecture).trim() !== campusPrefecture) {
          return false;
        }
      }

      return true;
    });

    // フィルタ後の総件数
    const totalCount = filteredReviews.length;

    // ページネーション
    const paginatedReviews = filteredReviews.slice(offset, offset + limit);

    // 各口コミのいいね数を取得
    const reviews = await Promise.all(
      (paginatedReviews || []).map(async (review: any) => {
        const { count: likeCount } = await supabase
          .from('review_likes')
          .select('*', { count: 'exact', head: true })
          .eq('review_id', review.id);

        const school = Array.isArray(review.schools) ? review.schools[0] : review.schools;

        return {
          id: review.id,
          school_id: review.school_id,
          school_name: review.school_name,
          school_slug: school?.slug || pageSchoolSlug || null,
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
      total_before_filter: totalCountBeforeFilter || 0, // フィルタ前の総件数
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
