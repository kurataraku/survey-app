'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import StarRatingDisplay from '@/components/StarRatingDisplay';
import RatingDisplay from '@/components/RatingDisplay';
import SchoolRadarChart from '@/components/SchoolRadarChart';
import { getQuestionLabel } from '@/lib/questionLabels';
import SchoolSummary from '@/components/SchoolSummary';
import Tabs from '@/components/ui/Tabs';
import StatisticsSection from '@/components/StatisticsSection';

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
  prefectures?: string[] | null;
  global_averages?: {
    flexibility_rating_avg: number | null;
    staff_rating_avg: number | null;
    support_rating_avg: number | null;
    atmosphere_fit_rating_avg: number | null;
    credit_rating_avg: number | null;
    unique_course_rating_avg: number | null;
    career_support_rating_avg: number | null;
    campus_life_rating_avg: number | null;
    tuition_rating_avg: number | null;
  };
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
    like_count?: number;
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
          prefectures={school.prefectures || undefined}
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
                  <div className="space-y-6">
                    {school.global_averages && (
                      <details className="bg-blue-50/60 border border-blue-100 rounded-lg p-4">
                        <summary className="text-sm font-semibold text-blue-800 cursor-pointer flex items-center justify-between">
                          図で見る（レーダーチャート）
                          <span className="text-xs font-normal text-blue-600 ml-2">
                            クリックして開く
                          </span>
                        </summary>
                        <div className="mt-4">
                          <SchoolRadarChart
                            metrics={[
                              {
                                label: '学びの柔軟さ（通学回数・時間割などの調整のしやすさ）',
                                schoolValue: school.flexibility_rating_avg,
                                globalValue:
                                  school.global_averages.flexibility_rating_avg,
                              },
                              {
                                label: '先生・職員の対応',
                                schoolValue: school.staff_rating_avg,
                                globalValue:
                                  school.global_averages.staff_rating_avg,
                              },
                              {
                                label: '心や体調の波・不安などに対するサポート',
                                schoolValue: school.support_rating_avg,
                                globalValue:
                                  school.global_averages.support_rating_avg,
                              },
                              {
                                label: '在校生の雰囲気',
                                schoolValue: school.atmosphere_fit_rating_avg,
                                globalValue:
                                  school.global_averages
                                    .atmosphere_fit_rating_avg,
                              },
                              {
                                label: '単位取得のしやすさ',
                                schoolValue: school.credit_rating_avg,
                                globalValue:
                                  school.global_averages.credit_rating_avg,
                              },
                              {
                                label: '学校独自の授業・コースの充実度',
                                schoolValue: school.unique_course_rating_avg,
                                globalValue:
                                  school.global_averages
                                    .unique_course_rating_avg,
                              },
                              {
                                label: '進学・就職など進路サポートの手厚さ',
                                schoolValue: school.career_support_rating_avg,
                                globalValue:
                                  school.global_averages
                                    .career_support_rating_avg,
                              },
                              {
                                label: '授業以外の学校行事やキャンパスライフ',
                                schoolValue: school.campus_life_rating_avg,
                                globalValue:
                                  school.global_averages.campus_life_rating_avg,
                              },
                              {
                                label: '学費の納得感',
                                schoolValue: school.tuition_rating_avg,
                                globalValue:
                                  school.global_averages.tuition_rating_avg,
                              },
                            ]}
                          />
                        </div>
                      </details>
                    )}
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
                      globalAverages={school.global_averages}
                    />
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">評価データがありません</p>
                ),
              },
              {
                id: 'statistics',
                label: 'みんな（口コミ回答者）の傾向',
                content: school.statistics && school.review_count > 0 ? (
                  <div className="space-y-6">
                    {/* 基本 */}
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 mb-4">基本</h2>
                      <div className="space-y-4">
                        <StatisticsSection
                          title="投稿者の立場"
                          items={[
                            {
                              label: '本人',
                              count: school.statistics.respondent_role.本人,
                              percentage: Math.round((school.statistics.respondent_role.本人 / school.review_count) * 100),
                            },
                            {
                              label: '保護者',
                              count: school.statistics.respondent_role.保護者,
                              percentage: Math.round((school.statistics.respondent_role.保護者 / school.review_count) * 100),
                            },
                          ]}
                          type="bar"
                          totalCount={school.review_count}
                          maxInitialItems={3}
                        />
                        <StatisticsSection
                          title="現在の状況"
                          items={Object.entries(school.statistics.status).map(([status, count]) => ({
                            label: status,
                            count,
                            percentage: Math.round((count / school.review_count) * 100),
                          }))}
                          type="bar"
                          totalCount={school.review_count}
                          maxInitialItems={3}
                        />
                      </div>
                    </div>

                    {/* 学び方 */}
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 mb-4">学び方</h2>
                      <div className="space-y-4">
                        {Object.keys(school.statistics.attendance_frequency).length > 0 && (
                          <StatisticsSection
                            title="主な通学頻度"
                            items={Object.entries(school.statistics.attendance_frequency)
                              .sort(([, a], [, b]) => b - a)
                              .map(([frequency, count]) => ({
                                label: frequency,
                                count,
                                percentage: Math.round((count / school.review_count) * 100),
                              }))}
                            type="bar"
                            totalCount={school.review_count}
                            maxInitialItems={3}
                          />
                        )}
                        {Object.keys(school.statistics.teaching_style).length > 0 && (
                          <StatisticsSection
                            title="授業のスタイル"
                            items={Object.entries(school.statistics.teaching_style)
                              .sort(([, a], [, b]) => b - a)
                              .map(([style, count]) => ({
                                label: getQuestionLabel('teaching_style', style),
                                count,
                                percentage: Math.round((count / school.review_count) * 100),
                              }))}
                            type="badge"
                            totalCount={school.review_count}
                            maxInitialItems={3}
                          />
                        )}
                      </div>
                    </div>

                    {/* 選んだ理由 */}
                    {Object.keys(school.statistics.reason_for_choosing).length > 0 && (
                      <div>
                        <h2 className="text-lg font-bold text-gray-900 mb-4">選んだ理由</h2>
                        <StatisticsSection
                          title="通信制を選んだ理由"
                          items={Object.entries(school.statistics.reason_for_choosing)
                            .sort(([, a], [, b]) => b - a)
                            .map(([reason, count]) => ({
                              label: reason,
                              count,
                              percentage: Math.round((count / school.review_count) * 100),
                            }))}
                          type="badge"
                          totalCount={school.review_count}
                          maxInitialItems={3}
                        />
                      </div>
                    )}

                    {/* 雰囲気 */}
                    {Object.keys(school.statistics.student_atmosphere).length > 0 && (
                      <div>
                        <h2 className="text-lg font-bold text-gray-900 mb-4">雰囲気</h2>
                        <StatisticsSection
                          title="生徒の雰囲気"
                          items={Object.entries(school.statistics.student_atmosphere)
                            .sort(([, a], [, b]) => b - a)
                            .map(([atmosphere, count]) => ({
                              label: getQuestionLabel('student_atmosphere', atmosphere),
                              count,
                              percentage: Math.round((count / school.review_count) * 100),
                            }))}
                          type="badge"
                          totalCount={school.review_count}
                          maxInitialItems={3}
                        />
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
                        className="block p-5 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
                      >
                        {/* 上段：★/日付/属性チップ */}
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                          <StarRatingDisplay value={review.overall_satisfaction} size="sm" />
                          <span className="text-sm text-gray-500">
                            {formatDate(review.created_at)}
                          </span>
                        </div>
                        
                        {/* 本文：良い点/改善点を1行ずつ */}
                        <div className="space-y-2.5 mb-4">
                          {review.good_comment && (
                            <div>
                              <p className="text-xs font-semibold text-green-600 mb-1">良い点</p>
                              <p className="text-sm text-gray-700 line-clamp-1">{review.good_comment}</p>
                            </div>
                          )}
                          {review.bad_comment && (
                            <div>
                              <p className="text-xs font-semibold text-rose-600 mb-1">改善してほしい点</p>
                              <p className="text-sm text-gray-700 line-clamp-1">{review.bad_comment}</p>
                            </div>
                          )}
                        </div>
                        
                        {/* 下段：いいねと詳細導線 */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                              />
                            </svg>
                            <span>{review.like_count || 0}</span>
                          </div>
                          <span className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                            続きを読む →
                          </span>
                        </div>
                      </Link>
                    ))}
                    <div className="pt-4 border-t border-gray-200">
                      <Link
                        href={`/schools/${encodedSlug}/reviews`}
                        className="inline-block w-full text-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow-md"
                      >
                        自分に近い口コミを探す/全ての口コミを見る
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

        {/* 注目の口コミ（いいね数順） */}
        {school.latest_reviews && school.latest_reviews.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">注目の口コミ</h2>
            <div className="space-y-4">
              {school.latest_reviews.slice(0, 3).map((review) => (
                <Link
                  key={review.id}
                  href={`/reviews/${review.id}`}
                  className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600">総合満足度</span>
                      <StarRatingDisplay value={review.overall_satisfaction} size="sm" />
                      <span className="text-sm text-gray-500">
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                    {review.like_count !== undefined && review.like_count > 0 && (
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          />
                        </svg>
                        <span>{review.like_count}</span>
                      </div>
                    )}
                  </div>
                  {review.good_comment && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-green-600 mb-1">良い点</p>
                      <p className="text-sm text-gray-700 line-clamp-2">{review.good_comment}</p>
                    </div>
                  )}
                  {review.bad_comment && (
                    <div>
                      <p className="text-xs font-semibold text-rose-600 mb-1">改善してほしい点</p>
                      <p className="text-sm text-gray-700 line-clamp-2">{review.bad_comment}</p>
                    </div>
                  )}
                </Link>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <Link
                href={`/schools/${encodedSlug}/reviews`}
                className="inline-block w-full text-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                自分に近い口コミを探す/全ての口コミを見る
              </Link>
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

      </div>
    </div>
  );
}

