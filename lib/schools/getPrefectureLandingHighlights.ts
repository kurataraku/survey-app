import { cache } from 'react';
import { searchSchools, type SearchSchool } from '@/lib/schools/searchSchools';
import type { SchoolInstitutionType } from '@/lib/types/schools';
import {
  getPrefectureAttendanceFrequencyLinks,
  type PrefectureAttendanceLink,
} from '@/lib/schools/prefecture-landing-attendance';
import {
  PREFECTURE_LANDING_FETCH_CAP,
  PREFECTURE_LANDING_HIGHLIGHT_LIMIT,
  PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING,
} from '@/lib/schools/prefecture-landing-constants';

export interface PrefectureLandingHighlights {
  /** 口コミが1件以上ある学校数（都道府県内・掲載校ベース） */
  schoolsWithReviewsCount: number;
  /** 都道府県内の公開口コミ総数（FETCH_CAP 内の集計） */
  totalReviewCount: number;
  /** 口コミ件数で加重した総合満足度の平均（1〜5） */
  averageOverallSatisfaction: number | null;
  /** 口コミ件数で加重した学費満足度の平均（1〜5） */
  averageTuitionSatisfaction: number | null;
  topByReviewCount: SearchSchool[];
  topByRating: SearchSchool[];
  topBySupport: SearchSchool[];
  topByTuition: SearchSchool[];
  schoolsByInstitutionType: Record<SchoolInstitutionType, SearchSchool[]>;
  attendanceFrequencyLinks: PrefectureAttendanceLink[];
}

function topByTuitionFromSchools(
  schools: SearchSchool[],
  minReviews: number,
  limit: number
): SearchSchool[] {
  return [...schools]
    .filter((s) => s.review_count >= minReviews && s.tuition_avg != null)
    .sort((a, b) => (b.tuition_avg ?? 0) - (a.tuition_avg ?? 0))
    .slice(0, limit);
}

function topBySupportFromSchools(
  schools: SearchSchool[],
  minReviews: number,
  limit: number
): SearchSchool[] {
  return [...schools]
    .filter((s) => s.review_count >= minReviews && s.support_avg != null)
    .sort((a, b) => (b.support_avg ?? 0) - (a.support_avg ?? 0))
    .slice(0, limit);
}

function computeWeightedRatingAverage(
  schools: SearchSchool[],
  field: 'overall_avg' | 'tuition_avg'
): number | null {
  let weightedSum = 0;
  let weightedCount = 0;
  for (const s of schools) {
    const rating = s[field];
    if (rating != null && s.review_count > 0) {
      weightedSum += rating * s.review_count;
      weightedCount += s.review_count;
    }
  }
  if (weightedCount === 0) return null;
  return parseFloat((weightedSum / weightedCount).toFixed(2));
}

function pickInstitutionTypeSchools(
  schools: SearchSchool[],
  type: SchoolInstitutionType,
  limit: number
): SearchSchool[] {
  return schools
    .filter((s) => s.institution_type === type)
    .sort((a, b) => {
      const ratingDiff = (b.overall_avg ?? 0) - (a.overall_avg ?? 0);
      if (ratingDiff !== 0) return ratingDiff;
      return b.review_count - a.review_count;
    })
    .slice(0, limit);
}

/**
 * 都道府県LP：サマリー指標・比較ブロック用データ
 */
export const getPrefectureLandingHighlights = cache(
  async (prefecture: string): Promise<PrefectureLandingHighlights> => {
    const cap = PREFECTURE_LANDING_FETCH_CAP;
    const n = PREFECTURE_LANDING_HIGHLIGHT_LIMIT;
    const minReviews = PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING;

    const [withReviewsResult, allSchoolsResult, ratingResult] = await Promise.all([
      searchSchools({
        prefecture,
        page: 1,
        limit: 1,
        min_review_count: 1,
      }),
      searchSchools({
        prefecture,
        page: 1,
        limit: cap,
        sort: 'review_count_desc',
      }),
      searchSchools({
        prefecture,
        page: 1,
        limit: cap,
        sort: 'rating_desc',
        min_review_count: minReviews,
      }),
    ]);

    const allSchools = allSchoolsResult.schools;
    const totalReviewCount = allSchools.reduce((sum, s) => sum + s.review_count, 0);
    const schoolsWithReviewsCount = withReviewsResult.total;
    const averageOverallSatisfaction = computeWeightedRatingAverage(allSchools, 'overall_avg');
    const averageTuitionSatisfaction = computeWeightedRatingAverage(allSchools, 'tuition_avg');

    const topByReviewCount = allSchools
      .filter((s) => s.review_count > 0)
      .slice(0, n);

    const topByRating = ratingResult.schools
      .filter((s) => s.overall_avg != null)
      .slice(0, n);

    const topBySupport = topBySupportFromSchools(allSchools, minReviews, n);
    const topByTuition = topByTuitionFromSchools(allSchools, minReviews, n);
    const schoolsByInstitutionType = {
      public: pickInstitutionTypeSchools(allSchools, 'public', n),
      private: pickInstitutionTypeSchools(allSchools, 'private', n),
      support: pickInstitutionTypeSchools(allSchools, 'support', n),
    };

    return {
      schoolsWithReviewsCount,
      totalReviewCount,
      averageOverallSatisfaction,
      averageTuitionSatisfaction,
      topByReviewCount,
      topByRating,
      topBySupport,
      topByTuition,
      schoolsByInstitutionType,
      attendanceFrequencyLinks: getPrefectureAttendanceFrequencyLinks(prefecture),
    };
  }
);
