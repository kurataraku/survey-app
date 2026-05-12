import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getCachedGlobalAverages } from '@/lib/schools/getSchoolWithStats';
import { getSearchSchoolsByIds } from '@/lib/schools/searchSchools';

/** 学校カードの「サイト平均との差」表示用（1時間キャッシュ） */
export type SchoolCardGlobalAverages = {
  overall_satisfaction_avg: number | null;
  staff_rating_avg: number | null;
  atmosphere_fit_rating_avg: number | null;
  credit_rating_avg: number | null;
  tuition_rating_avg: number | null;
};

export interface HomeData {
  topRankedSchools: Array<{
    id: string;
    name: string;
    prefecture: string;
    prefectures?: string[] | null;
    slug: string | null;
    review_count: number;
    overall_avg: number | null;
  }>;
  popularSchools: Array<{
    id: string;
    name: string;
    prefecture: string;
    prefectures?: string[] | null;
    slug: string | null;
    review_count: number;
    overall_avg: number | null;
    staff_avg?: number | null;
    atmosphere_avg?: number | null;
    credit_avg?: number | null;
    tuition_avg?: number | null;
    latest_good_comment?: string | null;
    latest_bad_comment?: string | null;
    highlights?: string[] | null;
    intro?: string | null;
    review_tendency?: { good: string[]; improvement: string[] } | null;
  }>;
  /** 注目の学校カード用（サイト平均との比較） */
  schoolCardGlobalAverages: SchoolCardGlobalAverages | null;
  latestReviews: Array<{
    id: string;
    school_id: string | null;
    school_name: string;
    status?: string;
    overall_satisfaction: number;
    good_comment: string;
    bad_comment: string;
    created_at: string;
    like_count: number;
    reason_for_choosing?: string[];
    attendance_frequency?: string | null;
    campus_prefecture?: string | null;
    schools: {
      id: string;
      name: string;
      slug: string | null;
    } | null;
  }>;
  latestArticles: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    featured_image_url: string | null;
    published_at: string | null;
    category: 'interview' | 'useful_info';
  }>;
  /** 公開中・active な学校の総数（ヒーローのバッジ表示などに使用） */
  totalSchoolCount: number;
  /** 公開中の口コミ総数（ヒーローのバッジ表示などに使用） */
  totalReviewCount: number;
}

const emptyHomeData: HomeData = {
  topRankedSchools: [],
  popularSchools: [],
  latestReviews: [],
  latestArticles: [],
  totalSchoolCount: 0,
  totalReviewCount: 0,
  schoolCardGlobalAverages: null,
};

/**
 * トップページ用データを取得（Server Component / API 共通）
 */
