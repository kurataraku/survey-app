import Link from 'next/link';
import FeaturesListServer from '@/components/FeaturesListServer';
import { getArticlesList } from '@/lib/articles/getArticlesList';
import { appPath } from '@/lib/base-path';
import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';

/** 常にサーバーでレンダリングし、記事カードを初期HTMLに含める（クローラー対応） */
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
  title: '特集ページ | 通信制高校リアルレビュー',
  description: '通信制高校のリアル体験談やお役立ち情報。在校生・卒業生のインタビューや選び方のヒントを掲載。',
  alternates: { canonical: `${getAppBaseUrl()}/features` },
};

export default async function FeaturesPage({ searchParams }: PageProps) {
  const resolved = searchParams instanceof Promise ? await searchParams : searchParams ?? {};
  const page = parseInt(getStr(resolved.page) || '1', 10);
  const category = getStr(resolved.category) as '' | 'interview' | 'useful_info' || '';

  const data = await getArticlesList({
    page,
    limit: 12,
    category: category && (category === 'interview' || category === 'useful_info') ? category : '',
  });

  const activeCategory = category === 'interview' || category === 'useful_info' ? category : 'all';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">特集ページ</h1>

          <Link
            href={appPath('/features/topics')}
            className="group mb-6 flex items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3 md:px-5 hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <span className="text-sm text-gray-700 leading-relaxed">
              <span className="font-semibold text-blue-700">選び方ガイド</span>
              <span className="mx-1.5 text-gray-400" aria-hidden>|</span>
              学費・公立・スクーリング・転入など、テーマから記事を探せます
            </span>
            <svg
              className="w-4 h-4 shrink-0 text-blue-600 group-hover:translate-x-0.5 transition-transform"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <div className="flex gap-4 mb-6 border-b border-gray-200">
            <Link
              href={appPath('/features')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeCategory === 'all'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              すべて
            </Link>
            <Link
              href={appPath('/features?category=interview')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeCategory === 'interview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              リアル体験談 クチコミ・インタビュー
            </Link>
            <Link
              href={appPath('/features?category=useful_info')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeCategory === 'useful_info'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              通信制高校お役立ち情報
            </Link>
          </div>

          {data.total > 0 && (
            <p className="text-gray-600">{data.total}件の記事が見つかりました</p>
          )}
        </div>

        <FeaturesListServer
          articles={data.articles}
          page={page}
          totalPages={data.totalPages}
          category={category && (category === 'interview' || category === 'useful_info') ? category : ''}
        />
      </div>
    </div>
  );
}
