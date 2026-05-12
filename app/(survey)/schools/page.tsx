import Link from 'next/link';
import SchoolCardServer from '@/components/SchoolCardServer';
import SchoolsPageFilters from './SchoolsPageFilters';
import { searchSchools } from '@/lib/schools/searchSchools';
import { getCachedGlobalAverages } from '@/lib/schools/getSchoolWithStats';
import { DEFAULT_SCHOOL_LIST_SORT } from '@/lib/schools/school-search-constants';
import { appPath } from '@/lib/base-path';
import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';

export const revalidate = 300;

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}

function getStr(v: string | string[] | undefined): string {
  if (v === undefined) return '';
  return Array.isArray(v) ? v[0] ?? '' : v;
}

export const metadata: Metadata = {
  title: '通信制高校を探す | 通信制高校リアルレビュー',
  description: '口コミ・評判で通信制高校を検索。都道府県、評価、口コミ数で絞り込んで、あなたに合う学校を見つけよう。',
  alternates: { canonical: `${getAppBaseUrl()}/schools` },
};

export default async function SchoolsPage({ searchParams }: PageProps) {
  const resolved = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const q = getStr(resolved.q);
  const page = parseInt(getStr(resolved.page) || '1', 10);
  const prefecture = getStr(resolved.prefecture);
  const minRating = resolved.min_rating ? parseFloat(getStr(resolved.min_rating)) : null;
  const minReviewCount = resolved.min_review_count ? parseInt(getStr(resolved.min_review_count), 10) : null;
  const sort = getStr(resolved.sort) || DEFAULT_SCHOOL_LIST_SORT;

  const [data, globalAverages] = await Promise.all([
    searchSchools({
      q,
      page,
      limit: 20,
      prefecture,
      min_rating: Number.isNaN(minRating) ? null : minRating,
      min_review_count: Number.isNaN(minReviewCount) ? null : minReviewCount,
      sort,
    }),
    getCachedGlobalAverages(),
  ]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">通信制高校を探す</h1>
          <SchoolsPageFilters
            initialQ={q}
            initialPrefecture={prefecture}
            initialMinRating={Number.isNaN(minRating) ? null : minRating}
            initialMinReviewCount={Number.isNaN(minReviewCount) ? null : minReviewCount}
            initialSort={sort}
          />
          {prefecture.trim() !== '' && (
            <p className="text-sm text-gray-600 mb-4">
              <Link
                href={appPath(`/schools/prefecture/${encodeURIComponent(prefecture)}`)}
                className="text-blue-600 hover:text-blue-800 hover:underline"
              >
                {prefecture}の通信制高校（口コミの多い学校・評判のピックアップ付き）
              </Link>
              を見る
            </p>
          )}
          {data.total > 0 && (
            <p className="text-gray-600 mb-4">{data.total}件の学校が見つかりました</p>
          )}
        </div>

        {data.schools.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">学校が見つかりませんでした</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {data.schools.map((school) => (
                <SchoolCardServer
                  key={school.id}
                  id={school.id}
                  name={school.name}
                  prefecture={school.prefecture}
                  matchedPrefecture={prefecture.trim() !== '' ? prefecture : undefined}
                  prefectures={school.prefectures ?? undefined}
                  hidePrefectureUnderFilter={Boolean(prefecture.trim())}
                  slug={school.slug}
                  highlights={school.highlights}
                  intro={school.intro}
                  reviewCount={school.review_count}
                  overallAvg={school.overall_avg}
                  latestGoodComment={school.latest_good_comment ?? undefined}
                  latestBadComment={school.latest_bad_comment ?? undefined}
                  staffAvg={school.staff_avg ?? undefined}
                  atmosphereAvg={school.atmosphere_avg ?? undefined}
                  creditAvg={school.credit_avg ?? undefined}
                  tuitionAvg={school.tuition_avg ?? undefined}
                  reviewTendency={school.review_tendency ?? undefined}
                  globalAverages={globalAverages}
                />
              ))}
            </div>

            {data.total_pages > 1 && (
              <div className="flex justify-center gap-2">
                {page > 1 ? (
                  <Link
                    href={buildSchoolsUrl({ q, prefecture, minRating, minReviewCount, sort, page: page === 2 ? undefined : page - 1 })}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    前へ
                  </Link>
                ) : (
                  <span className="px-4 py-2 border border-gray-300 rounded-lg opacity-50 cursor-not-allowed">前へ</span>
                )}
                <span className="px-4 py-2 text-gray-600">
                  {page} / {data.total_pages}
                </span>
                {page < data.total_pages ? (
                  <Link
                    href={buildSchoolsUrl({ q, prefecture, minRating, minReviewCount, sort, page: page + 1 })}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    次へ
                  </Link>
                ) : (
                  <span className="px-4 py-2 border border-gray-300 rounded-lg opacity-50 cursor-not-allowed">次へ</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function buildSchoolsUrl(params: {
  q: string;
  prefecture: string;
  minRating: number | null;
  minReviewCount: number | null;
  sort: string;
  page?: number;
}): string {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.prefecture) search.set('prefecture', params.prefecture);
  if (params.minRating != null) search.set('min_rating', params.minRating.toString());
  if (params.minReviewCount != null) search.set('min_review_count', params.minReviewCount.toString());
  if (params.sort && params.sort !== DEFAULT_SCHOOL_LIST_SORT) search.set('sort', params.sort);
  if (params.page != null && params.page > 1) search.set('page', params.page.toString());
  const qs = search.toString();
  return appPath(`/schools${qs ? `?${qs}` : ''}`);
}
