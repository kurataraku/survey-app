import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';

export interface SchoolById {
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
  intro: string | null;
  highlights: unknown;
  faq: unknown;
  review_count: number;
  overall_avg: number | null;
  staff_rating_avg: number | null;
  atmosphere_fit_rating_avg: number | null;
  credit_rating_avg: number | null;
  tuition_rating_avg: number | null;
  flexibility_rating_avg: number | null;
  support_rating_avg: number | null;
  unique_course_rating_avg: number | null;
  career_support_rating_avg: number | null;
  campus_life_rating_avg: number | null;
  outlier_counts: {
    overall: number;
    staff: number;
    atmosphere: number;
    credit: number;
    tuition: number;
  };
  statistics: {
    respondent_role: { 本人: number; 保護者: number };
    status: Record<string, number>;
    graduation_path: Record<string, number>;
    reason_for_choosing: Record<string, number>;
    enrollment_type: Record<string, number>;
    attendance_frequency: Record<string, number>;
    teaching_style: Record<string, number>;
    student_atmosphere: Record<string, number>;
  };
  latest_reviews: Array<{
    id: string;
    overall_satisfaction: number;
    good_comment: string;
    bad_comment: string;
    created_at: string;
  }>;
}

const toValidRatings = (
  rows: Array<{ answers?: Record<string, unknown> }> | null | undefined,
  key: string
): number[] =>
  rows && rows.length > 0
    ? (rows
        .map((r) => r.answers?.[key])
        .filter(
          (rating): rating is string =>
            rating !== null && rating !== undefined && rating !== '' && rating !== '6'
        )
        .map((r) => parseInt(String(r), 10))
        .filter((r) => !isNaN(r) && r >= 1 && r <= 5) as number[])
    : [];

const averageOrNull = (values: number[]): number | null =>
  values.length > 0
    ? parseFloat((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2))
    : null;

/**
 * IDから学校情報と統計を取得（Server Component用）
 * slugがある場合は/schools/[slug]へリダイレクトすること
 */
