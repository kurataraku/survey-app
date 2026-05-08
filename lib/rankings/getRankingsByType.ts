import { cache } from 'react';
import { MIN_PUBLIC_REVIEWS_FOR_SCORE_RANKINGS } from '@/lib/rankings/constants';
import { createSupabaseClientWithLargeHeaders } from '@/lib/supabase/large-headers';

export interface RankingSchool {
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
  highlights: string[] | null;
  intro: string | null;
  review_count: number;
  overall_avg: number | null;
  staff_avg: number | null;
  atmosphere_avg: number | null;
  credit_avg: number | null;
  tuition_avg: number | null;
  latest_good_comment: string | null;
  latest_bad_comment: string | null;
  review_tendency: { good: string[]; improvement: string[] } | null;
}

export interface GetRankingsResult {
  schools: RankingSchool[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  type: string;
}

const VALID_TYPES = ['overall', 'staff', 'atmosphere', 'credit', 'tuition', 'review-count'] as const;

export const getRankingsByType = cache(async (
  type: string,
  options: { page?: number; limit?: number } = {}
): Promise<GetRankingsResult | { error: string }> => {
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { error: 'Supabase環境変数が設定されていません' };
  }

  if (type === 'graduation' || type === 'career' || type === 'advancement' || type === '進学実績') {
    return { error: '進学実績ランキングは削除されました' };
  }

  if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
    return { error: '無効なランキングタイプです' };
  }

  const supabase = createSupabaseClientWithLargeHeaders(supabaseUrl, supabaseServiceKey);

  const { data: allSchools } = await supabase
    .from('schools')
    .select('id, name, prefecture, slug, highlights, intro')
    .eq('is_public', true);

  if (!allSchools || allSchools.length === 0) {
    return { schools: [], total: 0, page, limit, total_pages: 0, type };
  }

  const schoolIds = allSchools.map((s) => s.id);

  const [reviewsResult, tendencyResult] = await Promise.all([
    supabase
      .from('survey_responses')
      .select('school_id, overall_satisfaction, answers, good_comment, bad_comment, created_at')
      .in('school_id', schoolIds)
      .eq('is_public', true)
      .not('school_id', 'is', null),
    supabase
      .from('school_ai_summaries')
      .select('school_id, summary_text')
      .in('school_id', schoolIds)
      .eq('kind', 'review_tendency')
      .is('topic', null)
      .eq('status', 'published'),
  ]);
  const { data: allReviews, error: reviewsError } = reviewsResult;

  if (reviewsError) {
    console.error('[getRankingsByType] 口コミデータ取得エラー:', reviewsError);
  }

  const statsMap = new Map<
    string,
    {
      review_count: number;
      overall_ratings: number[];
      staff_ratings: number[];
      atmosphere_ratings: number[];
      credit_ratings: number[];
      tuition_ratings: number[];
      latestComment: { text: string; ts: string } | null;
      latestBadComment: { text: string; ts: string } | null;
    }
  >();

  schoolIds.forEach((id) => {
    statsMap.set(id, {
      review_count: 0,
      overall_ratings: [],
      staff_ratings: [],
      atmosphere_ratings: [],
      credit_ratings: [],
      tuition_ratings: [],
      latestComment: null,
      latestBadComment: null,
    });
  });

  if (allReviews) {
    for (const review of allReviews) {
      const schoolId = review.school_id;
      if (!schoolId) continue;

      const stats = statsMap.get(schoolId);
      if (!stats) continue;

      stats.review_count++;

      if (
        review.overall_satisfaction !== null &&
        review.overall_satisfaction !== 6 &&
        review.overall_satisfaction >= 1 &&
        review.overall_satisfaction <= 5
      ) {
        stats.overall_ratings.push(review.overall_satisfaction);
      }

      if (review.answers) {
        const answers =
          typeof review.answers === 'string' ? JSON.parse(review.answers) : review.answers;

        if (answers.staff_rating) {
          const r = parseInt(answers.staff_rating, 10);
          if (!isNaN(r) && r >= 1 && r <= 5 && r !== 6) stats.staff_ratings.push(r);
        }
        if (answers.atmosphere_fit_rating) {
          const r = parseInt(answers.atmosphere_fit_rating, 10);
          if (!isNaN(r) && r >= 1 && r <= 5 && r !== 6) stats.atmosphere_ratings.push(r);
        }
        if (answers.credit_rating) {
          const r = parseInt(answers.credit_rating, 10);
          if (!isNaN(r) && r >= 1 && r <= 5 && r !== 6) stats.credit_ratings.push(r);
        }
        if (answers.tuition_rating) {
          const r = parseInt(answers.tuition_rating, 10);
          if (!isNaN(r) && r >= 1 && r <= 5 && r !== 6) stats.tuition_ratings.push(r);
        }
      }

      if (review.good_comment?.trim()) {
        if (!stats.latestComment || review.created_at > stats.latestComment.ts) {
          stats.latestComment = { text: review.good_comment.trim(), ts: review.created_at };
        }
      }
      if (review.bad_comment?.trim()) {
        if (!stats.latestBadComment || review.created_at > stats.latestBadComment.ts) {
          stats.latestBadComment = { text: review.bad_comment.trim(), ts: review.created_at };
        }
      }
    }
  }

