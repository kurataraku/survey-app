'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import StarRatingDisplay from '@/components/StarRatingDisplay';
import RatingDisplay from '@/components/RatingDisplay';

interface School {
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
  intro: string | null;
  highlights: any;
  faq: any;
  review_count: number;
  overall_avg: number | null;
  staff_rating_avg: number | null;
  atmosphere_fit_rating_avg: number | null;
  credit_rating_avg: number | null;
  tuition_rating_avg: number | null;
  latest_reviews: Array<{
    id: string;
    overall_satisfaction: number;
    good_comment: string;
    created_at: string;
  }>;
}

export default function SchoolDetailByIdPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchool();
  }, [id]);

  const fetchSchool = async () => {
    setLoading(true);
    try {
      // IDで学校を取得
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(`/api/schools/id/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/schools');
          return;
        }
        throw new Error('学校情報の取得に失敗しました');
      }

      const data = await response.json();
      setSchool(data);
      
      // slugがある場合はslugベースのURLにリダイレクト
      if (data.slug) {
        router.replace(`/schools/${data.slug}`);
      }
    } catch (error) {
      console.error('学校情報取得エラー:', error);
      alert('学校情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

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

  if (!school) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="mb-4">
            <Link
              href="/schools"
              className="text-sm text-orange-600 hover:text-orange-700 mb-4 inline-block"
            >
              ← 学校一覧に戻る
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {school.name}
          </h1>
          <p className="text-gray-600 mb-4">{school.prefecture}</p>

          {/* 評価サマリー */}
          <div className="flex items-center gap-6 pt-4 border-t border-gray-200">
            {school.overall_avg !== null ? (
              <>
                <div className="flex items-center gap-2">
                  <StarRatingDisplay value={school.overall_avg} size="lg" showLabel />
                </div>
                <div className="text-sm text-gray-600">
                  <span className="text-2xl font-bold text-gray-900">
                    {school.overall_avg.toFixed(1)}
                  </span>
                  <span className="ml-1">/ 5.0</span>
                </div>
              </>
            ) : (
              <span className="text-gray-400">評価なし</span>
            )}
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{school.review_count}</span>件の口コミ
            </div>
            {school.slug ? (
              <Link
                href={`/schools/${school.slug}/reviews`}
                className="ml-auto px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
              >
                すべての口コミを見る
              </Link>
            ) : (
              <Link
                href={`/schools/id/${id}/reviews`}
                className="ml-auto px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
              >
                すべての口コミを見る
              </Link>
            )}
          </div>
        </div>

        {/* 詳細評価 */}
        {school.overall_avg !== null && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">詳細評価</h2>
            <RatingDisplay
              staffRating={school.staff_rating_avg}
              atmosphereFitRating={school.atmosphere_fit_rating_avg}
              creditRating={school.credit_rating_avg}
              tuitionRating={school.tuition_rating_avg}
            />
          </div>
        )}

        {/* 学校紹介 */}
        {school.intro && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">学校紹介</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{school.intro}</p>
          </div>
        )}

        {/* 最新の口コミ */}
        {school.latest_reviews.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">最新の口コミ</h2>
              {school.slug ? (
                <Link
                  href={`/schools/${school.slug}/reviews`}
                  className="text-sm text-orange-600 hover:text-orange-700"
                >
                  すべて見る →
                </Link>
              ) : (
                <Link
                  href={`/schools/id/${id}/reviews`}
                  className="text-sm text-orange-600 hover:text-orange-700"
                >
                  すべて見る →
                </Link>
              )}
            </div>
            <div className="space-y-4">
              {school.latest_reviews.map((review) => (
                <Link
                  key={review.id}
                  href={`/reviews/${review.id}`}
                  className="block p-4 border border-gray-200 rounded-lg hover:border-orange-300 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <StarRatingDisplay value={review.overall_satisfaction} size="sm" />
                    <span className="text-sm text-gray-500">
                      {formatDate(review.created_at)}
                    </span>
                  </div>
                  <p className="text-gray-700 line-clamp-2">{review.good_comment}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}