export const getSchoolById = cache(async (id: string): Promise<SchoolById | null> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('*')
    .eq('id', id)
    .eq('is_public', true)
    .single();

  if (schoolError || !school) {
    return null;
  }

  const { data: byId } = await supabase
    .from('survey_responses')
    .select('id, overall_satisfaction, good_comment, bad_comment, created_at, respondent_role, status, graduation_path, answers')
    .eq('school_id', id)
    .eq('is_public', true);

  let reviews = byId ?? [];
  if (reviews.length === 0 && school.name) {
    const { data: byName } = await supabase
      .from('survey_responses')
      .select('id, overall_satisfaction, good_comment, bad_comment, created_at, respondent_role, status, graduation_path, answers')
      .eq('school_name', school.name)
      .eq('is_public', true);
    reviews = byName ?? [];
  }

  const reviewList = reviews;
  const reviewCount = reviewList.length;

  const overallValues = reviewList.map((r) => r.overall_satisfaction);
  const validOverallValues = overallValues.filter(
    (v): v is number => v !== null && v !== undefined && v !== 6 && v >= 1 && v <= 5
  );
  const overallOutlierCount = overallValues.filter((v): v is number => v === 6).length;
  const overallAvg =
    validOverallValues.length > 0
      ? parseFloat(
          (validOverallValues.reduce((sum, v) => sum + v, 0) / validOverallValues.length).toFixed(2)
        )
      : null;

  const staffOutlierCount =
    reviewList.filter((r) => r.answers?.staff_rating === '6' || r.answers?.staff_rating === 6)
      .length || 0;
  const atmosphereOutlierCount =
    reviewList.filter(
      (r) =>
        r.answers?.atmosphere_fit_rating === '6' || r.answers?.atmosphere_fit_rating === 6
    ).length || 0;
  const creditOutlierCount =
    reviewList.filter((r) => r.answers?.credit_rating === '6' || r.answers?.credit_rating === 6)
      .length || 0;
  const tuitionOutlierCount =
    reviewList.filter((r) => r.answers?.tuition_rating === '6' || r.answers?.tuition_rating === 6)
      .length || 0;

  const respondentRoleStats = {
    本人: reviewList.filter((r) => r.respondent_role === '本人').length || 0,
    保護者: reviewList.filter((r) => r.respondent_role === '保護者').length || 0,
  };

  const statusStats: Record<string, number> = {};
  reviewList.forEach((r) => {
    if (r.status) {
      statusStats[r.status] = (statusStats[r.status] || 0) + 1;
    }
  });

  const graduationPathStats: Record<string, number> = {};
  reviewList.forEach((r) => {
    if (r.graduation_path) {
      graduationPathStats[r.graduation_path] = (graduationPathStats[r.graduation_path] || 0) + 1;
    }
  });

  const reasonForChoosingStats: Record<string, number> = {};
  reviewList.forEach((r) => {
    const reasons = r.answers?.reason_for_choosing;
    if (Array.isArray(reasons)) {
      reasons.forEach((reason: string) => {
        reasonForChoosingStats[reason] = (reasonForChoosingStats[reason] || 0) + 1;
      });
    }
  });

  const enrollmentTypeStats: Record<string, number> = {};
  reviewList.forEach((r) => {
    const enrollmentType = r.answers?.enrollment_type;
    if (enrollmentType) {
      enrollmentTypeStats[enrollmentType] = (enrollmentTypeStats[enrollmentType] || 0) + 1;
    }
  });

  const attendanceFrequencyStats: Record<string, number> = {};
  reviewList.forEach((r) => {
    const frequency = r.answers?.attendance_frequency;
    if (frequency) {
      attendanceFrequencyStats[frequency] = (attendanceFrequencyStats[frequency] || 0) + 1;
    }
  });

  const teachingStyleStats: Record<string, number> = {};
  reviewList.forEach((r) => {
    const styles = r.answers?.teaching_style;
    if (Array.isArray(styles)) {
      styles.forEach((style: string) => {
        teachingStyleStats[style] = (teachingStyleStats[style] || 0) + 1;
      });
    }
  });

  const studentAtmosphereStats: Record<string, number> = {};
  reviewList.forEach((r) => {
    const atmospheres = r.answers?.student_atmosphere;
    if (Array.isArray(atmospheres)) {
      atmospheres.forEach((atmosphere: string) => {
        studentAtmosphereStats[atmosphere] = (studentAtmosphereStats[atmosphere] || 0) + 1;
      });
    }
  });

  const staffRatings = toValidRatings(reviewList, 'staff_rating');
  const atmosphereRatings = toValidRatings(reviewList, 'atmosphere_fit_rating');
  const creditRatings = toValidRatings(reviewList, 'credit_rating');
  const tuitionRatings = toValidRatings(reviewList, 'tuition_rating');
  const flexibilityRatings = toValidRatings(reviewList, 'flexibility_rating');
  const supportRatings = toValidRatings(reviewList, 'support_rating');
  const uniqueCourseRatings = toValidRatings(reviewList, 'unique_course_rating');
  const careerSupportRatings = toValidRatings(reviewList, 'career_support_rating');
  const campusLifeRatings = toValidRatings(reviewList, 'campus_life_rating');

  const latestReviews = [...reviewList]
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )
    .slice(0, 3)
    .map((r) => ({
      id: r.id,
      overall_satisfaction: r.overall_satisfaction ?? 0,
      good_comment: r.good_comment ?? '',
      bad_comment: r.bad_comment ?? '',
      created_at: r.created_at ?? '',
    }));

  return {
    id: school.id,
    name: school.name,
    prefecture: school.prefecture,
    slug: school.slug || null,
    intro: school.intro,
    highlights: school.highlights,
    faq: school.faq,
    review_count: reviewCount,
    overall_avg: overallAvg,
    staff_rating_avg: averageOrNull(staffRatings),
    atmosphere_fit_rating_avg: averageOrNull(atmosphereRatings),
    credit_rating_avg: averageOrNull(creditRatings),
    tuition_rating_avg: averageOrNull(tuitionRatings),
    flexibility_rating_avg: averageOrNull(flexibilityRatings),
    support_rating_avg: averageOrNull(supportRatings),
    unique_course_rating_avg: averageOrNull(uniqueCourseRatings),
    career_support_rating_avg: averageOrNull(careerSupportRatings),
    campus_life_rating_avg: averageOrNull(campusLifeRatings),
    outlier_counts: {
      overall: overallOutlierCount,
      staff: staffOutlierCount,
      atmosphere: atmosphereOutlierCount,
      credit: creditOutlierCount,
      tuition: tuitionOutlierCount,
    },
    statistics: {
      respondent_role: respondentRoleStats,
      status: statusStats,
      graduation_path: graduationPathStats,
      reason_for_choosing: reasonForChoosingStats,
      enrollment_type: enrollmentTypeStats,
      attendance_frequency: attendanceFrequencyStats,
      teaching_style: teachingStyleStats,
      student_atmosphere: studentAtmosphereStats,
    },
    latest_reviews: latestReviews,
  };
});
