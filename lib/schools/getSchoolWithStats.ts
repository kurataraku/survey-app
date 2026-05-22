import { cache } from 'react';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { unstable_cache } from 'next/cache';
import {
  publicSurveyResponsesOrFilter,
  shouldIncludeSurveyOnSchoolHubPage,
} from '@/lib/reviews/schoolReviewLinkage';
import type { SchoolCampusLocation } from '@/lib/types/schools';

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
  campus_locations?: SchoolCampusLocation[] | null;
  global_averages?: {
    overall_satisfaction_avg: number | null;
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
  /** 公開済みSEO本文（topic -> 本文） */
  seo_sections?: Record<string, string>;
  /** 公開済みFAQ（Q&A配列） */
  faq_items?: Array<{ question: string; answer: string }>;
  /** 公開済み「良い点・改善してほしい点の傾向」（LLM要約3箇条ずつ） */
  review_tendency?: { good_points: string[]; improvement_points: string[] } | null;
}

/** サイト全体の評価平均（1時間キャッシュ） */
async function getGlobalAverages() {
  const supabase = createAdminSupabaseClient();
  const { data: allGlobalReviews } = await supabase
    .from('survey_responses')
    .select('overall_satisfaction, answers');

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

  const averageOrNull = (values: number[]) =>
    values.length > 0
      ? parseFloat((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2))
      : null;

  const parseOverall = (v: unknown): number | null => {
    const n = typeof v === 'string' ? parseInt(v, 10) : typeof v === 'number' ? v : NaN;
    return !isNaN(n) && n >= 1 && n <= 5 && n !== 6 ? n : null;
  };

  const validGlobalOverall =
    allGlobalReviews && allGlobalReviews.length > 0
      ? allGlobalReviews.map((r) => parseOverall(r.overall_satisfaction)).filter((v): v is number => v !== null)
      : [];

  return {
    overall_satisfaction_avg: averageOrNull(validGlobalOverall),
    flexibility_rating_avg: averageOrNull(toValidRatings(allGlobalReviews, 'flexibility_rating')),
    staff_rating_avg: averageOrNull(toValidRatings(allGlobalReviews, 'staff_rating')),
    support_rating_avg: averageOrNull(toValidRatings(allGlobalReviews, 'support_rating')),
    atmosphere_fit_rating_avg: averageOrNull(
      toValidRatings(allGlobalReviews, 'atmosphere_fit_rating')
    ),
    credit_rating_avg: averageOrNull(toValidRatings(allGlobalReviews, 'credit_rating')),
    unique_course_rating_avg: averageOrNull(toValidRatings(allGlobalReviews, 'unique_course_rating')),
    career_support_rating_avg: averageOrNull(
      toValidRatings(allGlobalReviews, 'career_support_rating')
    ),
    campus_life_rating_avg: averageOrNull(toValidRatings(allGlobalReviews, 'campus_life_rating')),
    tuition_rating_avg: averageOrNull(toValidRatings(allGlobalReviews, 'tuition_rating')),
  };
}

export const getCachedGlobalAverages = unstable_cache(
  getGlobalAverages,
  ['global-averages-v2'],
  { revalidate: 3600 }
);

/**
 * slugから学校情報と統計、AI要約を取得（Server Component用）
 * React cacheでgenerateMetadataとpage間の二重呼び出しを防止
 */
