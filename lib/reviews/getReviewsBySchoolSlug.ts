import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  publicSurveyResponsesOrFilter,
  shouldIncludeSurveyOnSchoolHubPage,
} from '@/lib/reviews/schoolReviewLinkage';

export interface ReviewListItem {
  id: string;
  school_id: string | null;
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

/** PostgREST が1リクエストで返す行数の上限。到達すると件数・ページ数が不足するため検知する */
const SCAN_ROW_LIMIT = 1000;

type ScanRow = {
  id: string;
  school_id: string | null;
  school_name: string | null;
  created_at: string | null;
  overall_satisfaction: number | null;
  schools: { id?: string; status?: string } | { id?: string; status?: string }[] | null;
  answers?: unknown;
};

type DetailRow = {
  id: string;
  school_id: string | null;
  school_name: string | null;
  overall_satisfaction: number | null;
  good_comment: string | null;
  bad_comment: string | null;
  created_at: string | null;
  enrollment_year: number | null;
  attendance_frequency: string | null;
  schools: { slug?: string | null } | { slug?: string | null }[] | null;
};

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

    // 学校ID・名前・slugを取得（status='active'のみ）
    const { data: school } = await supabase
      .from('schools')
      .select('id, name, slug')
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
    const schoolPageSlug = school.slug;

    // answers は絞り込みにしか使わないため、絞り込み指定がなければ取得しない
    // （enrollment_type / attendance_frequency は PostgREST 側で絞り込むため不要）
    const needsAnswers =
      Boolean(campusPrefecture) || (reasonForChoosingArray?.length ?? 0) > 0;

    const scanSelect = `
        id,
        school_id,
        school_name,
        created_at,
        overall_satisfaction,
        schools(id, status)${needsAnswers ? ',\n        answers' : ''}
      `;

    const attachOptionalFilters = (q: any) => {
      let out = q;
      if (role) out = out.eq('respondent_role', role);
      if (graduationPath) out = out.eq('graduation_path', graduationPath);
      if (enrollmentType) out = out.eq('answers->>enrollment_type', enrollmentType);
      if (attendanceFrequency) out = out.eq('answers->>attendance_frequency', attendanceFrequency);
      return out;
    };

    let orderColumn: 'created_at' | 'overall_satisfaction' = 'created_at';
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

    const listQuery = attachOptionalFilters(
      supabase
        .from('survey_responses')
        .select(scanSelect)
        .eq('is_public', true)
        .or(publicSurveyResponsesOrFilter(schoolId, schoolName))
    );

    const { data: rawData, error: listErr } = await listQuery.order(orderColumn, {
      ascending: orderAscending,
    });

    if (listErr) {
      console.error('レビュー取得エラー:', listErr);
      return {
        reviews: [],
        total: 0,
        totalBeforeFilter: 0,
        page,
        totalPages: 0,
        limit,
        schoolName,
      };
    }

    const rawRows = (rawData ?? []) as ScanRow[];

    if (rawRows.length >= SCAN_ROW_LIMIT) {
      console.error(
        `[getReviewsBySchoolSlug] 走査行数が上限(${SCAN_ROW_LIMIT})に達しました。total とページ数が実際より少なくなります`
      );
    }

    const hubFiltered = rawRows.filter((r) =>
      shouldIncludeSurveyOnSchoolHubPage(r, schoolId, schoolName)
    );

    const totalCountBeforeFilter = hubFiltered.length;

    const merged = [...hubFiltered].sort((a, b) => {
      if (orderColumn === 'created_at') {
        const cmp = String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));
        return orderAscending ? cmp : -cmp;
      }
      const na = Number(a.overall_satisfaction ?? 0);
      const nb = Number(b.overall_satisfaction ?? 0);
      const cmp = na - nb;
      return orderAscending ? cmp : -cmp;
    });

    const filteredReviews = merged.filter((review) => {
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
    const reviewIds = paginatedReviews.map((review) => review.id);

    if (reviewIds.length === 0) {
      return {
        reviews: [],
        total: totalCount || 0,
        totalBeforeFilter: totalCountBeforeFilter || 0,
        page,
        totalPages: Math.ceil((totalCount || 0) / limit),
        limit,
        schoolName,
      };
    }

    // 本文などの重いカラムは、実際に表示する分だけ取得する
    const { data: detailRows, error: detailErr } = await supabase
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
        schools(slug)
      `)
      .in('id', reviewIds)
      .returns<DetailRow[]>();

    if (detailErr) {
      console.error('レビュー本文取得エラー:', detailErr);
      return {
        reviews: [],
        total: 0,
        totalBeforeFilter: 0,
        page,
        totalPages: 0,
        limit,
        schoolName,
      };
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
      const review = detailById.get(id);
      if (!review) return [];
      const schoolJoin = Array.isArray(review.schools) ? review.schools[0] : review.schools;

      return [{
        id: review.id,
        school_id: review.school_id ?? null,
        school_name: review.school_name as string,
        school_slug: schoolJoin?.slug ?? schoolPageSlug,
        overall_satisfaction: review.overall_satisfaction,
        good_comment: review.good_comment,
        bad_comment: review.bad_comment,
        enrollment_year: review.enrollment_year,
        attendance_frequency: review.attendance_frequency,
        created_at: review.created_at,
        like_count: likeCounts.get(review.id) || 0,
      } as ReviewListItem];
    });

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
