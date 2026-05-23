import { getAppBaseUrl } from '@/lib/env-check';
import { getPrefecturePath } from '@/lib/prefectures';

/**
 * IndexNow に URL を通知（INDEXNOW_KEY と INDEXNOW_HOST が設定されているときのみ）。
 * @see https://www.indexnow.org/documentation
 */
export async function submitIndexNowUrls(urls: string[]): Promise<void> {
  const key = process.env.INDEXNOW_KEY;
  const host = process.env.INDEXNOW_HOST?.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!key || !host || urls.length === 0) return;

  const body: Record<string, unknown> = {
    host,
    key,
    urlList: urls.slice(0, 10000),
  };
  if (process.env.INDEXNOW_KEY_LOCATION) {
    body.keyLocation = process.env.INDEXNOW_KEY_LOCATION;
  }

  try {
    const res = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    if (!res.ok && res.status !== 202) {
      console.warn('[IndexNow] submission failed', res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    console.warn('[IndexNow] submission error', e);
  }
}

export function publicReviewUrl(reviewId: string): string {
  return `${getAppBaseUrl().replace(/\/$/, '')}/reviews/${reviewId}`;
}

export function publicFeatureArticleUrl(slug: string): string {
  return `${getAppBaseUrl().replace(/\/$/, '')}/features/${encodeURIComponent(slug)}`;
}

/** 学校詳細（公開サイト）の絶対URL */
export function publicSchoolUrl(slug: string): string {
  return `${getAppBaseUrl().replace(/\/$/, '')}/schools/${encodeURIComponent(slug)}`;
}

/** 都道府県別学校一覧の絶対URL */
export function publicPrefectureSchoolsUrl(prefecture: string): string {
  return `${getAppBaseUrl().replace(/\/$/, '')}${getPrefecturePath(prefecture)}`;
}

/** ランキング一覧（/rankings/[type]）の絶対URL */
export function publicRankingUrl(rankingType: string): string {
  return `${getAppBaseUrl().replace(/\/$/, '')}/rankings/${encodeURIComponent(rankingType)}`;
}
