'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SchoolEditor from '@/components/SchoolEditor';
import { SchoolFormData } from '@/lib/types/schools';

export default function NewSchoolPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: SchoolFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/schools', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '学校の作成に失敗しました');
      }

      const school = await response.json();
      alert('学校を作成しました');
      router.push(`/admin/schools/${school.id}/edit`);
    } catch (error) {
      console.error('学校作成エラー:', error);
      alert(error instanceof Error ? error.message : '学校の作成に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/admin/schools"
            className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-block"
          >
            ← 学校一覧に戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">新規学校作成</h1>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <SchoolEditor onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </div>
      </div>
    </div>
  );
}

