import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getReviewReasonsForGroup } from '@/lib/reviews/reason-groups';

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
  reasonGroup?: string;
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

/** PostgREST が1リクエストで返す行数の上限。到達すると件数・ページ数が不足するため検知する */
const SCAN_ROW_LIMIT = 1000;

type ScanRow = {
  id: string;
  schools: { status?: string | null } | { status?: string | null }[] | null;
  answers?: unknown;
};

type DetailRow = {
  id: string;
  school_id: string | null;
  school_name: string | null;
  overall_satisfaction: number | null;
  good_comment: string | null;
  bad_comment: string | null;
  enrollment_year: number | null;
  attendance_frequency: string | null;
  created_at: string | null;
  schools: { slug?: string | null; prefecture?: string | null } | { slug?: string | null; prefecture?: string | null }[] | null;
};

export const getReviewsList = cache(async (
  params: GetReviewsListParams = {}
): Promise<GetReviewsListResult> => {
  const { page = 1, limit = 20, sort = 'newest', attendanceFrequency, prefecture, reasonGroup, overallRating, staffRating, atmosphereRating, creditRating, tuitionRating } = params;

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

  const reasonFilters = getReviewReasonsForGroup(reasonGroup);
  // answers は絞り込みにしか使わないため、絞り込み指定がなければ取得しない
  const needsAnswers = Boolean(prefecture) || reasonFilters.length > 0;

  let queryBuilder = supabase
    .from('survey_responses')
    .select(`id, schools(status)${needsAnswers ? ', answers' : ''}`)
    .eq('is_public', true)
    .not('school_id', 'is', null)
    .order(orderColumn, { ascending: orderAscending });

  if (attendanceFrequency) queryBuilder = queryBuilder.eq('attendance_frequency', attendanceFrequency);
  if (overallRating)    queryBuilder = queryBuilder.eq('overall_satisfaction', overallRating);
  if (staffRating)      queryBuilder = queryBuilder.eq('staff_rating', staffRating);
  if (atmosphereRating) queryBuilder = queryBuilder.eq('atmosphere_fit_rating', atmosphereRating);
  if (creditRating)     queryBuilder = queryBuilder.eq('credit_rating', creditRating);
  if (tuitionRating)    queryBuilder = queryBuilder.eq('tuition_rating', tuitionRating);

  const { data: allReviewsData, error } = await queryBuilder.returns<ScanRow[]>();

  if (error) {
    console.error('[getReviewsList]', error);
    return { reviews: [], total: 0, page, totalPages: 0, limit };
  }

  if ((allReviewsData?.length ?? 0) >= SCAN_ROW_LIMIT) {
    console.error(
      `[getReviewsList] 走査行数が上限(${SCAN_ROW_LIMIT})に達しました。total とページ数が実際より少なくなります`
    );
  }

  const filtered = (allReviewsData || []).filter((r) => {
    const school = Array.isArray(r.schools) ? r.schools[0] : r.schools;
    if (!school || school.status !== 'active') return false;

    const answers = typeof r.answers === 'string'
      ? (() => {
          try {
            return JSON.parse(r.answers);
          } catch {
            return {};
          }
        })()
      : (r.answers ?? {});

    if (prefecture) {
      const campusPrefecture = (answers as { campus_prefecture?: unknown }).campus_prefecture;
      if (Array.isArray(campusPrefecture)) {
        if (!campusPrefecture.includes(prefecture)) return false;
      } else if (String(campusPrefecture ?? '').trim() !== prefecture) {
        return false;
      }
    }
    if (reasonFilters.length > 0) {
      const reasons = Array.isArray((answers as { reason_for_choosing?: unknown }).reason_for_choosing)
        ? ((answers as { reason_for_choosing: string[] }).reason_for_choosing)
        : [];
      if (!reasonFilters.some((reason) => reasons.includes(reason))) return false;
    }
    return true;
  });

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);
  const reviewIds = paginated.map((r) => r.id);

  if (reviewIds.length === 0) {
    return { reviews: [], total, page, totalPages: Math.ceil(total / limit), limit };
  }

  // 本文などの重いカラムは、実際に表示する分だけ取得する
  const { data: detailRows, error: detailError } = await supabase
    .from('survey_responses')
    .select(`
      id, school_id, school_name, overall_satisfaction, good_comment, bad_comment,
      created_at, enrollment_year, attendance_frequency,
      schools(slug, prefecture)
    `)
    .in('id', reviewIds)
    .returns<DetailRow[]>();

  if (detailError) {
    console.error('[getReviewsList] detail', detailError);
    return { reviews: [], total: 0, page, totalPages: 0, limit };
  }

  const detailById = new Map<string, DetailRow>();
  detailRows?.forEach((row) => detailById.set(row.id, row));

  const likeCounts = new Map<string, number>();
  reviewIds.forEach((id) => likeCounts.set(id, 0));

  const { data: likes } = await supabase
    .from('review_likes')
    .select('review_id')
    .in('review_id', reviewIds);
  likes?.forEach((l: { review_id: string }) => {
    likeCounts.set(l.review_id, (likeCounts.get(l.review_id) || 0) + 1);
  });

  // in() は順序を保証しないため、ページ内の並び順は reviewIds 側で維持する
  const reviews: ReviewListItem[] = reviewIds.flatMap((id) => {
    const r = detailById.get(id);
    if (!r) return [];
    const school = Array.isArray(r.schools) ? r.schools[0] : r.schools;
    return [{
      id: r.id,
      school_id: r.school_id,
      school_name: r.school_name || '',
      school_slug: school?.slug ?? null,
      school_prefecture: school?.prefecture ?? null,
      overall_satisfaction: r.overall_satisfaction ?? 0,
      good_comment: r.good_comment || '',
      bad_comment: r.bad_comment || '',
      enrollment_year: r.enrollment_year,
      attendance_frequency: r.attendance_frequency,
      like_count: likeCounts.get(r.id) || 0,
      created_at: r.created_at || '',
    }];
  });

  return {
    reviews,
    total,
    page,
    totalPages: Math.ceil(total / limit),
    limit,
  };
});
