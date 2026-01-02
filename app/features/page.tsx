'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ArticleCard from '@/components/ArticleCard';
import { Article } from '@/lib/types/articles';

function FeaturesPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeCategory, setActiveCategory] = useState<'interview' | 'useful_info' | 'all'>(
    (searchParams.get('category') as 'interview' | 'useful_info') || 'all'
  );

  const limit = 12;

  useEffect(() => {
    fetchArticles();
  }, [page, activeCategory]);

  const fetchArticles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (activeCategory !== 'all') {
        params.append('category', activeCategory);
      }

      const response = await fetch(`/api/articles?${params.toString()}`);
      if (!response.ok) {
        throw new Error('記事一覧の取得に失敗しました');
      }

      const data = await response.json();
      setArticles(data.articles);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error('記事一覧取得エラー:', error);
      alert('記事一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryChange = (category: 'interview' | 'useful_info' | 'all') => {
    setActiveCategory(category);
    setPage(1);
    const params = new URLSearchParams();
    if (category !== 'all') {
      params.append('category', category);
    }
    router.push(`/features?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">特集ページ</h1>

          {/* カテゴリタブ */}
          <div className="flex gap-4 mb-6 border-b border-gray-200">
            <button
              onClick={() => handleCategoryChange('all')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeCategory === 'all'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              すべて
            </button>
            <button
              onClick={() => handleCategoryChange('interview')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeCategory === 'interview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              リアル体験談 クチコミ・インタビュー
            </button>
            <button
              onClick={() => handleCategoryChange('useful_info')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeCategory === 'useful_info'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              通信制高校お役立ち情報
            </button>
          </div>

          {total > 0 && (
            <p className="text-gray-600">
              {total}件の記事が見つかりました
            </p>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">記事が見つかりませんでした</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  id={article.id}
                  title={article.title}
                  slug={article.slug}
                  category={article.category}
                  excerpt={article.excerpt}
                  featured_image_url={article.featured_image_url}
                  published_at={article.published_at}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  前へ
                </button>
                <span className="px-4 py-2 text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  次へ
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function FeaturesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </div>
      </div>
    }>
      <FeaturesPageContent />
    </Suspense>
  );
}




