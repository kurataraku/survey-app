'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import StarRatingDisplay from '@/components/StarRatingDisplay';
import RatingDisplay from '@/components/RatingDisplay';
import { getQuestionLabel } from '@/lib/questionLabels';
import SchoolSummary from '@/components/SchoolSummary';
import Tabs from '@/components/ui/Tabs';

interface School {
  id: string;
  name: string;
  prefecture: string;
  slug: string;
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
  flexibility_rating_avg?: number | null;
  support_rating_avg?: number | null;
  unique_course_rating_avg?: number | null;
  career_support_rating_avg?: number | null;
  campus_life_rating_avg?: number | null;
  statistics?: {
    respondent_role: { 本人: number; 保護者: number };
    status: { 在籍中: number; 卒業した: number; '以前在籍していた（転校・退学など）': number };
    graduation_path: Record<string, number>;
    reason_for_choosing: Record<string, number>;
    enrollment_type: Record<string, number>;
    attendance_frequency: Record<string, number>;
    teaching_style: Record<string, number>;
    student_atmosphere: Record<string, number>;
  };
  latest_reviews: Array<{
    id: string;
    overall_satisfaction: number;
    good_comment: string;
    bad_comment: string;
    created_at: string;
  }>;
}

export default function SchoolDetailPage() {
  const params = useParams();
  const router = useRouter();
  // URLエンコードされたslugをデコード
  const encodedSlug = params.slug as string;
  const slug = decodeURIComponent(encodedSlug);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSchool();
  }, [encodedSlug]);

  const fetchSchool = async () => {
    setLoading(true);
    try {
      // encodedSlugはすでにエンコードされているため、そのまま使用
      // APIルート側でデコード処理を行う
      console.log('[Page] Fetching school with encodedSlug:', encodedSlug);
      console.log('[Page] Decoded slug:', slug);
      const response = await fetch(`/api/schools/${encodedSlug}`);
      if (!response.ok) {
        if (response.status === 404) {
          console.error('[Page] School not found, redirecting to /schools');
          router.push('/schools');
          return;
        }
        throw new Error('学校情報の取得に失敗しました');
      }

      const data = await response.json();
      setSchool(data);
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
        {/* 戻るリンク */}
        <div className="mb-4">
          <Link
            href="/schools"
            className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            学校一覧に戻る
          </Link>
        </div>

        {/* 結論サマリー */}
        <SchoolSummary
          name={school.name}
          prefecture={school.prefecture}
          slug={encodedSlug}
          overallAvg={school.overall_avg}
          reviewCount={school.review_count}
          staffRatingAvg={school.staff_rating_avg}
          atmosphereFitRatingAvg={school.atmosphere_fit_rating_avg}
          creditRatingAvg={school.credit_rating_avg}
          latestReviews={school.latest_reviews}
        />

        {/* タブで情報を段階的に表示 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <Tabs
            tabs={[
              {
                id: 'ratings',
                label: '詳細評価',
                content: school.overall_avg !== null ? (
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
                ) : (
                  <p className="text-gray-500 text-center py-8">評価データがありません</p>
                ),
              },
              {
                id: 'statistics',
                label: '口コミ統計',
                content: school.statistics && school.review_count > 0 ? (
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
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
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
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
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
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
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
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
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
                  ) : (
                    <p className="text-gray-500 text-center py-8">統計データがありません</p>
                  ),
                },
              {
                id: 'reviews',
                label: '最新の口コミ',
                content: school.latest_reviews.length > 0 ? (
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
                    <div className="pt-4 border-t border-gray-200">
                      <Link
                        href={`/schools/${encodedSlug}/reviews`}
                        className="inline-block w-full text-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        すべての口コミを見る
                      </Link>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">口コミがありません</p>
                ),
              },
            ]}
          />
        </div>

        {/* 学校紹介 */}
        {school.intro && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">学校紹介</h2>
            <p className="text-gray-700 whitespace-pre-wrap">{school.intro}</p>
          </div>
        )}

      </div>
    </div>
  );
}

