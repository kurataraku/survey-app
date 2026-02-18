import ReviewsListServer from '@/components/ReviewsListServer';
import { getReviewsList } from '@/lib/reviews/getReviewsList';
import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';

/** 常にサーバーでレンダリングし、口コミ本文を初期HTMLに含める（クローラー対応） */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

        <ReviewsListServer
          reviews={data.reviews}
          page={page}
          totalPages={data.totalPages}
        />
      </div>
    </div>
  );
}
