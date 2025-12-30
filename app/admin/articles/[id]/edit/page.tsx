'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ArticleEditor from '@/components/ArticleEditor';
import ArticleSchoolList from '@/components/ArticleSchoolList';
import { ArticleFormData, Article } from '@/lib/types/articles';

export default function EditArticlePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'article' | 'schools'>('article');

  useEffect(() => {
    fetchArticle();
  }, [id]);

  const fetchArticle = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/articles/${id}`);
      if (!response.ok) {
        throw new Error('記事の取得に失敗しました');
      }
      const data = await response.json();
      setArticle(data);
    } catch (error) {
      console.error('記事取得エラー:', error);
      alert('記事の取得に失敗しました');
      router.push('/admin/articles');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: ArticleFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/articles/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '記事の更新に失敗しました');
      }

      alert('記事を更新しました');
      fetchArticle();
    } catch (error) {
      console.error('記事更新エラー:', error);
      alert(error instanceof Error ? error.message : '記事の更新に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center py-12">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/admin/articles"
            className="text-sm text-orange-600 hover:text-orange-700 mb-4 inline-block"
          >
            ← 記事一覧に戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">記事編集</h1>
        </div>

        {/* タブ */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('article')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'article'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              記事内容
            </button>
            <button
              onClick={() => setActiveTab('schools')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'schools'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              関連学校
            </button>
          </nav>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'article' ? (
            <ArticleEditor
              initialData={{
                title: article.title,
                slug: article.slug,
                category: article.category,
                content: article.content || '',
                excerpt: article.excerpt || '',
                featured_image_url: article.featured_image_url || '',
                is_public: article.is_public,
                published_at: article.published_at,
                meta_title: article.meta_title || '',
                meta_description: article.meta_description || '',
              }}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          ) : (
            <ArticleSchoolList articleId={id} />
          )}
        </div>
      </div>
    </div>
  );
}

