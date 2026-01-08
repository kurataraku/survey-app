'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import StarRatingDisplay from '@/components/StarRatingDisplay';
import RatingDisplay from '@/components/RatingDisplay';
import { getQuestionLabel } from '@/lib/questionLabels';

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
  outlier_counts?: {
    overall: number;
    staff: number;
    atmosphere: number;
    credit: number;
    tuition: number;
  };
  latest_reviews: Array<{
    id: string;
    overall_satisfaction: number;
    good_comment: string;
    bad_comment: string;
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
              className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-block"
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
                className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                すべての口コミを見る
              </Link>
            ) : (
              <Link
                href={`/schools/id/${id}/reviews`}
                className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
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
              flexibilityRating={school.flexibility_rating_avg}
              supportRating={school.support_rating_avg}
              uniqueCourseRating={school.unique_course_rating_avg}
              careerSupportRating={school.career_support_rating_avg}
              campusLifeRating={school.campus_life_rating_avg}
              outlierCounts={school.outlier_counts}
            />
          </div>
        )}

        {/* 統計情報 */}
        {school.statistics && school.review_count > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">口コミ統計</h2>
            <div className="space-y-6">
              {/* 投稿者の立場 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">投稿者の立場</h3>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-gray-600">本人</span>
                      <span className="text-sm font-medium text-gray-900">
                        {school.statistics.respondent_role.本人}件 ({Math.round((school.statistics.respondent_role.本人 / school.review_count) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${(school.statistics.respondent_role.本人 / school.review_count) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-gray-600">保護者</span>
                      <span className="text-sm font-medium text-gray-900">
                        {school.statistics.respondent_role.保護者}件 ({Math.round((school.statistics.respondent_role.保護者 / school.review_count) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all"
                        style={{ width: `${(school.statistics.respondent_role.保護者 / school.review_count) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 現在の状況 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">現在の状況</h3>
                <div className="space-y-2">
                  {Object.entries(school.statistics.status).map(([status, count]) => (
                    <div key={status}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-gray-600">{status}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {count}件 ({Math.round((count / school.review_count) * 100)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${(count / school.review_count) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 通信制を選んだ理由 */}
              {Object.keys(school.statistics.reason_for_choosing).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">通信制を選んだ理由</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(school.statistics.reason_for_choosing)
                      .sort(([, a], [, b]) => b - a)
                      .map(([reason, count]) => (
                        <span
                          key={reason}
                          className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                        >
                          {reason} ({count})
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* 通学頻度 */}
              {Object.keys(school.statistics.attendance_frequency).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">主な通学頻度</h3>
                  <div className="space-y-2">
                    {Object.entries(school.statistics.attendance_frequency)
                      .sort(([, a], [, b]) => b - a)
                      .map(([frequency, count]) => (
                        <div key={frequency}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-gray-600">{frequency}</span>
                            <span className="text-sm font-medium text-gray-900">
                              {count}件 ({Math.round((count / school.review_count) * 100)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all"
                              style={{ width: `${(count / school.review_count) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* 授業スタイル */}
              {Object.keys(school.statistics.teaching_style).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">授業のスタイル</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(school.statistics.teaching_style)
                      .sort(([, a], [, b]) => b - a)
                      .map(([style, count]) => (
                        <span
                          key={style}
                          className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                        >
                          {getQuestionLabel('teaching_style', style)} ({count})
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* 生徒の雰囲気 */}
              {Object.keys(school.statistics.student_atmosphere).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">生徒の雰囲気</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(school.statistics.student_atmosphere)
                      .sort(([, a], [, b]) => b - a)
                      .map(([atmosphere, count]) => (
                        <span
                          key={atmosphere}
                          className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm"
                        >
                          {getQuestionLabel('student_atmosphere', atmosphere)} ({count})
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
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
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  すべて見る →
                </Link>
              ) : (
                <Link
                  href={`/schools/id/${id}/reviews`}
                  className="text-sm text-blue-600 hover:text-blue-700"
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
                  className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <StarRatingDisplay value={review.overall_satisfaction} size="sm" />
                    <span className="text-sm text-gray-500">
                      {formatDate(review.created_at)}
                    </span>
                  </div>
                  {review.good_comment && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-green-600 mb-1">良い点</p>
                      <p className="text-gray-700 line-clamp-2">{review.good_comment}</p>
                    </div>
                  )}
                  {review.bad_comment && (
                    <div>
                      <p className="text-xs font-semibold text-rose-600 mb-1">改善してほしい点</p>
                      <p className="text-gray-700 line-clamp-2">{review.bad_comment}</p>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}







