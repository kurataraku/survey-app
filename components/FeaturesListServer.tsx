import Link from 'next/link';
import ArticleCardServer from '@/components/ArticleCardServer';
import type { ArticleListItem } from '@/lib/articles/getArticlesList';
import { appPath } from '@/lib/base-path';

interface FeaturesListServerProps {
  articles: ArticleListItem[];
  page: number;
  totalPages: number;
  category: '' | 'interview' | 'useful_info';
}

/**
 * 特集一覧 — Server Component でSSR保証
 * タイトル・抜粋を初期HTMLに確実に含め、クローラーがインデックスできるようにする
 */
export default function FeaturesListServer({
  articles,
  page,
  totalPages,
  category,
}: FeaturesListServerProps) {
  if (articles.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">記事が見つかりませんでした</p>
      </div>
    );
  }

  const prevHref =
    page <= 1
      ? '#'
      : page === 2
        ? category
          ? appPath(`/features?category=${category}`)
          : appPath('/features')
        : appPath(`/features?page=${page - 1}${category ? `&category=${category}` : ''}`);
  const nextHref =
    page >= totalPages ? '#' : appPath(`/features?page=${page + 1}${category ? `&category=${category}` : ''}`);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {articles.map((article) => (
          <ArticleCardServer
            key={article.id}
            id={article.id}
            title={article.title}
            slug={article.slug}
            category={
              article.category === 'interview' || article.category === 'useful_info'
                ? article.category
                : 'useful_info'
            }
            excerpt={article.excerpt}
            featured_image_url={article.featured_image_url}
            published_at={article.published_at}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <nav className="flex justify-center gap-2" aria-label="ページネーション">
          {page > 1 ? (
            <Link href={prevHref} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              前へ
            </Link>
          ) : (
            <span className="px-4 py-2 border border-gray-300 rounded-lg opacity-50 cursor-not-allowed">
              前へ
            </span>
          )}
          <span className="px-4 py-2 text-gray-600">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={nextHref} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              次へ
            </Link>
          ) : (
            <span className="px-4 py-2 border border-gray-300 rounded-lg opacity-50 cursor-not-allowed">
              次へ
            </span>
          )}
        </nav>
      )}
    </>
  );
}
