import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

export interface ReviewData {
  id: string;
  school_id: string | null;
  school_name: string;
  school_slug: string | null;
  respondent_role: string;
  status: string;
  graduation_path?: string | null;
  graduation_path_other?: string | null;
  overall_satisfaction: number;
  good_comment: string;
  bad_comment: string;
  reason_for_choosing: string[];
  course?: string | null;
  enrollment_type?: string | null;
  enrollment_year?: string | null;
  attendance_frequency?: string | null;
  campus_prefecture?: string | null;
  teaching_style: string[];
  student_atmosphere: string[];
  atmosphere_other?: string | null;
  flexibility_rating?: number | null;
  staff_rating?: number | null;
  support_rating?: number | null;
  atmosphere_fit_rating?: number | null;
  credit_rating?: number | null;
  unique_course_rating?: number | null;
  career_support_rating?: number | null;
  campus_life_rating?: number | null;
  tuition_rating?: number | null;
  like_count: number;
  is_liked: boolean;
  created_at: string;
  outlier_counts: {
    overall: number;
    staff: number;
    atmosphere: number;
    credit: number;
    tuition: number;
  };
}

const parseRating = (rating: unknown): number | null => {
  try {
    if (rating === null || rating === undefined || rating === '' || rating === '6' || rating === 6) {
      return null;
    }
    const num = typeof rating === 'string' ? parseInt(rating, 10) : Number(rating);
    return !isNaN(num) && num >= 1 && num <= 5 ? num : null;
  } catch {
    return null;
  }
};

/**
 * 口コミ1件を取得（Server Component / API 共通）
 * cache() により同一リクエスト内での重複取得を防ぐ
 */
export const getReviewById = cache(
  async (
    reviewId: string,
    options?: { request?: NextRequest; requirePublic?: boolean }
  ): Promise<ReviewData | null> => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return null;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const requirePublic = options?.requirePublic ?? true;

    const baseSelect = `
        id,
        school_id,
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
      `;

    let result = requirePublic
      ? await supabase
          .from('survey_responses')
          .select(baseSelect)
          .eq('id', reviewId)
          .eq('is_public', true)
          .single()
      : await supabase
          .from('survey_responses')
          .select(baseSelect)
          .eq('id', reviewId)
          .single();

    if (result.error?.code === '42703' && requirePublic) {
      result = await supabase
        .from('survey_responses')
        .select(baseSelect)
        .eq('id', reviewId)
        .single();
    }

    const { data: review, error: reviewError } = result;

    if (reviewError || !review) {
      return null;
    }

    let schoolSlug: string | null = null;
    let schoolName = review.school_name;
    if (review.school_id) {
      try {
        const { data: school } = await supabase
          .from('schools')
          .select('slug, name, status, is_public')
          .eq('id', review.school_id)
          .single();
        if (school) {
          if (requirePublic && (school.status !== 'active' || !school.is_public)) {
            return null;
          }
          schoolSlug = school.slug || null;
          schoolName = school.name;
        }
      } catch {
        // ignore
      }
    } else if (review.school_name) {
      try {
        const { data: school } = await supabase
          .from('schools')
          .select('slug, name, status, is_public')
          .eq('name', review.school_name)
          .single();
        if (school) {
          if (requirePublic && (school.status !== 'active' || !school.is_public)) {
            return null;
          }
          schoolSlug = school.slug || null;
          schoolName = school.name;
        }
      } catch {
        // ignore
      }
    }

    let likeCount = 0;
    let userLikeCount = 0;
    try {
      const request = options?.request;
      const clientIp = request
        ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          'unknown'
        : 'unknown';

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
    } catch {
      // review_likes が存在しない場合
    }

    let answers: Record<string, unknown> = {};
    try {
      if (review.answers) {
        answers =
          typeof review.answers === 'string'
            ? JSON.parse(review.answers)
            : review.answers;
      }
    } catch {
      answers = {};
    }

    let outlierCounts = {
      overall: 0,
      staff: 0,
      atmosphere: 0,
      credit: 0,
      tuition: 0,
    };

    if (review.school_name) {
      try {
        const { data: allReviews } = await supabase
          .from('survey_responses')
          .select('overall_satisfaction, answers')
          .eq('school_name', review.school_name);

        if (allReviews) {
          outlierCounts.overall = allReviews.filter(
            (r) => r.overall_satisfaction === 6
          ).length;
          outlierCounts.staff = allReviews.filter((r) => {
            const a =
              typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers || {};
            return a?.staff_rating === '6' || a?.staff_rating === 6;
          }).length;
          outlierCounts.atmosphere = allReviews.filter((r) => {
            const a =
              typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers || {};
            return a?.atmosphere_fit_rating === '6' || a?.atmosphere_fit_rating === 6;
          }).length;
          outlierCounts.credit = allReviews.filter((r) => {
            const a =
              typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers || {};
            return a?.credit_rating === '6' || a?.credit_rating === 6;
          }).length;
          outlierCounts.tuition = allReviews.filter((r) => {
            const a =
              typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers || {};
            return a?.tuition_rating === '6' || a?.tuition_rating === 6;
          }).length;
        }
      } catch {
        // ignore
      }
    }

    return {
      id: review.id,
      school_id: review.school_id || null,
      school_name: schoolName,
      school_slug: schoolSlug,
      respondent_role: review.respondent_role,
      status: review.status,
      graduation_path: review.graduation_path,
      graduation_path_other: review.graduation_path_other,
      overall_satisfaction: review.overall_satisfaction,
      good_comment: review.good_comment,
      bad_comment: review.bad_comment,
      reason_for_choosing: Array.isArray(answers.reason_for_choosing)
        ? answers.reason_for_choosing
        : [],
      course: (answers.course as string) || null,
      enrollment_type: (answers.enrollment_type as string) || null,
      enrollment_year: (answers.enrollment_year as string) || null,
      attendance_frequency: (answers.attendance_frequency as string) || null,
      campus_prefecture: (answers.campus_prefecture as string) || null,
      teaching_style: Array.isArray(answers.teaching_style)
        ? answers.teaching_style
        : [],
      student_atmosphere: Array.isArray(answers.student_atmosphere)
        ? answers.student_atmosphere
        : [],
      atmosphere_other: (answers.atmosphere_other as string) || null,
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
    };
  }
);
