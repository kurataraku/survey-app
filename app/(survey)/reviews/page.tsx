import { Suspense } from 'react';
import ReviewsListServer from '@/components/ReviewsListServer';
import ReviewsFilter from '@/components/ReviewsFilter';
import { getReviewsList } from '@/lib/reviews/getReviewsList';
import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';
import { getReviewReasonGroup } from '@/lib/reviews/reason-groups';

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
  title: '最新口コミ',
  description: '通信制高校の口コミ・評判を最新順で閲覧。実際に通った人のリアルな声で、あなたに合う学校を見つけよう。',
  alternates: { canonical: `${getAppBaseUrl()}/reviews` },
};

export default async function ReviewsPage({ searchParams }: PageProps) {
  const resolved = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const page             = parseInt(getStr(resolved.page) || '1', 10);
  const sort             = getStr(resolved.sort) || 'newest';
  const attendanceFrequency = getStr(resolved.attendance_frequency) || '';
  const prefecture       = getStr(resolved.prefecture) || '';
  const reasonGroupKey   = getStr(resolved.reason_group) || '';
  const overallRating    = parseInt(getStr(resolved.overall) || '0', 10) || undefined;
  const staffRating      = parseInt(getStr(resolved.staff) || '0', 10) || undefined;
  const atmosphereRating = parseInt(getStr(resolved.atmosphere) || '0', 10) || undefined;
  const creditRating     = parseInt(getStr(resolved.credit) || '0', 10) || undefined;
  const tuitionRating    = parseInt(getStr(resolved.tuition) || '0', 10) || undefined;

  const data = await getReviewsList({
    page, limit: 20, sort,
    attendanceFrequency: attendanceFrequency || undefined,
    prefecture: prefecture || undefined,
    reasonGroup: reasonGroupKey || undefined,
    overallRating,
    staffRating, atmosphereRating, creditRating, tuitionRating,
  });

  const reasonGroup = getReviewReasonGroup(reasonGroupKey);
  const filterParts = [
    prefecture || null,
    reasonGroup?.shortLabel ?? null,
    attendanceFrequency || null,
  ].filter(Boolean);
  const filterLabel = filterParts.length > 0
    ? `「${filterParts.join(' × ')}」の口コミ`
    : '最新口コミ';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{filterLabel}</h1>
          <p className="text-gray-500 text-sm">
            {data.total > 0 ? `${data.total}件の口コミが見つかりました` : '口コミが見つかりませんでした'}
          </p>
        </div>

        <Suspense fallback={null}>
          <ReviewsFilter />
        </Suspense>

        <ReviewsListServer
          reviews={data.reviews}
          page={page}
          totalPages={data.totalPages}
          attendanceFrequency={attendanceFrequency}
          prefecture={prefecture}
          reasonGroup={reasonGroupKey}
          sort={sort}
        />
      </div>
    </div>
  );
}
