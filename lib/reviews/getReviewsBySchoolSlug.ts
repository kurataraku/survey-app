import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';

export interface ReviewListItem {
  id: string;
  school_id: string;
  school_name: string;
  school_slug: string | null;
  overall_satisfaction: number;
  good_comment: string;
  bad_comment: string;
  enrollment_year: number | null;
  attendance_frequency: string | null;
  like_count: number;
  created_at: string;
}

export interface GetReviewsResult {
  reviews: ReviewListItem[];
  total: number;
  totalBeforeFilter: number;
  page: number;
  totalPages: number;
  limit: number;
  schoolName: string;
}

export interface GetReviewsParams {
  schoolSlug: string;
  page?: number;
  limit?: number;
  sort?: string;
  role?: string;
  graduation_path?: string;
  enrollment_type?: string;
  attendance_frequency?: string;
  campus_prefecture?: string;
  reason_for_choosing?: string[];
}

/**
 * 学校slugで口コミ一覧を取得（Server Component 用）
 * API /api/reviews と同じロジック
 */
export const getReviewsBySchoolSlug = cache(
  async (params: GetReviewsParams): Promise<GetReviewsResult> => {
    const {
      schoolSlug,
      page = 1,
      limit = 20,
      sort = 'newest',
      role,
      graduation_path: graduationPath,
      enrollment_type: enrollmentType,
      attendance_frequency: attendanceFrequency,
      campus_prefecture: campusPrefecture,
      reason_for_choosing: reasonForChoosingArray,
    } = params;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        reviews: [],
        total: 0,
        totalBeforeFilter: 0,
        page,
        totalPages: 0,
        limit,
        schoolName: '',
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const decodedSlug = decodeURIComponent(schoolSlug);
    const offset = (page - 1) * limit;

    // 学校IDと名前を取得（status='active'のみ）
    const { data: school } = await supabase
      .from('schools')
      .select('id, name')
      .eq('slug', decodedSlug)
      .eq('is_public', true)
      .eq('status', 'active')
      .single();

    if (!school) {
      return {
        reviews: [],
        total: 0,
        totalBeforeFilter: 0,
        page,
        totalPages: 0,
        limit,
        schoolName: '',
      };
    }

    const schoolId = school.id;
    const schoolName = school.name;

    let countQuery = supabase
      .from('survey_responses')
      .select('*', { count: 'exact', head: true })
      .eq('is_public', true)
      .not('school_id', 'is', null)
      .eq('school_id', schoolId);

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
      .eq('is_public', true)
      .not('school_id', 'is', null)
      .eq('school_id', schoolId);

    if (role) {
      countQuery = countQuery.eq('respondent_role', role);
      reviewsQuery = reviewsQuery.eq('respondent_role', role);
    }

    if (graduationPath) {
      countQuery = countQuery.eq('graduation_path', graduationPath);
      reviewsQuery = reviewsQuery.eq('graduation_path', graduationPath);
    }

    if (enrollmentType) {
      countQuery = countQuery.eq('answers->>enrollment_type', enrollmentType);
      reviewsQuery = reviewsQuery.eq('answers->>enrollment_type', enrollmentType);
    }

    if (attendanceFrequency) {
      countQuery = countQuery.eq('answers->>attendance_frequency', attendanceFrequency);
      reviewsQuery = reviewsQuery.eq('answers->>attendance_frequency', attendanceFrequency);
    }

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

    const { count: totalCountBeforeFilter } = await countQuery;

    const { data: allReviewsData, error: allReviewsError } = await reviewsQuery.order(
      orderColumn,
      { ascending: orderAscending }
    );

    if (allReviewsError) {
      console.error('レビュー取得エラー:', allReviewsError);
      return {
        reviews: [],
        total: 0,
        totalBeforeFilter: totalCountBeforeFilter || 0,
        page,
        totalPages: 0,
        limit,
        schoolName,
      };
    }

    const filteredReviews = (allReviewsData || []).filter((review: Record<string, unknown>) => {
      const rawSchools = (review as { schools?: unknown }).schools;
      const school = Array.isArray(rawSchools) ? rawSchools[0] : rawSchools;
      const s = school as { status?: string } | null;
      if (!s || s.status !== 'active') return false;

      if (reasonForChoosingArray && reasonForChoosingArray.length > 0) {
        const answers = (review.answers as Record<string, unknown>) || {};
        const reviewReasons = Array.isArray(answers.reason_for_choosing)
          ? (answers.reason_for_choosing as string[])
          : [];
        const hasMatch = reasonForChoosingArray.some((r) => reviewReasons.includes(r));
        if (!hasMatch) return false;
      }

      if (campusPrefecture) {
        const answers = (review.answers as Record<string, unknown>) || {};
        const rp = answers.campus_prefecture;
        if (Array.isArray(rp)) {
          if (!rp.includes(campusPrefecture)) return false;
        } else if (String(rp || '').trim() !== campusPrefecture) {
          return false;
        }
      }

      return true;
    });

    const totalCount = filteredReviews.length;
    const paginatedReviews = filteredReviews.slice(offset, offset + limit);

    const reviews = await Promise.all(
      paginatedReviews.map(async (review: Record<string, unknown>) => {
        const { count: likeCount } = await supabase
          .from('review_likes')
          .select('*', { count: 'exact', head: true })
          .eq('review_id', review.id);

        const rawSchools = (review as { schools?: unknown }).schools;
        const school = Array.isArray(rawSchools) ? rawSchools[0] : rawSchools;
        const s = school as { slug?: string | null } | null;

        return {
          id: review.id,
          school_id: review.school_id,
          school_name: review.school_name,
          school_slug: s?.slug ?? null,
          overall_satisfaction: review.overall_satisfaction,
          good_comment: review.good_comment,
          bad_comment: review.bad_comment,
          enrollment_year: review.enrollment_year,
          attendance_frequency: review.attendance_frequency,
          created_at: review.created_at,
          like_count: likeCount || 0,
        } as ReviewListItem;
      })
    );

    const totalPages = Math.ceil((totalCount || 0) / limit);

    return {
      reviews,
      total: totalCount || 0,
      totalBeforeFilter: totalCountBeforeFilter || 0,
      page,
      totalPages,
      limit,
      schoolName,
    };
  }
);
