'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ReviewCard from '@/components/ReviewCard';

interface Review {
  id: string;
  school_id: string | null;
  school_name: string;
  overall_satisfaction: number;
  good_comment: string;
  created_at: string;
  like_count: number;
  schools: {
    id: string;
    name: string;
    slug: string | null;
  } | null;
}

function ReviewsPageContent() {
  const searchParams = useSearchParams();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const limit = 20;

  useEffect(() => {
    const pageParam = searchParams.get('page');
    if (pageParam) {
      const parsedPage = parseInt(pageParam, 10);
      if (!isNaN(parsedPage) && parsedPage > 0) {
        setPage(parsedPage);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    fetchReviews();
  }, [page]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await fetch(`/api/reviews?${params.toString()}`);
      if (!response.ok) {
        throw new Error('レビュー取得に失敗しました');
      }

      const data = await response.json();
      setReviews(data.reviews);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error('レビュー取得エラー:', error);
      alert('レビュー取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            最新口コミ
          </h1>
          {total > 0 && (
            <p className="text-gray-600 mb-4">
              {total}件の口コミが見つかりました
            </p>
          )}
        </div>

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  id={review.id}
                  schoolName={review.schools?.name || review.school_name}
                  schoolSlug={review.schools?.slug || null}
                  overallSatisfaction={review.overall_satisfaction}
                  goodComment={review.good_comment}
                  enrollmentYear={null}
                  attendanceFrequency={null}
                  likeCount={review.like_count}
                  createdAt={review.created_at}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => {
                    const newPage = page - 1;
                    setPage(newPage);
                    window.history.pushState({}, '', `/reviews?page=${newPage}`);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  前へ
                </button>
                <span className="px-4 py-2 text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => {
                    const newPage = page + 1;
                    setPage(newPage);
                    window.history.pushState({}, '', `/reviews?page=${newPage}`);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
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

export default function ReviewsPage() {
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
      <ReviewsPageContent />
    </Suspense>
  );
}




