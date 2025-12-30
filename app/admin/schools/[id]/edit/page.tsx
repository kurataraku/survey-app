'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SchoolEditor from '@/components/SchoolEditor';
import ReviewManagementList from '@/components/ReviewManagementList';
import { SchoolFormData, School } from '@/lib/types/schools';

export default function EditSchoolPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'reviews'>('basic');

  useEffect(() => {
    fetchSchool();
  }, [id]);

  const fetchSchool = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/schools/${id}`);
      if (!response.ok) {
        throw new Error('学校の取得に失敗しました');
      }
      const data = await response.json();
      setSchool(data);
    } catch (error) {
      console.error('学校取得エラー:', error);
      alert('学校の取得に失敗しました');
      router.push('/admin/schools');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: SchoolFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/schools/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '学校情報の更新に失敗しました');
      }

      alert('学校情報を更新しました');
      fetchSchool();
    } catch (error) {
      console.error('学校更新エラー:', error);
      alert(error instanceof Error ? error.message : '学校情報の更新に失敗しました');
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

  if (!school) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            href="/admin/schools"
            className="text-sm text-orange-600 hover:text-orange-700 mb-4 inline-block"
          >
            ← 学校一覧に戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">学校編集</h1>
        </div>

        {/* タブ */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('basic')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'basic'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              基本情報
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'reviews'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              口コミ管理
            </button>
          </nav>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'basic' ? (
            <SchoolEditor
              initialData={{
                name: school.name,
                prefecture: school.prefecture,
                slug: school.slug || '',
                intro: school.intro || '',
                highlights: school.highlights || [],
                faq: school.faq || [],
                is_public: school.is_public,
              }}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          ) : (
            <ReviewManagementList schoolId={id} />
          )}
        </div>
      </div>
    </div>
  );
}

