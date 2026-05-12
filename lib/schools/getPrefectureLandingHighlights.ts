import { cache } from 'react';
import { searchSchools, type SearchSchool } from '@/lib/schools/searchSchools';
import {
  PREFECTURE_LANDING_FETCH_CAP,
  PREFECTURE_LANDING_HIGHLIGHT_LIMIT,
  PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING,
} from '@/lib/schools/prefecture-landing-constants';

export interface PrefectureLandingHighlights {
  /** 口コミが1件以上ある学校数（都道府県内・掲載校ベース） */
  schoolsWithReviewsCount: number;
  topByRating: SearchSchool[];
}

/**
 * 都道府県LP 上部：総合評価が高い学校（最低口コミ数あり）＋口コミ掲載校数
 */
export const getPrefectureLandingHighlights = cache(
  async (prefecture: string): Promise<PrefectureLandingHighlights> => {
    const cap = PREFECTURE_LANDING_FETCH_CAP;
    const n = PREFECTURE_LANDING_HIGHLIGHT_LIMIT;
    const minReviews = PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING;

    const [withReviewsResult, ratingResult] = await Promise.all([
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
        sort: 'rating_desc',
        min_review_count: minReviews,
      }),
    ]);

    const topByRating = ratingResult.schools
      .filter((s) => s.overall_avg != null)
      .slice(0, n);

    return {
      schoolsWithReviewsCount: withReviewsResult.total,
      topByRating,
    };
  }
);
