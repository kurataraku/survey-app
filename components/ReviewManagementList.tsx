'use client';

import { useState, useEffect } from 'react';
import { Review } from '@/lib/types/reviews';

interface ReviewManagementListProps {
  schoolId: string;
}

export default function ReviewManagementList({ schoolId }: ReviewManagementListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<'all' | 'public' | 'private'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const limit = 20;

  useEffect(() => {
    fetchReviews();
  }, [schoolId, page, filter]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (filter === 'public') {
        params.append('is_public', 'true');
      } else if (filter === 'private') {
        params.append('is_public', 'false');
      }

      const response = await fetch(`/api/admin/schools/${schoolId}/reviews?${params.toString()}`);
      if (!response.ok) {
        throw new Error('口コミ一覧の取得に失敗しました');
      }

      const data = await response.json();
      setReviews(data.reviews || []);
      setTotalPages(data.total_pages || 1);
    } catch (error) {
      console.error('口コミ一覧取得エラー:', error);
      alert('口コミ一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePublic = async (reviewId: string, currentIsPublic: boolean) => {
    setUpdatingId(reviewId);
    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_public: !currentIsPublic,
        }),
      });

      if (!response.ok) {
        throw new Error('口コミの更新に失敗しました');
      }

      // リストを更新
      setReviews((prev) =>
        prev.map((review) =>
          review.id === reviewId ? { ...review, is_public: !currentIsPublic } : review
        )
      );
    } catch (error) {
      console.error('口コミ更新エラー:', error);
      alert('口コミの更新に失敗しました');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ja-JP');
  };

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">口コミ管理</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setFilter('all');
              setPage(1);
            }}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            すべて
          </button>
          <button
            type="button"
            onClick={() => {
              setFilter('public');
              setPage(1);
            }}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === 'public'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            採用中
          </button>
          <button
            type="button"
            onClick={() => {
              setFilter('private');
              setPage(1);
            }}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              filter === 'private'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            不採用
          </button>
        </div>
      </div>

      {reviews.length === 0 ? (
        <p className="text-gray-500 text-center py-8">口コミがありません</p>
      ) : (
        <>
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {review.respondent_role}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        {review.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg font-semibold text-gray-900">
                        {review.overall_satisfaction} / 5
                      </span>
                      <div className="flex">
                        {Array.from({ length: 5 }, (_, i) => (
                          <svg
                            key={i}
                            className={`w-4 h-4 ${
                              i < review.overall_satisfaction
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-300 fill-gray-300'
                            }`}
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    <div className="text-sm text-gray-700 space-y-1">
                      <div>
                        <span className="font-medium">良かった点：</span>
                        {review.good_comment}
                      </div>
                      <div>
                        <span className="font-medium">改善点：</span>
                        {review.bad_comment}
                      </div>
                    </div>
                  </div>
                  <div className="ml-4">
                    <button
                      type="button"
                      onClick={() => handleTogglePublic(review.id, review.is_public)}
                      disabled={updatingId === review.id}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        review.is_public
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      } disabled:opacity-50`}
                    >
                      {updatingId === review.id
                        ? '更新中...'
                        : review.is_public
                        ? '採用中'
                        : '不採用'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
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
  );
}




