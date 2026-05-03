import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import PrefectureLandingPage from '@/components/PrefectureLandingPage';
import SchoolCardServer from '@/components/SchoolCardServer';
import { searchSchools } from '@/lib/schools/searchSchools';
import { getPrefectureLandingHighlights } from '@/lib/schools/getPrefectureLandingHighlights';
import { getPrefectureIntroLead } from '@/lib/regions/prefecture-intros';
import { prefectures } from '@/lib/prefectures';
import { appPath } from '@/lib/base-path';
import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';
import StructuredData from '@/components/StructuredData';
import { buildPrefectureLandingJsonLd } from '@/lib/prefectures/prefecture-landing-schema';

export const revalidate = 3600;

/** ビルド時に都道府県別学校一覧を静的生成し、初期HTMLに本文を含める */
export async function generateStaticParams() {
  return prefectures.map((prefecture) => ({ prefecture }));
}

interface PageProps {
  params: Promise<{ prefecture: string }> | { prefecture: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}

function getStr(v: string | string[] | undefined): string {
  if (v === undefined) return '';
  return Array.isArray(v) ? v[0] ?? '' : v;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = params instanceof Promise ? await params : params;
  const prefecture = decodeURIComponent(resolved.prefecture);
  if (!prefectures.includes(prefecture)) {
    return { title: 'ページが見つかりません' };
  }
  const title = `${prefecture}の通信制高校【口コミ・評判】｜通信制高校リアルレビュー`;
  const description = `${prefecture}の通信制高校を口コミ・評判から比較できます。口コミが多い学校・評判の高い学校のピックアップと、${prefecture}内の学校一覧です。`;
  const canonical = `${getAppBaseUrl()}/schools/prefecture/${encodeURIComponent(prefecture)}`;
  return {
    title,
    description,
    alternates: { canonical },
  };
}

export default async function PrefectureSchoolsPage({ params, searchParams }: PageProps) {
  const resolvedParams = params instanceof Promise ? await params : params;
  const resolvedSearch = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const prefecture = decodeURIComponent(resolvedParams.prefecture);
  const page = parseInt(getStr(resolvedSearch.page) || '1', 10);

  if (!prefectures.includes(prefecture)) {
    notFound();
  }

  const [highlights, data] = await Promise.all([
    getPrefectureLandingHighlights(prefecture),
    searchSchools({
      prefecture,
      page,
      limit: 20,
    }),
  ]);

  const totalPages = data.total_pages;
  if (data.total > 0) {
    const outOfRange = !Number.isFinite(page) || page < 1 || page > totalPages;
    if (outOfRange) {
      const targetPage = Math.max(1, totalPages);
      const suffix = targetPage > 1 ? `?page=${targetPage}` : '';
      redirect(appPath(`/schools/prefecture/${encodeURIComponent(prefecture)}${suffix}`));
    }
  }

  const introLead = getPrefectureIntroLead(prefecture);
  const hasSchools = data.total > 0;

  const prefectureJsonLd =
    hasSchools
      ? buildPrefectureLandingJsonLd({
          prefecture,
          page,
          pageSize: 20,
          schools: data.schools.map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
          total: data.total,
        })
      : null;

  return (
    <>
      {prefectureJsonLd && <StructuredData data={prefectureJsonLd} />}
    <PrefectureLandingPage
      prefecture={prefecture}
      introLead={introLead}
      topByReviews={highlights.topByReviews}
      topByRating={highlights.topByRating}
      hasSchools={hasSchools}
    >
      {!hasSchools ? (
        <div className="text-center py-12">
          <p className="text-gray-600">{prefecture}の通信制高校が見つかりませんでした</p>
          <Link href={appPath('/schools')} className="mt-4 inline-block text-blue-600 hover:text-blue-700">
            学校検索へ戻る
          </Link>
        </div>
      ) : (
        <>
          <p className="text-gray-600 mb-4">全{data.total}校（{page}ページ目）</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {data.schools.map((school) => (
              <SchoolCardServer
                key={school.id}
                id={school.id}
                name={school.name}
                prefecture={school.prefecture}
                hidePrefectureUnderFilter
                slug={school.slug}
                reviewCount={school.review_count}
                overallAvg={school.overall_avg}
              />
            ))}
          </div>

          {data.total_pages > 1 && (
            <div className="flex justify-center gap-2">
              {page > 1 ? (
                <Link
                  href={
                    page === 2
                      ? appPath(`/schools/prefecture/${encodeURIComponent(prefecture)}`)
                      : appPath(`/schools/prefecture/${encodeURIComponent(prefecture)}?page=${page - 1}`)
                  }
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
                  href={appPath(`/schools/prefecture/${encodeURIComponent(prefecture)}?page=${page + 1}`)}
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
    </PrefectureLandingPage>
    </>
  );
}
