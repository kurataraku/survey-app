'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface School {
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
  is_public: boolean;
  review_count?: number;
  overall_avg?: number | null;
}

function SchoolsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  const limit = 20;

  useEffect(() => {
    fetchSchools();
  }, [page, searchQuery]);

  const fetchSchools = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (searchQuery) {
        params.append('q', searchQuery);
      }

      const response = await fetch(`/api/admin/schools?${params.toString()}`);
      if (!response.ok) {
        throw new Error('学校一覧の取得に失敗しました');
      }

      const data = await response.json();
      
      // 各学校の口コミ数を取得
      const schoolsWithStats = await Promise.all(
        (data.schools || []).map(async (school: School) => {
          try {
            const reviewResponse = await fetch(`/api/admin/schools/${school.id}/reviews?is_public=true&limit=1`);
            if (reviewResponse.ok) {
              const reviewData = await reviewResponse.json();
              return {
                ...school,
                review_count: reviewData.total || 0,
              };
            }
          } catch (error) {
            console.error(`学校 ${school.id} の口コミ数取得エラー:`, error);
          }
          return {
            ...school,
            review_count: 0,
          };
        })
      );

      setSchools(schoolsWithStats);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error('学校一覧取得エラー:', error);
      alert('学校一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    const params = new URLSearchParams();
    if (searchQuery) {
      params.append('q', searchQuery);
    }
    router.push(`/admin/schools?${params.toString()}`);
    fetchSchools();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-gray-900">学校管理</h1>
            <Link
              href="/admin/schools/new"
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              新規作成
            </Link>
          </div>

          <form onSubmit={handleSearch} className="flex gap-4 mb-6">
            <div className="flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="学校名で検索"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              検索
            </button>
          </form>

          {total > 0 && (
            <p className="text-gray-600">
              {total}件の学校が見つかりました
            </p>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        ) : schools.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">学校が見つかりませんでした</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      学校名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      都道府県
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      スラッグ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状態
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      口コミ数
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {schools.map((school) => (
                    <tr key={school.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {school.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {school.prefecture}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {school.slug || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {school.is_public ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            公開中
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                            非公開
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {school.review_count || 0}件
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/admin/schools/${school.id}/edit`}
                          className="text-orange-600 hover:text-orange-900"
                        >
                          編集
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
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

export default function SchoolsPage() {
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
      <SchoolsPageContent />
    </Suspense>
  );
}

