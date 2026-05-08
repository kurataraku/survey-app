import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';

export interface ReviewListItem {
  id: string;
  school_id: string | null;
  school_name: string;
  school_slug: string | null;
  school_prefecture: string | null;
  overall_satisfaction: number;
  good_comment: string;
  bad_comment: string;
  enrollment_year: number | null;
  attendance_frequency: string | null;
  like_count: number;
  created_at: string;
}

export interface GetReviewsListParams {
  page?: number;
  limit?: number;
  sort?: string;
  attendanceFrequency?: string;
  prefecture?: string;
  overallRating?: number;
  staffRating?: number;
  atmosphereRating?: number;
  creditRating?: number;
  tuitionRating?: number;
}

export interface GetReviewsListResult {
  reviews: ReviewListItem[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export const getReviewsList = cache(async (
  params: GetReviewsListParams = {}
): Promise<GetReviewsListResult> => {
  const { page = 1, limit = 20, sort = 'newest', attendanceFrequency, prefecture, overallRating, staffRating, atmosphereRating, creditRating, tuitionRating } = params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { reviews: [], total: 0, page, totalPages: 0, limit };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const offset = (page - 1) * limit;

  let orderColumn = 'created_at';
  let orderAscending = false;
  if (sort === 'oldest') orderAscending = true;
  else if (sort === 'rating_desc') { orderColumn = 'overall_satisfaction'; orderAscending = false; }
  else if (sort === 'rating_asc') { orderColumn = 'overall_satisfaction'; orderAscending = true; }

  let queryBuilder = supabase
    .from('survey_responses')
    .select(`
      id, school_id, school_name, overall_satisfaction, good_comment, bad_comment,
      created_at, enrollment_year, attendance_frequency, answers,
      schools(id, name, slug, status, prefecture)
    `)
    .eq('is_public', true)
    .not('school_id', 'is', null)
    .order(orderColumn, { ascending: orderAscending });

  if (attendanceFrequency) queryBuilder = queryBuilder.eq('attendance_frequency', attendanceFrequency);
  if (overallRating)    queryBuilder = queryBuilder.eq('overall_satisfaction', overallRating);
  if (staffRating)      queryBuilder = queryBuilder.eq('staff_rating', staffRating);
  if (atmosphereRating) queryBuilder = queryBuilder.eq('atmosphere_fit_rating', atmosphereRating);
  if (creditRating)     queryBuilder = queryBuilder.eq('credit_rating', creditRating);
  if (tuitionRating)    queryBuilder = queryBuilder.eq('tuition_rating', tuitionRating);

  const { data: allReviewsData, error } = await queryBuilder;

  if (error) {
    console.error('[getReviewsList]', error);
    return { reviews: [], total: 0, page, totalPages: 0, limit };
  }

  const filtered = (allReviewsData || []).filter((r: { schools: { status?: string; prefecture?: string } | { status?: string; prefecture?: string }[] | null }) => {
    const school = Array.isArray(r.schools) ? r.schools[0] : r.schools;
    if (!school || school.status !== 'active') return false;
    if (prefecture && school.prefecture !== prefecture) return false;
    return true;
  });

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  const reviewIds = paginated.map((r: { id: string }) => r.id);
  const likeCounts = new Map<string, number>();
  reviewIds.forEach((id) => likeCounts.set(id, 0));

  if (reviewIds.length) {
    const { data: likes } = await supabase
      .from('review_likes')
      .select('review_id')
      .in('review_id', reviewIds);
    likes?.forEach((l: { review_id: string }) => {
      likeCounts.set(l.review_id, (likeCounts.get(l.review_id) || 0) + 1);
    });
  }

  const reviews: ReviewListItem[] = paginated.map((r: Record<string, unknown>) => {
    const school = Array.isArray(r.schools) ? r.schools[0] : r.schools;
    return {
      id: r.id as string,
      school_id: r.school_id as string | null,
      school_name: (r.school_name as string) || '',
      school_slug: (school as { slug?: string; prefecture?: string } | null)?.slug ?? null,
      school_prefecture: (school as { slug?: string; prefecture?: string } | null)?.prefecture ?? null,
      overall_satisfaction: (r.overall_satisfaction as number) ?? 0,
      good_comment: (r.good_comment as string) || '',
      bad_comment: (r.bad_comment as string) || '',
      enrollment_year: r.enrollment_year as number | null,
      attendance_frequency: r.attendance_frequency as string | null,
      like_count: likeCounts.get(r.id as string) || 0,
      created_at: (r.created_at as string) || '',
    };
  });

  return {
    reviews,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    limit,
  };
});
