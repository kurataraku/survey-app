import Link from 'next/link';
import ArticleCard from '@/components/ArticleCard';
import { getArticlesList } from '@/lib/articles/getArticlesList';
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

        {data.articles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">記事が見つかりませんでした</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {data.articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  id={article.id}
                  title={article.title}
                  slug={article.slug}
                  category={(article.category === 'interview' || article.category === 'useful_info') ? article.category : 'useful_info'}
                  excerpt={article.excerpt}
                  featured_image_url={article.featured_image_url}
                  published_at={article.published_at}
                />
              ))}
            </div>

            {data.totalPages > 1 && (
              <div className="flex justify-center gap-2">
                {page > 1 ? (
                  <Link
                    href={page === 2
                      ? (category ? appPath(`/features?category=${category}`) : appPath('/features'))
                      : appPath(`/features?page=${page - 1}${category ? `&category=${category}` : ''}`)}
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
                    href={appPath(`/features?page=${page + 1}${category ? `&category=${category}` : ''}`)}
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
