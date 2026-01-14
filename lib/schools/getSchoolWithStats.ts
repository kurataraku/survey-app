import { createAdminSupabaseClient } from '@/lib/supabase/server';

export interface SchoolWithStats {
  id: string;
  name: string;
  prefecture: string;
  slug: string;
  intro: string | null;
  highlights: any;
  faq: any;
  review_count: number;
  overall_avg: number | null;
  staff_rating_avg: number | null;
  atmosphere_fit_rating_avg: number | null;
  credit_rating_avg: number | null;
  tuition_rating_avg: number | null;
  outlier_counts?: {
    overall: number;
    staff: number;
    atmosphere: number;
    credit: number;
    tuition: number;
  };
  flexibility_rating_avg?: number | null;
  support_rating_avg?: number | null;
  unique_course_rating_avg?: number | null;
  career_support_rating_avg?: number | null;
  campus_life_rating_avg?: number | null;
  prefectures?: string[] | null;
  global_averages?: {
    flexibility_rating_avg: number | null;
    staff_rating_avg: number | null;
    support_rating_avg: number | null;
    atmosphere_fit_rating_avg: number | null;
    credit_rating_avg: number | null;
    unique_course_rating_avg: number | null;
    career_support_rating_avg: number | null;
    campus_life_rating_avg: number | null;
    tuition_rating_avg: number | null;
  };
  statistics?: {
    respondent_role: { 本人: number; 保護者: number };
    status: { 在籍中: number; 卒業した: number; '以前在籍していた（転校・退学など）': number };
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
    like_count?: number;
  }>;
  ai_summary?: {
    summary_text: string;
    meta_title: string | null;
    meta_description: string | null;
  } | null;
}

/**
 * slugから学校情報と統計、AI要約を取得（Server Component用）
 */