  // AI要約（review_tendency）のパース
  const tendencyMap = new Map<string, { good: string[]; improvement: string[] }>();
  if (tendencyResult.data) {
    for (const t of tendencyResult.data) {
      try {
        const parsed = JSON.parse(t.summary_text) as { good_points?: string[]; improvement_points?: string[] };
        const good = Array.isArray(parsed.good_points) ? parsed.good_points.slice(0, 2) : [];
        const improvement = Array.isArray(parsed.improvement_points) ? parsed.improvement_points.slice(0, 2) : [];
        if (good.length > 0 || improvement.length > 0) tendencyMap.set(t.school_id, { good, improvement });
      } catch {}
    }
  }

  const schoolsWithStats: RankingSchool[] = allSchools.map((school) => {
    const stats = statsMap.get(school.id) ?? {
      review_count: 0,
      overall_ratings: [] as number[],
      staff_ratings: [] as number[],
      atmosphere_ratings: [] as number[],
      credit_ratings: [] as number[],
      tuition_ratings: [] as number[],
      latestComment: null as { text: string; ts: string } | null,
      latestBadComment: null as { text: string; ts: string } | null,
    };

    const overallAvg =
      stats.overall_ratings.length > 0
        ? stats.overall_ratings.reduce((a, b) => a + b, 0) / stats.overall_ratings.length
        : null;
    const staffAvg =
      stats.staff_ratings.length > 0
        ? stats.staff_ratings.reduce((a, b) => a + b, 0) / stats.staff_ratings.length
        : null;
    const atmosphereAvg =
      stats.atmosphere_ratings.length > 0
        ? stats.atmosphere_ratings.reduce((a, b) => a + b, 0) / stats.atmosphere_ratings.length
        : null;
    const creditAvg =
      stats.credit_ratings.length > 0
        ? stats.credit_ratings.reduce((a, b) => a + b, 0) / stats.credit_ratings.length
        : null;
    const tuitionAvg =
      stats.tuition_ratings.length > 0
        ? stats.tuition_ratings.reduce((a, b) => a + b, 0) / stats.tuition_ratings.length
        : null;

    return {
      id: school.id,
      name: school.name,
      prefecture: school.prefecture,
      slug: school.slug,
      highlights: school.highlights ?? null,
      intro: school.intro ?? null,
      review_count: stats.review_count,
      overall_avg: overallAvg != null ? parseFloat(overallAvg.toFixed(2)) : null,
      staff_avg: staffAvg != null ? parseFloat(staffAvg.toFixed(2)) : null,
      atmosphere_avg: atmosphereAvg != null ? parseFloat(atmosphereAvg.toFixed(2)) : null,
      credit_avg: creditAvg != null ? parseFloat(creditAvg.toFixed(2)) : null,
      tuition_avg: tuitionAvg != null ? parseFloat(tuitionAvg.toFixed(2)) : null,
      latest_good_comment: stats.latestComment?.text ?? null,
      latest_bad_comment: stats.latestBadComment?.text ?? null,
      review_tendency: tendencyMap.get(school.id) ?? null,
    };
  });

  const minReviews = MIN_PUBLIC_REVIEWS_FOR_SCORE_RANKINGS;

  let rankedSchools: RankingSchool[];
  switch (type) {
    case 'overall':
      rankedSchools = schoolsWithStats
        .filter((s) => s.overall_avg !== null && s.review_count >= minReviews)
        .sort((a, b) => (b.overall_avg ?? 0) - (a.overall_avg ?? 0));
      break;
    case 'staff':
      rankedSchools = schoolsWithStats
        .filter((s) => s.staff_avg !== null && s.review_count >= minReviews)
        .sort((a, b) => (b.staff_avg ?? 0) - (a.staff_avg ?? 0));
      break;
    case 'atmosphere':
      rankedSchools = schoolsWithStats
        .filter((s) => s.atmosphere_avg !== null && s.review_count >= minReviews)
        .sort((a, b) => (b.atmosphere_avg ?? 0) - (a.atmosphere_avg ?? 0));
      break;
    case 'credit':
      rankedSchools = schoolsWithStats
        .filter((s) => s.credit_avg !== null && s.review_count >= minReviews)
        .sort((a, b) => (b.credit_avg ?? 0) - (a.credit_avg ?? 0));
      break;
    case 'tuition':
      rankedSchools = schoolsWithStats
        .filter((s) => s.tuition_avg !== null && s.review_count >= minReviews)
        .sort((a, b) => (b.tuition_avg ?? 0) - (a.tuition_avg ?? 0));
      break;
    case 'review-count':
      rankedSchools = schoolsWithStats
        .filter((s) => s.review_count > 0)
        .sort((a, b) => b.review_count - a.review_count);
      break;
    default:
      return { error: '無効なランキングタイプです' };
  }

  const total = rankedSchools.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginatedSchools = rankedSchools.slice(offset, offset + limit);

  return {
    schools: paginatedSchools,
    total,
    page,
    limit,
    total_pages: totalPages,
    type,
  };
});