export const getHomeData = cache(async (): Promise<HomeData> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return emptyHomeData;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let allSchools: Array<{
      id: string;
      name: string;
      prefecture: string;
      prefectures?: string[] | null;
      slug: string | null;
    }> | null = null;

    const resultWithPrefectures = await supabase
      .from('schools')
      .select('id, name, prefecture, prefectures, slug, status')
      .eq('is_public', true)
      .eq('status', 'active');

    if (resultWithPrefectures.error) {
      const errorCode = resultWithPrefectures.error.code;
      const msg = resultWithPrefectures.error.message || '';
      const isColumnError =
        errorCode === '42703' ||
        msg.includes('prefectures') ||
        (msg.includes('column') && msg.includes('does not exist'));

      if (isColumnError) {
        const fallback = await supabase
          .from('schools')
          .select('id, name, prefecture, slug')
          .eq('is_public', true)
          .eq('status', 'active');
        allSchools = fallback.data || [];
      } else {
        return emptyHomeData;
      }
    } else {
      allSchools = resultWithPrefectures.data || [];
    }

    const schoolIds = allSchools.map((s) => s.id);

    const [reviewsStatsResult, reviewsDataResult] = await Promise.all([
      schoolIds.length > 0
        ? supabase
            .from('survey_responses')
            .select('school_id, overall_satisfaction')
            .in('school_id', schoolIds)
            .eq('is_public', true)
            .not('school_id', 'is', null)
        : Promise.resolve({ data: [] as unknown[], error: null }),
      supabase
        .from('survey_responses')
        .select(
          'id, school_id, school_name, status, overall_satisfaction, good_comment, bad_comment, created_at, answers'
        )
        .eq('is_public', true)
        .not('school_id', 'is', null)
        .limit(20),
    ]);

    const allReviewsStats = (reviewsStatsResult.data || []) as Array<{
      school_id?: string;
      overall_satisfaction?: number;
    }>;
    const allReviewsData = (reviewsDataResult.data || []) as Array<Record<string, unknown>>;

    const statsMap = new Map<
      string,
      { count: number; sum: number; validCount: number }
    >();
    allReviewsStats.forEach((r) => {
      if (!r.school_id) return;
      if (!statsMap.has(r.school_id)) {
        statsMap.set(r.school_id, { count: 0, sum: 0, validCount: 0 });
      }
      const s = statsMap.get(r.school_id)!;
      s.count++;
      const rating = r.overall_satisfaction;
      if (
        rating != null &&
        rating !== 6 &&
        rating >= 1 &&
        rating <= 5
      ) {
        s.sum += rating;
        s.validCount++;
      }
    });

    const schoolsWithStats = allSchools.map((school) => {
      const prefecturesArray =
        school.prefectures && Array.isArray(school.prefectures) && school.prefectures.length > 0
          ? school.prefectures
          : null;
      const stats = statsMap.get(school.id) || {
        count: 0,
        sum: 0,
        validCount: 0,
      };
      const overallAvg =
        stats.validCount > 0
          ? parseFloat((stats.sum / stats.validCount).toFixed(2))
          : null;
      return {
        id: school.id,
        name: school.name,
        prefecture: school.prefecture,
        prefectures: prefecturesArray,
        slug: school.slug,
        review_count: stats.count,
        overall_avg: overallAvg,
      };
    });

    const rankedSchools = schoolsWithStats
      .filter((s) => s.overall_avg != null && s.review_count >= 3)
      .sort((a, b) => (b.overall_avg ?? 0) - (a.overall_avg ?? 0))
      .slice(0, 5);

    const popularSchools = [...schoolsWithStats]
      .filter((s) => s.review_count > 0)
      .sort((a, b) => b.review_count - a.review_count)
      .slice(0, 3);

    const reviewSchoolIds = [
      ...new Set(
        allReviewsData
          .map((r) => r.school_id as string | undefined)
          .filter(Boolean)
      ),
    ] as string[];

    const { data: schoolsData } = await supabase
      .from('schools')
      .select('id, name, slug, status')
      .in('id', reviewSchoolIds)
      .eq('is_public', true)
      .eq('status', 'active');

    const schoolsList = (schoolsData || []) as Array<{ id: string; name: string; slug: string | null }>;
    const activeSchoolIds = new Set(schoolsList.map((s) => s.id));
    const activeReviews = allReviewsData.filter(
      (r) => r.school_id && activeSchoolIds.has(r.school_id as string)
    );

    const schoolsMap = new Map<string, { id: string; name: string; slug: string | null }>();
    schoolsList.forEach((s) => {
      schoolsMap.set(s.id, s);
    });

    type ReviewWithSchool = Record<string, unknown> & {
      schools: { id: string; name: string; slug: string | null } | null;
    };
    const reviewsWithSchools: ReviewWithSchool[] = activeReviews.map((review) => {
      const school = review.school_id
        ? schoolsMap.get(review.school_id as string) || null
        : null;
      return { ...review, schools: school } as ReviewWithSchool;
    });

    const reviewIds = reviewsWithSchools
      .slice(0, 20)
      .map((r) => (r as Record<string, unknown>).id as string);
    const { data: allLikes } =
      reviewIds.length > 0
        ? await supabase
            .from('review_likes')
            .select('review_id')
            .in('review_id', reviewIds)
        : { data: [] as { review_id: string }[] };

    const likesMap = new Map<string, number>();
    ((allLikes as { review_id: string }[]) || []).forEach((like) => {
      likesMap.set(like.review_id, (likesMap.get(like.review_id) || 0) + 1);
    });

    const reviewsWithLikes = reviewsWithSchools.map((review) => {
        let reasonForChoosing: string[] = [];
        let attendanceFrequency: string | null = null;
        let campusPrefecture: string | null = null;
        try {
          if (review.answers) {
            const answers =
              typeof review.answers === 'string'
                ? JSON.parse(review.answers)
                : review.answers;
            reasonForChoosing = Array.isArray(answers.reason_for_choosing)
              ? answers.reason_for_choosing
              : [];
            attendanceFrequency = answers.attendance_frequency || null;
            if (answers.campus_prefecture) {
              campusPrefecture = Array.isArray(answers.campus_prefecture)
                ? answers.campus_prefecture[0] || null
                : String(answers.campus_prefecture).trim() || null;
            }
          }
        } catch {
          // ignore
        }
        return {
          id: review.id as string,
          school_id: review.school_id as string,
          school_name: (review.school_name as string) || '',
          status: review.status as string | undefined,
          overall_satisfaction: (review.overall_satisfaction as number) || 0,
          good_comment: (review.good_comment as string) || '',
          bad_comment: (review.bad_comment as string) || '',
          created_at: (review.created_at as string) || '',
          like_count: likesMap.get(review.id as string) || 0,
          reason_for_choosing: reasonForChoosing,
          attendance_frequency: attendanceFrequency,
          campus_prefecture: campusPrefecture,
          schools: review.schools,
        };
    });

    const latestReviews = reviewsWithLikes
      .sort((a, b) => b.like_count - a.like_count)
      .slice(0, 3);

    const popularIds = popularSchools.map((s) => s.id);

    const [articlesResult, schoolCardGlobalAverages, popularSnapMap] = await Promise.all([
      supabase
        .from('articles')
        .select('id, title, slug, excerpt, featured_image_url, published_at, category')
        .eq('is_public', true)
        .order('published_at', { ascending: false })
        .limit(3),
      getCachedGlobalAverages(),
      getSearchSchoolsByIds(popularIds),
    ]);

    const popularSchoolsEnriched = popularSchools.map((row) => {
      const snap = popularSnapMap.get(row.id);
      if (snap) {
        return { ...snap, prefectures: row.prefectures };
      }
      return {
        ...row,
        staff_avg: null,
        atmosphere_avg: null,
        credit_avg: null,
        tuition_avg: null,
        latest_good_comment: null,
        latest_bad_comment: null,
        highlights: null,
        intro: null,
        review_tendency: null,
      };
    });

    const totalSchoolCount = allSchools.length;
    const totalReviewCount = allReviewsStats.length;

    return {
      topRankedSchools: rankedSchools,
      popularSchools: popularSchoolsEnriched,
      latestReviews,
      latestArticles: articlesResult.data || [],
      totalSchoolCount,
      totalReviewCount,
      schoolCardGlobalAverages,
    };
  } catch (err) {
    console.error('[getHomeData]', err);
    return emptyHomeData;
  }
});