export async function getSchoolWithStats(slug: string): Promise<SchoolWithStats | null> {
  const supabase = createAdminSupabaseClient();

  // slugをデコード
  let decodedSlug = slug;
  if (slug.includes('%')) {
    try {
      decodedSlug = decodeURIComponent(slug);
    } catch (e) {
      // デコードに失敗した場合はそのまま使用
    }
  }

  // 学校情報を取得
  const { data: school, error: schoolError } = await supabase
    .from('schools')
    .select('*')
    .eq('slug', decodedSlug)
    .eq('is_public', true)
    .eq('status', 'active')
    .single();

  if (schoolError || !school) {
    return null;
  }

  // AI要約を取得（publishedのみ）
  const { data: aiSummary } = await supabase
    .from('school_ai_summaries')
    .select('summary_text, meta_title, meta_description')
    .eq('school_id', school.id)
    .eq('kind', 'overall')
    .is('topic', null)
    .eq('status', 'published')
    .single();

  // 口コミ数を取得
  const { count: reviewCount } = await supabase
    .from('survey_responses')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', school.id);

  // 評価の平均値を計算
  const { data: reviews } = await supabase
    .from('survey_responses')
    .select('overall_satisfaction, answers')
    .eq('school_id', school.id);

  // overall_satisfactionの平均と外れ値件数を計算
  const overallValues = reviews?.map((r) => r.overall_satisfaction) || [];
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

  // answers JSONBから評価データを取得
  const toValidRatings = (rows: any[] | null | undefined, key: string) =>
    rows && rows.length > 0
      ? rows
          .map((r) => r.answers?.[key])
          .filter(
            (rating: any): rating is string =>
              rating !== null && rating !== undefined && rating !== '' && rating !== '6'
          )
          .map((r: string) => parseInt(r, 10))
          .filter((r: number) => !isNaN(r) && r >= 1 && r <= 5)
      : [];

  const staffRatings = toValidRatings(reviews, 'staff_rating');
  const atmosphereRatings = toValidRatings(reviews, 'atmosphere_fit_rating');
  const creditRatings = toValidRatings(reviews, 'credit_rating');
  const tuitionRatings = toValidRatings(reviews, 'tuition_rating');
  const flexibilityRatings = toValidRatings(reviews, 'flexibility_rating');
  const supportRatings = toValidRatings(reviews, 'support_rating');
  const uniqueCourseRatings = toValidRatings(reviews, 'unique_course_rating');
  const careerSupportRatings = toValidRatings(reviews, 'career_support_rating');
  const campusLifeRatings = toValidRatings(reviews, 'campus_life_rating');

  const staffOutlierCount =
    reviews?.filter((r) => r.answers?.staff_rating === '6' || r.answers?.staff_rating === 6)
      .length || 0;
  const atmosphereOutlierCount =
    reviews?.filter(
      (r) =>
        r.answers?.atmosphere_fit_rating === '6' || r.answers?.atmosphere_fit_rating === 6
    ).length || 0;
  const creditOutlierCount =
    reviews?.filter((r) => r.answers?.credit_rating === '6' || r.answers?.credit_rating === 6)
      .length || 0;
  const tuitionOutlierCount =
    reviews?.filter((r) => r.answers?.tuition_rating === '6' || r.answers?.tuition_rating === 6)
      .length || 0;

  const averageOrNull = (values: number[]) =>
    values.length > 0
      ? parseFloat((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2))
      : null;

  const staffRatingAvg = averageOrNull(staffRatings);
  const atmosphereFitRatingAvg = averageOrNull(atmosphereRatings);
  const creditRatingAvg = averageOrNull(creditRatings);
  const tuitionRatingAvg = averageOrNull(tuitionRatings);
  const flexibilityRatingAvg = averageOrNull(flexibilityRatings);
  const supportRatingAvg = averageOrNull(supportRatings);
  const uniqueCourseRatingAvg = averageOrNull(uniqueCourseRatings);
  const careerSupportRatingAvg = averageOrNull(careerSupportRatings);
  const campusLifeRatingAvg = averageOrNull(campusLifeRatings);

  // サイト全体の評価平均を計算
  const { data: allGlobalReviews } = await supabase
    .from('survey_responses')
    .select('overall_satisfaction, answers');

  const globalFlexibilityRatings = toValidRatings(allGlobalReviews, 'flexibility_rating');
  const globalStaffRatings = toValidRatings(allGlobalReviews, 'staff_rating');
  const globalSupportRatings = toValidRatings(allGlobalReviews, 'support_rating');
  const globalAtmosphereRatings = toValidRatings(allGlobalReviews, 'atmosphere_fit_rating');
  const globalCreditRatings = toValidRatings(allGlobalReviews, 'credit_rating');
  const globalUniqueCourseRatings = toValidRatings(allGlobalReviews, 'unique_course_rating');
  const globalCareerSupportRatings = toValidRatings(allGlobalReviews, 'career_support_rating');
  const globalCampusLifeRatings = toValidRatings(allGlobalReviews, 'campus_life_rating');
  const globalTuitionRatings = toValidRatings(allGlobalReviews, 'tuition_rating');

  const globalFlexibilityRatingAvg = averageOrNull(globalFlexibilityRatings);
  const globalStaffRatingAvg = averageOrNull(globalStaffRatings);
  const globalSupportRatingAvg = averageOrNull(globalSupportRatings);
  const globalAtmosphereFitRatingAvg = averageOrNull(globalAtmosphereRatings);
  const globalCreditRatingAvg = averageOrNull(globalCreditRatings);
  const globalUniqueCourseRatingAvg = averageOrNull(globalUniqueCourseRatings);
  const globalCareerSupportRatingAvg = averageOrNull(globalCareerSupportRatings);
  const globalCampusLifeRatingAvg = averageOrNull(globalCampusLifeRatings);
  const globalTuitionRatingAvg = averageOrNull(globalTuitionRatings);

  // 統計情報を取得
  const { data: allReviewsForStats } = await supabase
    .from('survey_responses')
    .select('respondent_role, status, graduation_path, answers')
    .eq('school_id', school.id);

  const respondentRoleStats = {
    本人: allReviewsForStats?.filter((r) => r.respondent_role === '本人').length || 0,
    保護者: allReviewsForStats?.filter((r) => r.respondent_role === '保護者').length || 0,
  };

  const statusStats = {
    在籍中: allReviewsForStats?.filter((r) => r.status === '在籍中').length || 0,
    卒業した: allReviewsForStats?.filter((r) => r.status === '卒業した').length || 0,
    '以前在籍していた（転校・退学など）':
      allReviewsForStats?.filter((r) => r.status === '以前在籍していた（転校・退学など）')
        .length || 0,
  };

  const graduationPathStats: Record<string, number> = {};
  allReviewsForStats?.forEach((r) => {
    if (r.graduation_path) {
      graduationPathStats[r.graduation_path] =
        (graduationPathStats[r.graduation_path] || 0) + 1;
    }
  });

  const reasonForChoosingStats: Record<string, number> = {};
  allReviewsForStats?.forEach((r) => {
    const reasons = r.answers?.reason_for_choosing;
    if (Array.isArray(reasons)) {
      reasons.forEach((reason: string) => {
        reasonForChoosingStats[reason] = (reasonForChoosingStats[reason] || 0) + 1;
      });
    }
  });

  const enrollmentTypeStats: Record<string, number> = {};
  allReviewsForStats?.forEach((r) => {
    const enrollmentType = r.answers?.enrollment_type;
    if (enrollmentType) {
      enrollmentTypeStats[enrollmentType] = (enrollmentTypeStats[enrollmentType] || 0) + 1;
    }
  });

  const attendanceFrequencyStats: Record<string, number> = {};
  allReviewsForStats?.forEach((r) => {
    const frequency = r.answers?.attendance_frequency;
    if (frequency) {
      attendanceFrequencyStats[frequency] = (attendanceFrequencyStats[frequency] || 0) + 1;
    }
  });

  const teachingStyleStats: Record<string, number> = {};
  allReviewsForStats?.forEach((r) => {
    const styles = r.answers?.teaching_style;
    if (Array.isArray(styles)) {
      styles.forEach((style: string) => {
        teachingStyleStats[style] = (teachingStyleStats[style] || 0) + 1;
      });
    }
  });

  const studentAtmosphereStats: Record<string, number> = {};
  allReviewsForStats?.forEach((r) => {
    const atmospheres = r.answers?.student_atmosphere;
    if (Array.isArray(atmospheres)) {
      atmospheres.forEach((atmosphere: string) => {
        studentAtmosphereStats[atmosphere] = (studentAtmosphereStats[atmosphere] || 0) + 1;
      });
    }
  });

  // すべての口コミを取得して、いいね数でソート
  const { data: allReviews } = await supabase
    .from('survey_responses')
    .select('id, overall_satisfaction, good_comment, bad_comment, created_at')
    .eq('school_id', school.id);

  // 各口コミのいいね数を取得
  const reviewsWithLikes = await Promise.all(
    (allReviews || []).map(async (review) => {
      let likeCount = 0;
      try {
        const { count } = await supabase
          .from('review_likes')
          .select('*', { count: 'exact', head: true })
          .eq('review_id', review.id);

        likeCount = count || 0;
      } catch (error) {
        // review_likesテーブルが存在しない場合は0を返す
      }
      return {
        ...review,
        like_count: likeCount,
      };
    })
  );

  // いいね数順でソートして上位3件を取得
  const latestReviews = reviewsWithLikes
    .sort((a, b) => b.like_count - a.like_count)
    .slice(0, 3);

  return {
    id: school.id,
    name: school.name,
    prefecture: school.prefecture,
    prefectures: school.prefectures || (school.prefecture ? [school.prefecture] : []),
    slug: school.slug,
    intro: school.intro,
    highlights: school.highlights,
    faq: school.faq,
    review_count: reviewCount || 0,
    overall_avg: overallAvg,
    staff_rating_avg: staffRatingAvg,
    atmosphere_fit_rating_avg: atmosphereFitRatingAvg,
    credit_rating_avg: creditRatingAvg,
    tuition_rating_avg: tuitionRatingAvg,
    outlier_counts: {
      overall: overallOutlierCount,
      staff: staffOutlierCount,
      atmosphere: atmosphereOutlierCount,
      credit: creditOutlierCount,
      tuition: tuitionOutlierCount,
    },
    latest_reviews: latestReviews?.map((review) => ({
      id: review.id,
      overall_satisfaction: review.overall_satisfaction,
      good_comment: review.good_comment,
      bad_comment: review.bad_comment,
      created_at: review.created_at,
      like_count: review.like_count || 0,
    })) || [],
    flexibility_rating_avg: flexibilityRatingAvg,
    support_rating_avg: supportRatingAvg,
    unique_course_rating_avg: uniqueCourseRatingAvg,
    career_support_rating_avg: careerSupportRatingAvg,
    campus_life_rating_avg: campusLifeRatingAvg,
    global_averages: {
      flexibility_rating_avg: globalFlexibilityRatingAvg,
      staff_rating_avg: globalStaffRatingAvg,
      support_rating_avg: globalSupportRatingAvg,
      atmosphere_fit_rating_avg: globalAtmosphereFitRatingAvg,
      credit_rating_avg: globalCreditRatingAvg,
      unique_course_rating_avg: globalUniqueCourseRatingAvg,
      career_support_rating_avg: globalCareerSupportRatingAvg,
      campus_life_rating_avg: globalCampusLifeRatingAvg,
      tuition_rating_avg: globalTuitionRatingAvg,
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
    ai_summary: aiSummary
      ? {
          summary_text: aiSummary.summary_text,
          meta_title: aiSummary.meta_title,
          meta_description: aiSummary.meta_description,
        }
      : null,
  };
}
