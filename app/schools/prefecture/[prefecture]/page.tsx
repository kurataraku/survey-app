'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SchoolCard from '@/components/SchoolCard';

interface School {
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
  review_count: number;
  overall_avg: number | null;
}

function PrefectureSchoolsContent() {
  const params = useParams();
  const router = useRouter();
  const prefecture = decodeURIComponent(params.prefecture as string);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  useEffect(() => {
    fetchSchools();
  }, [prefecture, page]);

  const fetchSchools = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        prefecture: prefecture,
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await fetch(`/api/schools/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error('学校検索に失敗しました');
      }

      const data = await response.json();
      setSchools(data.schools);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error('学校検索エラー:', error);
      alert('学校検索に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/schools"
            className="text-blue-600 hover:text-blue-700 mb-4 inline-block"
          >
            ← 学校検索に戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {prefecture}の通信制高校
          </h1>
          {total > 0 && (
            <p className="text-gray-600">
              {total}校が見つかりました
            </p>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        ) : schools.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">
              {prefecture}の通信制高校が見つかりませんでした
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {schools.map((school) => (
                <SchoolCard
                  key={school.id}
                  id={school.id}
                  name={school.name}
                  prefecture={school.prefecture}
                  slug={school.slug}
                  reviewCount={school.review_count}
                  overallAvg={school.overall_avg}
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

export default function PrefectureSchoolsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
              <p className="text-gray-600">読み込み中...</p>
            </div>
          </div>
        </div>
      }
    >
      <PrefectureSchoolsContent />
    </Suspense>
  );
}



