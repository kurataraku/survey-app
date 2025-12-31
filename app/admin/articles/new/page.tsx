'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ArticleEditor from '@/components/ArticleEditor';
import { ArticleFormData } from '@/lib/types/articles';

export default function NewArticlePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: ArticleFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '記事の作成に失敗しました');
      }

      const article = await response.json();
      alert('記事を作成しました');
      router.push(`/admin/articles/${article.id}/edit`);
    } catch (error) {
      console.error('記事作成エラー:', error);
      alert(error instanceof Error ? error.message : '記事の作成に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <h1 className="text-3xl font-bold text-gray-900">新規記事作成</h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <ArticleEditor onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </div>
      </div>
    </div>
  );
}


