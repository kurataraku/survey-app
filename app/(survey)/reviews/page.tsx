import Link from 'next/link';
import ReviewCardServer from '@/components/ReviewCardServer';
import { getReviewsList } from '@/lib/reviews/getReviewsList';
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
  title: '最新口コミ | 通信制高校リアルレビュー',
  description: '通信制高校の口コミ・評判を最新順で閲覧。実際に通った人のリアルな声で、あなたに合う学校を見つけよう。',
  alternates: { canonical: `${getAppBaseUrl()}/reviews` },
};

export default async function ReviewsPage({ searchParams }: PageProps) {
  const resolved = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const page = parseInt(getStr(resolved.page) || '1', 10);
  const sort = getStr(resolved.sort) || 'newest';

  const data = await getReviewsList({ page, limit: 20, sort });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">最新口コミ</h1>
          {data.total > 0 && (
            <p className="text-gray-600 mb-4">{data.total}件の口コミが見つかりました</p>
          )}
        </div>

        {data.reviews.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">口コミが見つかりませんでした</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {data.reviews.map((review) => (
                <ReviewCardServer
                  key={review.id}
                  id={review.id}
                  schoolName={review.school_name}
                  schoolSlug={review.school_slug}
                  overallSatisfaction={review.overall_satisfaction}
                  goodComment={review.good_comment}
                  badComment={review.bad_comment}
                  enrollmentYear={review.enrollment_year}
                  attendanceFrequency={review.attendance_frequency}
                  likeCount={review.like_count}
                  createdAt={review.created_at}
                />
              ))}
            </div>

            {data.totalPages > 1 && (
              <div className="flex justify-center gap-2">
                {page > 1 ? (
                  <Link
                    href={page === 2 ? appPath('/reviews') : appPath(`/reviews?page=${page - 1}`)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    前へ
                  </Link>
                ) : (
                  <span className="px-4 py-2 border border-gray-300 rounded-lg opacity-50 cursor-not-allowed">前へ</span>
                )}
                <span className="px-4 py-2 text-gray-600">
                  {page} / {data.totalPages}
                </span>
                {page < data.totalPages ? (
                  <Link
                    href={appPath(`/reviews?page=${page + 1}`)}
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
