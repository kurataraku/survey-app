import { notFound } from 'next/navigation';
import Link from 'next/link';
import SchoolCard from '@/components/SchoolCard';
import { searchSchools } from '@/lib/schools/searchSchools';
import { appPath } from '@/lib/base-path';
import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';

export const revalidate = 3600;

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
  const title = `${prefecture}の通信制高校 | 通信制高校リアルレビュー`;
  const canonical = `${getAppBaseUrl()}/schools/prefecture/${encodeURIComponent(prefecture)}`;
  return {
    title,
    description: `${prefecture}の通信制高校を口コミ・評判で検索。実際に通った人のリアルな声で、あなたに合う学校を見つけよう。`,
    alternates: { canonical },
  };
}

export default async function PrefectureSchoolsPage({ params, searchParams }: PageProps) {
  const resolvedParams = params instanceof Promise ? await params : params;
  const resolvedSearch = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const prefecture = decodeURIComponent(resolvedParams.prefecture);
  const page = parseInt(getStr(resolvedSearch.page) || '1', 10);

  const data = await searchSchools({
    prefecture,
    page,
    limit: 20,
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href={appPath('/schools')} className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← 学校検索に戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{prefecture}の通信制高校</h1>
          {data.total > 0 && (
            <p className="text-gray-600">{data.total}校が見つかりました</p>
          )}
        </div>

        {data.schools.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">{prefecture}の通信制高校が見つかりませんでした</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {data.schools.map((school) => (
                <SchoolCard
                  key={school.id}
                  id={school.id}
                  name={school.name}
                  prefecture={school.prefecture}
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
                    href={page === 2
                      ? appPath(`/schools/prefecture/${encodeURIComponent(prefecture)}`)
                      : appPath(`/schools/prefecture/${encodeURIComponent(prefecture)}?page=${page - 1}`)}
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
      </div>
    </div>
  );
}
