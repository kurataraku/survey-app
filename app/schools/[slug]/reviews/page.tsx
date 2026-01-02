'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ReviewCard from '@/components/ReviewCard';

interface Review {
  id: string;
  school_id: string;
  school_name: string;
  school_slug: string | null;
  overall_satisfaction: number;
  good_comment: string;
  bad_comment: string;
  enrollment_year: number | null;
  attendance_frequency: string | null;
  like_count: number;
  created_at: string;
}

export default function SchoolReviewsPage() {
  const params = useParams();
  const router = useRouter();
  // URLエンコードされたslugをデコード
  const slug = decodeURIComponent(params.slug as string);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sort, setSort] = useState('newest');
  const [schoolName, setSchoolName] = useState('');

  const limit = 20;

  useEffect(() => {
    fetchReviews();
  }, [slug, page, sort]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      // slugをエンコードして送信
      const encodedSlug = encodeURIComponent(slug);
      const params = new URLSearchParams({
        school_slug: encodedSlug,
        sort: sort,
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await fetch(`/api/reviews?${params.toString()}`);
      if (!response.ok) {
        throw new Error('口コミ取得に失敗しました');
      }

      const data = await response.json();
      setReviews(data.reviews);
      setTotal(data.total);
      setTotalPages(data.total_pages);
      if (data.reviews.length > 0) {
        setSchoolName(data.reviews[0].school_name);
      }
    } catch (error) {
      console.error('口コミ取得エラー:', error);
      alert('口コミの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href={`/schools/${slug}`}
            className="text-sm text-orange-600 hover:text-orange-700 mb-4 inline-block"
          >
            ← 学校詳細に戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {schoolName || '口コミ一覧'}
          </h1>
          {total > 0 && (
            <p className="text-gray-600">{total}件の口コミ</p>
          )}
        </div>

        {/* ソート */}
        <div className="mb-6 flex justify-end">
          <select
            value={sort}
            onChange={handleSortChange}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="newest">新着順</option>
            <option value="oldest">古い順</option>
            <option value="rating_desc">評価が高い順</option>
            <option value="rating_asc">評価が低い順</option>
          </select>
        </div>

        {/* 口コミ一覧 */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">読み込み中...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">口コミが見つかりませんでした</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  id={review.id}
                  schoolName={review.school_name}
                  schoolSlug={review.school_slug}
                  overallSatisfaction={review.overall_satisfaction}
                  goodComment={review.good_comment}
                  badComment={review.bad_comment}
                  enrollmentYear={review.enrollment_year}
                  attendanceFrequency={review.attendance_frequency}
                  likeCount={review.like_count}
                  createdAt={review.created_at}
                />
              ))}
            </div>

            {/* ページネーション */}
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

