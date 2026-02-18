import { notFound } from 'next/navigation';
import Link from 'next/link';
import SchoolReviewsListServer from '@/components/SchoolReviewsListServer';
import SchoolReviewsFilters from './SchoolReviewsFilters';
import { getReviewsBySchoolSlug } from '@/lib/reviews/getReviewsBySchoolSlug';
import { getSchoolWithStats } from '@/lib/schools/getSchoolWithStats';
import { getSchoolSlugs } from '@/lib/schools/getSchoolSlugs';
import { appPath } from '@/lib/base-path';
import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';

/** 常にサーバーでレンダリングし、口コミ本文を初期HTMLに含める（クローラー対応） */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** ビルド時にパスを事前生成（中身は dynamic で毎回取得） */
export async function generateStaticParams() {
  const slugs = await getSchoolSlugs();
  return slugs;
}

interface PageProps {
  params: Promise<{ slug: string }> | { slug: string };
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}

function getStr(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = params instanceof Promise ? await params : params;
  const decodedSlug = decodeURIComponent(resolvedParams.slug);

  const school = await getSchoolWithStats(decodedSlug);
  if (!school) {
    return { title: '学校が見つかりません' };
  }

  const title = `${school.name}の口コミ一覧 | 通信制高校リアルレビュー`;
  const description = `${school.name}の口コミ・評判を掲載。在校生・卒業生・保護者の生の声で、あなたに合う通信制高校を見つけよう。`;

  const appBaseUrl = getAppBaseUrl();
  const canonical = `${appBaseUrl}/schools/${resolvedParams.slug}/reviews`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
    },
  };
}

export default async function SchoolReviewsPage({ params, searchParams }: PageProps) {
  const resolvedParams = params instanceof Promise ? await params : params;
  const resolvedSearch = searchParams instanceof Promise ? await searchParams : searchParams ?? {};

  const decodedSlug = decodeURIComponent(resolvedParams.slug);
  const page = parseInt(getStr(resolvedSearch.page) || '1', 10);
  const sort = getStr(resolvedSearch.sort) || 'newest';
  const role = getStr(resolvedSearch.role);
  const graduationPath = getStr(resolvedSearch.graduation_path);
  const enrollmentType = getStr(resolvedSearch.enrollment_type);
  const attendanceFrequency = getStr(resolvedSearch.attendance_frequency);
  const campusPrefecture = getStr(resolvedSearch.campus_prefecture);
  const reasonForChoosingRaw = getStr(resolvedSearch.reason_for_choosing);
  const reasonForChoosingArray = reasonForChoosingRaw
    ? reasonForChoosingRaw.split(',').filter((r) => r.trim() !== '')
    : undefined;

  const data = await getReviewsBySchoolSlug({
    schoolSlug: decodedSlug,
    page,
    limit: 20,
    sort,
    role,
    graduation_path: graduationPath,
    enrollment_type: enrollmentType,
    attendance_frequency: attendanceFrequency,
    campus_prefecture: campusPrefecture,
    reason_for_choosing: reasonForChoosingArray,
  });

  // 学校が存在しない（レビュー0かつschoolName空 = 学校未取得）の場合は notFound
  if (!data.schoolName && data.reviews.length === 0) {
    notFound();
  }

  const filters = {
    role,
    graduation_path: graduationPath,
    enrollment_type: enrollmentType,
    attendance_frequency: attendanceFrequency,
    campus_prefecture: campusPrefecture,
    reason_for_choosing: reasonForChoosingArray,
  };

  const baseUrl = appPath(`/schools/${encodeURIComponent(decodedSlug)}/reviews`);

  const buildPaginationUrl = (newPage: number) => {
    const q = new URLSearchParams();
    q.set('sort', sort);
    if (newPage > 1) q.set('page', newPage.toString());
    if (role) q.set('role', role);
    if (graduationPath) q.set('graduation_path', graduationPath);
    if (enrollmentType) q.set('enrollment_type', enrollmentType);
    if (attendanceFrequency) q.set('attendance_frequency', attendanceFrequency);
    if (campusPrefecture) q.set('campus_prefecture', campusPrefecture);
    if (reasonForChoosingArray?.length) q.set('reason_for_choosing', reasonForChoosingArray.join(','));
    return `${baseUrl}?${q.toString()}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-3">
          <Link
            href={appPath(`/schools/${decodedSlug}`)}
            className="text-xs text-blue-600 hover:text-blue-700 mb-2 inline-flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            学校詳細に戻る
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {data.schoolName || '口コミ一覧'}
          </h1>
          {data.total > 0 && <p className="text-sm text-gray-600">{data.total}件の口コミ</p>}
        </div>

        <SchoolReviewsFilters
          slug={decodedSlug}
          filters={filters}
          sort={sort}
          totalBeforeFilter={data.totalBeforeFilter}
          filteredCount={data.total}
        />

        <div className="border-t border-gray-200 my-3" />

        <div className="mb-3">
          <h2 className="text-base font-semibold text-gray-900">口コミ</h2>
        </div>

        <SchoolReviewsListServer
          reviews={data.reviews}
          schoolName={data.schoolName}
          page={page}
          totalPages={data.totalPages}
          buildPaginationUrl={buildPaginationUrl}
        />
      </div>
    </div>
  );
}