export const getSchoolWithStats = cache(async (slug: string): Promise<SchoolWithStats | null> => {
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

  // 1. 学校情報を取得
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

  const campusLocations = Array.isArray(school.campus_locations)
    ? school.campus_locations
        .map((location: unknown) => {
          if (!location || typeof location !== 'object') return null;
          const record = location as Record<string, unknown>;
          const prefecture = typeof record.prefecture === 'string' ? record.prefecture.trim() : '';
          const city = typeof record.city === 'string' ? record.city.trim() : '';
          return prefecture && city ? { prefecture, city } : null;
        })
        .filter((location: SchoolCampusLocation | null): location is SchoolCampusLocation =>
          Boolean(location)
        )
    : null;

  const reviewSelect =
    'id, school_id, school_name, overall_satisfaction, good_comment, bad_comment, created_at, respondent_role, status, graduation_path, answers, schools(id, status)';

  // 2. AI要約・SEO本文・良い点・改善点傾向・口コミデータ・グローバル平均を並列取得
  const [aiSummaryResult, seoSectionsResult, reviewTendencyResult, rawReviewsResult, globalAverages] =
    await Promise.all([
      supabase
        .from('school_ai_summaries')
        .select('summary_text, meta_title, meta_description')
        .eq('school_id', school.id)
        .eq('kind', 'overall')
        .is('topic', null)
        .eq('status', 'published')
        .single(),
      supabase
        .from('school_ai_summaries')
        .select('topic, summary_text')
        .eq('school_id', school.id)
        .eq('kind', 'seo')
        .eq('status', 'published'),
      supabase
        .from('school_ai_summaries')
        .select('summary_text')
        .eq('school_id', school.id)
        .eq('kind', 'review_tendency')
        .is('topic', null)
        .eq('status', 'published')
        .maybeSingle(),
      supabase
        .from('survey_responses')
        .select(reviewSelect)
        .eq('is_public', true)
        .or(publicSurveyResponsesOrFilter(school.id, school.name)),
      getCachedGlobalAverages(),
    ]);

  const resolvedAiSummary = aiSummaryResult.data;
  const seoSectionsRows = seoSectionsResult.data ?? [];
  const reviewTendencyRow = reviewTendencyResult.data;

  if (rawReviewsResult.error) {
    console.error('[getSchoolWithStats] survey_responses:', rawReviewsResult.error);
  }

  const reviews = (rawReviewsResult.data ?? []).filter((r) =>
    shouldIncludeSurveyOnSchoolHubPage(r, school.id, school.name)
  );
  const reviewCount = reviews.length;

  // overall_satisfactionの平均と外れ値件数を計算
  const overallValues = reviews.map((r) => r.overall_satisfaction);
  const validOverallValues = overallValues.filter(
    (v): v is number => v !== null && v !== undefined && v !== 6 && v >= 1 && v <= 5
  );
  const overallOutlierCount = overallValues.filter((v): v is number => v === 6).length;
  const overallAvg =
    validOverallValues.length > 0
      ? parseFloat(
          (validOverallValues.reduce((sum, v) => sum + v, 0) / validOverallValues.length).toFixed(
            2
          )
        )
      : null;

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
    reviews.filter((r) => r.answers?.staff_rating === '6' || r.answers?.staff_rating === 6)
      .length || 0;
  const atmosphereOutlierCount =
    reviews.filter(
      (r) =>
        r.answers?.atmosphere_fit_rating === '6' || r.answers?.atmosphere_fit_rating === 6
    ).length || 0;
  const creditOutlierCount =
    reviews.filter((r) => r.answers?.credit_rating === '6' || r.answers?.credit_rating === 6)
      .length || 0;
  const tuitionOutlierCount =
    reviews.filter((r) => r.answers?.tuition_rating === '6' || r.answers?.tuition_rating === 6)
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

  // 4. いいね数を1クエリで一括取得（N+1解消）
  const reviewIds = reviews.map((r) => r.id);
  let likesMap: Record<string, number> = {};
  if (reviewIds.length > 0) {
    const { data: likesData } = await supabase
      .from('review_likes')
      .select('review_id')
      .in('review_id', reviewIds);

    likesData?.forEach((like) => {
      likesMap[like.review_id] = (likesMap[like.review_id] || 0) + 1;
    });
  }

  const reviewsWithLikes = reviews.map((r) => ({
    ...r,
    like_count: likesMap[r.id] || 0,
  }));

  const latestReviews = reviewsWithLikes
    .sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      overall_satisfaction: r.overall_satisfaction,
      good_comment: r.good_comment,
      bad_comment: r.bad_comment,
      created_at: r.created_at,
      like_count: r.like_count || 0,
    }));

  // 統計情報（reviewsから集計）
  const respondentRoleStats = {
    本人: reviews.filter((r) => r.respondent_role === '本人').length || 0,
    保護者: reviews.filter((r) => r.respondent_role === '保護者').length || 0,
  };

  const statusStats = {
    在籍中: reviews.filter((r) => r.status === '在籍中').length || 0,
    卒業した: reviews.filter((r) => r.status === '卒業した').length || 0,
    '以前在籍していた（転校・退学など）':
      reviews.filter((r) => r.status === '以前在籍していた（転校・退学など）').length || 0,
  };

  const graduationPathStats: Record<string, number> = {};
  reviews.forEach((r) => {
    if (r.graduation_path) {
      graduationPathStats[r.graduation_path] =
        (graduationPathStats[r.graduation_path] || 0) + 1;
    }
  });

  const reasonForChoosingStats: Record<string, number> = {};
  reviews.forEach((r) => {
    const reasons = r.answers?.reason_for_choosing;
    if (Array.isArray(reasons)) {
      reasons.forEach((reason: string) => {
        reasonForChoosingStats[reason] = (reasonForChoosingStats[reason] || 0) + 1;
      });
    }
  });

  const enrollmentTypeStats: Record<string, number> = {};
  reviews.forEach((r) => {
    const enrollmentType = r.answers?.enrollment_type;
    if (enrollmentType) {
      enrollmentTypeStats[enrollmentType] = (enrollmentTypeStats[enrollmentType] || 0) + 1;
    }
  });

  const attendanceFrequencyStats: Record<string, number> = {};
  reviews.forEach((r) => {
    const frequency = r.answers?.attendance_frequency;
    if (frequency) {
      attendanceFrequencyStats[frequency] = (attendanceFrequencyStats[frequency] || 0) + 1;
    }
  });

  const teachingStyleStats: Record<string, number> = {};
  reviews.forEach((r) => {
    const styles = r.answers?.teaching_style;
    if (Array.isArray(styles)) {
      styles.forEach((style: string) => {
        teachingStyleStats[style] = (teachingStyleStats[style] || 0) + 1;
      });
    }
  });

  const studentAtmosphereStats: Record<string, number> = {};
  reviews.forEach((r) => {
    const atmospheres = r.answers?.student_atmosphere;
    if (Array.isArray(atmospheres)) {
      atmospheres.forEach((atmosphere: string) => {
        studentAtmosphereStats[atmosphere] = (studentAtmosphereStats[atmosphere] || 0) + 1;
      });
    }
  });

  return {
    id: school.id,
    name: school.name,
    prefecture: school.prefecture,
    prefectures: school.prefectures || (school.prefecture ? [school.prefecture] : []),
    campus_locations: campusLocations && campusLocations.length > 0 ? campusLocations : null,
    slug: school.slug,
    intro: school.intro,
    highlights: school.highlights,
    faq: school.faq,
    review_count: reviewCount,
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
    latest_reviews: latestReviews,
    flexibility_rating_avg: flexibilityRatingAvg,
    support_rating_avg: supportRatingAvg,
    unique_course_rating_avg: uniqueCourseRatingAvg,
    career_support_rating_avg: careerSupportRatingAvg,
    campus_life_rating_avg: campusLifeRatingAvg,
    global_averages: globalAverages,
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
    ai_summary: resolvedAiSummary
      ? {
          summary_text: resolvedAiSummary.summary_text,
          meta_title: resolvedAiSummary.meta_title,
          meta_description: resolvedAiSummary.meta_description,
        }
      : null,
    seo_sections: (() => {
      const map: Record<string, string> = {};
      for (const row of seoSectionsRows) {
        if (row.topic && row.topic !== 'faq') map[row.topic] = row.summary_text;
      }
      return Object.keys(map).length > 0 ? map : undefined;
    })(),
    faq_items: (() => {
      const faqRow = seoSectionsRows.find((r) => r.topic === 'faq');
      if (!faqRow?.summary_text) return undefined;
      try {
        const arr = JSON.parse(faqRow.summary_text) as Array<{ question: string; answer: string }>;
        return Array.isArray(arr) && arr.length > 0 ? arr : undefined;
      } catch {
        return undefined;
      }
    })(),
    review_tendency: (() => {
      if (!reviewTendencyRow?.summary_text) return undefined;
      try {
        const parsed = JSON.parse(reviewTendencyRow.summary_text) as {
          good_points?: string[];
          improvement_points?: string[];
        };
        const good = Array.isArray(parsed.good_points) ? parsed.good_points.slice(0, 3) : [];
        const improvement = Array.isArray(parsed.improvement_points) ? parsed.improvement_points.slice(0, 3) : [];
        return good.length > 0 || improvement.length > 0 ? { good_points: good, improvement_points: improvement } : undefined;
      } catch {
        return undefined;
      }
    })(),
  };
});
