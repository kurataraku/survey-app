'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import SchoolCard from '@/components/SchoolCard';
import { Article, ArticleSchool } from '@/lib/types/articles';

export default function ArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const encodedSlug = params.slug as string;
  const slug = decodeURIComponent(encodedSlug);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticle();
  }, [encodedSlug]);

  const fetchArticle = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/articles/${encodedSlug}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/features');
          return;
        }
        throw new Error('記事の取得に失敗しました');
      }

      const data = await response.json();
      setArticle(data);
    } catch (error) {
      console.error('記事取得エラー:', error);
      alert('記事の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'interview':
        return 'リアル体験談 クチコミ・インタビュー';
      case 'useful_info':
        return '通信制高校お役立ち情報';
      default:
        return category;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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
      <div className="max-w-4xl mx-auto px-4">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href="/features"
            className="text-sm text-orange-600 hover:text-orange-700 mb-4 inline-block"
          >
            ← 特集ページ一覧に戻る
          </Link>
        </div>

        {/* 記事ヘッダー */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="mb-4">
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
              {getCategoryLabel(article.category)}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{article.title}</h1>
          {article.published_at && (
            <p className="text-sm text-gray-500 mb-4">{formatDate(article.published_at)}</p>
          )}
          {article.featured_image_url && (
            <div className="mb-6">
              <img
                src={article.featured_image_url}
                alt={article.title}
                className="w-full h-auto rounded-lg"
              />
            </div>
          )}
          {article.excerpt && (
            <p className="text-lg text-gray-700 mb-4">{article.excerpt}</p>
          )}
        </div>

        {/* 記事本文 */}
        {article.content && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <MarkdownRenderer content={article.content} />
          </div>
        )}

        {/* 関連学校 */}
        {article.schools && article.schools.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">関連学校</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {article.schools.map((articleSchool: ArticleSchool) => {
                if (!articleSchool.school) return null;
                const school = articleSchool.school;
                return (
                  <div key={articleSchool.id}>
                    <SchoolCard
                      id={school.id}
                      name={school.name}
                      prefecture={school.prefecture}
                      slug={school.slug}
                      reviewCount={school.review_count || 0}
                      overallAvg={school.overall_avg || null}
                    />
                    {articleSchool.note && (
                      <p className="mt-2 text-sm text-gray-600">{articleSchool.note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 関連リンク */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">その他の特集ページ</h2>
          <Link
            href="/features"
            className="text-orange-600 hover:text-orange-700 underline"
          >
            特集ページ一覧を見る →
          </Link>
        </div>
      </div>
    </div>
  );
}

