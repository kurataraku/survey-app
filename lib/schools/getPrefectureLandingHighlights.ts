import { cache } from 'react';
import { searchSchools, type SearchSchool } from '@/lib/schools/searchSchools';
import {
  PREFECTURE_LANDING_FETCH_CAP,
  PREFECTURE_LANDING_HIGHLIGHT_LIMIT,
  PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING,
} from '@/lib/schools/prefecture-landing-constants';

export interface PrefectureLandingHighlights {
  topByReviews: SearchSchool[];
  topByRating: SearchSchool[];
}

/**
 * 都道府県LP 上部の2ブロック用：口コミ件数順・総合評価順（最低口コミ数あり）
 */
export const getPrefectureLandingHighlights = cache(
  async (prefecture: string): Promise<PrefectureLandingHighlights> => {
    const cap = PREFECTURE_LANDING_FETCH_CAP;
    const n = PREFECTURE_LANDING_HIGHLIGHT_LIMIT;
    const minReviews = PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING;

    const [reviewsResult, ratingResult] = await Promise.all([
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

    const topByReviews = reviewsResult.schools.slice(0, n);
    const topByRating = ratingResult.schools
      .filter((s) => s.overall_avg != null)
      .slice(0, n);

    return { topByReviews, topByRating };
  }
);
