'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import StarRatingDisplay from '@/components/StarRatingDisplay';
import RatingDisplay from '@/components/RatingDisplay';
import LikeButton from '@/components/LikeButton';

interface Review {
  id: string;
  school_id: string;
  school_name: string;
  school_slug: string | null;
  respondent_role: string;
  status: string;
  overall_satisfaction: number;
  good_comment: string;
  bad_comment: string;
  enrollment_year: number | null;
  attendance_frequency: string | null;
  reason_for_choosing: string[];
  staff_rating: number | null;
  atmosphere_fit_rating: number | null;
  credit_rating: number | null;
  tuition_rating: number | null;
  like_count: number;
  is_liked: boolean;
  created_at: string;
}

export default function ReviewDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReview = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/reviews/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/schools');
          return;
        }
        throw new Error('口コミ情報の取得に失敗しました');
      }

      const data = await response.json();
      setReview(data);
    } catch (error) {
      console.error('口コミ情報取得エラー:', error);
      alert('口コミ情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
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

  if (!review) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* ヘッダー */}
        <div className="mb-6">
          {review.school_slug ? (
            <Link
              href={`/schools/${review.school_slug}`}
              className="text-sm text-orange-600 hover:text-orange-700 mb-4 inline-block"
            >
              ← {review.school_name}の詳細に戻る
            </Link>
          ) : (
            <Link
              href="/schools"
              className="text-sm text-orange-600 hover:text-orange-700 mb-4 inline-block"
            >
              ← 学校一覧に戻る
            </Link>
          )}
        </div>

        {/* 口コミ詳細 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {review.school_name}の口コミ
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                <StarRatingDisplay value={review.overall_satisfaction} size="md" />
                <span>{formatDate(review.created_at)}</span>
              </div>
            </div>
            <LikeButton
              reviewId={review.id}
              initialLikeCount={review.like_count}
              initialIsLiked={review.is_liked}
            />
          </div>

          {/* 基本情報 */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">投稿者:</span>
                <span className="ml-2 text-gray-900">{review.respondent_role}</span>
              </div>
              <div>
                <span className="text-gray-600">状況:</span>
                <span className="ml-2 text-gray-900">{review.status}</span>
              </div>
              {review.enrollment_year && (
                <div>
                  <span className="text-gray-600">入学年:</span>
                  <span className="ml-2 text-gray-900">{review.enrollment_year}年</span>
                </div>
              )}
              {review.attendance_frequency && (
                <div>
                  <span className="text-gray-600">通学頻度:</span>
                  <span className="ml-2 text-gray-900">{review.attendance_frequency}</span>
                </div>
              )}
            </div>
            {review.reason_for_choosing.length > 0 && (
              <div className="mt-4">
                <span className="text-gray-600 text-sm">通信制を選んだ理由:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {review.reason_for_choosing.map((reason, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm"
                    >
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 詳細評価 */}
          {(review.staff_rating || review.atmosphere_fit_rating || review.credit_rating || review.tuition_rating) && (
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">詳細評価</h2>
              <RatingDisplay
                staffRating={review.staff_rating}
                atmosphereFitRating={review.atmosphere_fit_rating}
                creditRating={review.credit_rating}
                tuitionRating={review.tuition_rating}
              />
            </div>
          )}

          {/* 良かった点 */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">良かった点</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{review.good_comment}</p>
          </div>

          {/* 改善してほしい点 */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">改善してほしい点</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{review.bad_comment}</p>
          </div>
        </div>
      </div>
    </div>
  );
}


