import { notFound } from 'next/navigation';
import Link from 'next/link';
import RankingCardServer from '@/components/RankingCardServer';
import { getRankingsByType } from '@/lib/rankings/getRankingsByType';
import { appPath } from '@/lib/base-path';
import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';
import StructuredData from '@/components/StructuredData';

export const revalidate = 3600;

/** ビルド時に1ページ目を静的生成し、初期HTMLにランキング本文を含める */
export async function generateStaticParams() {
  return [
    { type: 'overall' },
    { type: 'review-count' },
    { type: 'staff' },
    { type: 'atmosphere' },
    { type: 'credit' },
    { type: 'tuition' },
  ];
}

const rankingConfig: Record<
  string,
  {
    title: string;
    valueKey: 'overall_avg' | 'staff_avg' | 'atmosphere_avg' | 'credit_avg' | 'tuition_avg' | 'review_count';
    valueLabel: string;
    valueType: 'rating' | 'count' | 'percentage';
  }
> = {
  overall: { title: '総合評判ランキング', valueKey: 'overall_avg', valueLabel: '総合満足度', valueType: 'rating' },
  staff: { title: '先生対応ランキング', valueKey: 'staff_avg', valueLabel: '先生対応評価', valueType: 'rating' },
  atmosphere: { title: '雰囲気ランキング', valueKey: 'atmosphere_avg', valueLabel: '雰囲気評価', valueType: 'rating' },
  credit: { title: '単位取得ランキング', valueKey: 'credit_avg', valueLabel: '単位取得評価', valueType: 'rating' },
  tuition: { title: '学費満足度ランキング', valueKey: 'tuition_avg', valueLabel: '学費満足度', valueType: 'rating' },
  'review-count': { title: '口コミ数ランキング', valueKey: 'review_count', valueLabel: '口コミ数', valueType: 'count' },
};

interface PageProps {
  params: Promise<{ type: string }> | { type: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}

function getStr(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const resolvedParams = params instanceof Promise ? await params : params;
  const resolvedSearch = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const page = parseInt(getStr(resolvedSearch.page) || '1', 10);

  const config = rankingConfig[resolvedParams.type];
  const title = config ? `通信制高校 ${config.title}` : 'ランキング';
  const appBaseUrl = getAppBaseUrl();
  const basePath = `/rankings/${resolvedParams.type}`;
  const canonical = page > 1 ? `${appBaseUrl}${basePath}?page=${page}` : `${appBaseUrl}${basePath}`;

  return {
    alternates: { canonical },
    openGraph: { url: canonical },
  };
}

export default async function RankingsTypePage({ params, searchParams }: PageProps) {
  const resolvedParams = params instanceof Promise ? await params : params;
  const resolvedSearch = searchParams instanceof Promise ? await searchParams : searchParams ?? {};

  const type = resolvedParams.type;
  const page = parseInt(getStr(resolvedSearch.page) || '1', 10);

  const result = await getRankingsByType(type, { page, limit: 20 });

  if ('error' in result) {
    if (result.error === '無効なランキングタイプです' || result.error.includes('進学実績')) {
      notFound();
    }
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <p className="text-gray-600">{result.error}</p>
            <Link href={appPath('/rankings')} className="mt-4 text-blue-500 hover:text-blue-600">
              ランキング一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const config = rankingConfig[type];
  if (!config) {
    notFound();
  }

  if (result.schools.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Link href={appPath('/rankings')} className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
              ← ランキング一覧に戻る
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{config.title}</h1>
          </div>
          <div className="text-center py-12">
            <p className="text-gray-600">ランキングデータがありません</p>
            <Link href={appPath('/rankings')} className="mt-4 text-blue-500 hover:text-blue-600">
              ランキング一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const startRank = (page - 1) * 20 + 1;
  const appBase = getAppBaseUrl().replace(/\/$/, '');
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `通信制高校 ${config.title}`,
    numberOfItems: result.schools.filter((s) => s.slug).length,
    itemListElement: result.schools
      .filter((school) => school.slug)
      .map((school, index) => ({
        '@type': 'ListItem' as const,
        position: startRank + index,
        name: school.name,
        url: `${appBase}/schools/${school.slug}`,
      })),
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <StructuredData data={itemListJsonLd} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href={appPath('/rankings')} className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← ランキング一覧に戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{config.title}</h1>
          <p className="text-gray-600">
            {result.total}校中 {startRank}位〜{Math.min(startRank + result.schools.length - 1, result.total)}位を表示
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {result.schools.map((school, index) => (
            <RankingCardServer
              key={school.id}
              rank={startRank + index}
              id={school.id}
              name={school.name}
              prefecture={school.prefecture}
              slug={school.slug}
              reviewCount={school.review_count}
              value={school[config.valueKey] as number | null}
              valueLabel={config.valueLabel}
              valueType={config.valueType}
            />
          ))}
        </div>

        {result.total_pages > 1 && (
          <div className="flex justify-center gap-2">
            {page > 1 ? (
              <Link
                href={page === 2 ? appPath(`/rankings/${type}`) : appPath(`/rankings/${type}?page=${page - 1}`)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                前へ
              </Link>
            ) : (
              <span className="px-4 py-2 border border-gray-300 rounded-lg opacity-50 cursor-not-allowed">前へ</span>
            )}
            <span className="px-4 py-2 text-gray-600">
              {page} / {result.total_pages}
            </span>
            {page < result.total_pages ? (
              <Link
                href={appPath(`/rankings/${type}?page=${page + 1}`)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                次へ
              </Link>
            ) : (
              <span className="px-4 py-2 border border-gray-300 rounded-lg opacity-50 cursor-not-allowed">次へ</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
