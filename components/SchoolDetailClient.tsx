'use client';

import Link from 'next/link';
import { Sparkles, CheckCircle2, XCircle, User } from 'lucide-react';
import StarRatingDisplay from '@/components/StarRatingDisplay';
import RatingDisplay from '@/components/RatingDisplay';
import SchoolRadarChart from '@/components/SchoolRadarChart';
import { getQuestionLabel } from '@/lib/questionLabels';
import SchoolSummary from '@/components/SchoolSummary';
import Tabs from '@/components/ui/Tabs';
import StatisticsSection from '@/components/StatisticsSection';
import { SchoolWithStats } from '@/lib/schools/getSchoolWithStats';
import { appPath } from '@/lib/base-path';

interface SchoolDetailClientProps {
  school: SchoolWithStats;
  encodedSlug: string;
}

export default function SchoolDetailClient({
  school,
  encodedSlug,
}: SchoolDetailClientProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <>
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

      {/* AIによる口コミ要約 */}
      {school.ai_summary && (
        <div className="bg-white rounded-2xl shadow-md p-6 md:p-8 mb-8 relative overflow-hidden border border-gray-200">
          {/* 上部薄い青のバー帯 */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
          
          {/* ヘッダー */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              AIによる口コミ要約
            </h2>
          </div>
          
          {/* 本文 */}
          <div className="prose prose-sm max-w-prose">
            <div className="text-gray-700 leading-relaxed space-y-4">
              {(() => {
                const lines = school.ai_summary.summary_text.split('\n');
                let currentSection: 'good' | 'bad' | null = null;
                
                return lines.map((line, index) => {
                  const trimmedLine = line.trim();
                  
                  // 「この学校が合う人」セクション
                  if (trimmedLine === '## この学校が合う人' || trimmedLine.startsWith('## この学校が合う人')) {
                    currentSection = 'good';
                    return (
                      <div key={index} className="flex items-start gap-2 mt-6 mb-4">
                        <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <h3 className="font-semibold text-gray-900 text-lg">この学校が合う人</h3>
                      </div>
                    );
                  }
                  
                  // 「この学校が合わない人」セクション
                  if (trimmedLine === '## この学校が合わない人' || trimmedLine.startsWith('## この学校が合わない人')) {
                    currentSection = 'bad';
                    return (
                      <div key={index} className="flex items-start gap-2 mt-6 mb-4">
                        <XCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
                        <h3 className="font-semibold text-gray-900 text-lg">この学校が合わない人</h3>
                      </div>
                    );
                  }
                  
                  // 箇条書きアイテム（「-」または「・」で始まる行）
                  if (/^[-・]\s/.test(trimmedLine)) {
                    const content = trimmedLine.replace(/^[-・]\s/, '');
                    if (currentSection === 'good') {
                      return (
                        <div key={index} className="flex items-start gap-3 ml-7 mb-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="flex-1 leading-relaxed">{content}</span>
                        </div>
                      );
                    } else if (currentSection === 'bad') {
                      return (
                        <div key={index} className="flex items-start gap-3 ml-7 mb-2">
                          <XCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                          <span className="flex-1 leading-relaxed">{content}</span>
                        </div>
                      );
                    }
                  }
                  
                  // 通常のテキスト行
                  if (trimmedLine && !trimmedLine.startsWith('##') && !/^[-・]\s/.test(trimmedLine)) {
                    // セクション判定をリセット（見出し以外の行では維持）
                    return (
                      <p key={index} className="mb-3 last:mb-0 leading-relaxed">
                        {line}
                      </p>
                    );
                  }
                  
                  // 空行
                  if (!trimmedLine) {
                    return <br key={index} />;
                  }
                  
                  return null;
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* タブで情報を段階的に表示 */}
      <div className="bg-white rounded-2xl shadow-md p-6 md:p-8 mb-8 border border-gray-200">
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
                              globalValue: school.global_averages.flexibility_rating_avg,
                            },
                            {
                              label: '先生・職員の対応',
                              schoolValue: school.staff_rating_avg,
                              globalValue: school.global_averages.staff_rating_avg,
                            },
                            {
                              label: '心や体調の波・不安などに対するサポート',
                              schoolValue: school.support_rating_avg,
                              globalValue: school.global_averages.support_rating_avg,
                            },
                            {
                              label: '在校生の雰囲気',
                              schoolValue: school.atmosphere_fit_rating_avg,
                              globalValue: school.global_averages.atmosphere_fit_rating_avg,
                            },
                            {
                              label: '単位取得のしやすさ',
                              schoolValue: school.credit_rating_avg,
                              globalValue: school.global_averages.credit_rating_avg,
                            },
                            {
                              label: '学校独自の授業・コースの充実度',
                              schoolValue: school.unique_course_rating_avg,
                              globalValue: school.global_averages.unique_course_rating_avg,
                            },
                            {
                              label: '進学・就職など進路サポートの手厚さ',
                              schoolValue: school.career_support_rating_avg,
                              globalValue: school.global_averages.career_support_rating_avg,
                            },
                            {
                              label: '授業以外の学校行事やキャンパスライフ',
                              schoolValue: school.campus_life_rating_avg,
                              globalValue: school.global_averages.campus_life_rating_avg,
                            },
                            {
                              label: '学費の納得感',
                              schoolValue: school.tuition_rating_avg,
                              globalValue: school.global_averages.tuition_rating_avg,
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
                            percentage: Math.round(
                              (school.statistics.respondent_role.本人 / school.review_count) * 100
                            ),
                          },
                          {
                            label: '保護者',
                            count: school.statistics.respondent_role.保護者,
                            percentage: Math.round(
                              (school.statistics.respondent_role.保護者 / school.review_count) *
                                100
                            ),
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
                      href={appPath(`/reviews/${review.id}`)}
                      className="block p-6 bg-white border border-gray-200 rounded-xl shadow-md hover:border-blue-400 hover:shadow-lg transition-all duration-200"
                    >
                      {/* 上段：★/日付/属性チップ */}
                      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
                        <div className="p-2 bg-blue-50 rounded-full">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <StarRatingDisplay value={review.overall_satisfaction} size="sm" />
                        <span className="text-sm text-gray-500">
                          {formatDate(review.created_at)}
                        </span>
                      </div>

                      {/* 本文：良い点/改善点を1行ずつ */}
                      <div className="space-y-4 mb-5">
                        {review.good_comment && (
                          <div className="p-3 bg-green-50/50 rounded-lg border-l-4 border-green-500">
                            <p className="text-xs font-semibold text-green-700 mb-2">良い点</p>
                            <p className="text-sm text-gray-700 leading-relaxed line-clamp-1">
                              {review.good_comment}
                            </p>
                          </div>
                        )}
                        {review.bad_comment && (
                          <div className="p-3 bg-rose-50/50 rounded-lg border-l-4 border-rose-500">
                            <p className="text-xs font-semibold text-rose-700 mb-2">
                              改善してほしい点
                            </p>
                            <p className="text-sm text-gray-700 leading-relaxed line-clamp-1">
                              {review.bad_comment}
                            </p>
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
                  <div className="pt-6 border-t border-gray-200">
                    <Link
                      href={appPath(`/schools/${encodedSlug}/reviews`)}
                      className="inline-block w-full text-center px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-700 hover:to-blue-600 active:from-blue-800 active:to-blue-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg active:shadow-sm active:translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-blue-300"
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
      {school.latest_reviews && school.latest_reviews.length > 0 && (() => {
        const featuredReviews = [...school.latest_reviews]
          .sort((a, b) => {
            const aLikes = a.like_count || 0;
            const bLikes = b.like_count || 0;
            return bLikes - aLikes; // 降順
          })
          .slice(0, 3); // 最大3件

        return featuredReviews.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-6 md:p-8 mb-8 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">注目の口コミ</h2>
            <div className="space-y-4">
              {featuredReviews.map((review) => (
              <Link
                key={review.id}
                href={appPath(`/reviews/${review.id}`)}
                className="block p-6 border border-gray-200 rounded-xl shadow-md hover:border-blue-400 hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-full">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-xs font-medium text-gray-600">総合満足度</span>
                    <StarRatingDisplay value={review.overall_satisfaction} size="sm" />
                    <span className="text-sm text-gray-500">{formatDate(review.created_at)}</span>
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
                  <div className="mb-4 p-3 bg-green-50/50 rounded-lg border-l-4 border-green-500">
                    <p className="text-xs font-semibold text-green-700 mb-2">良い点</p>
                    <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">{review.good_comment}</p>
                  </div>
                )}
                {review.bad_comment && (
                  <div className="p-3 bg-rose-50/50 rounded-lg border-l-4 border-rose-500">
                    <p className="text-xs font-semibold text-rose-700 mb-2">改善してほしい点</p>
                    <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">{review.bad_comment}</p>
                  </div>
                )}
              </Link>
              ))}
            </div>
          </div>
        ) : null;
      })()}

      {/* 口コミ一覧への導線 */}
      {school.latest_reviews && school.latest_reviews.length > 0 && (
        <div className="mb-8">
          <Link
            href={appPath(`/schools/${encodedSlug}/reviews`)}
            className="inline-block w-full text-center px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl hover:from-blue-700 hover:to-blue-600 active:from-blue-800 active:to-blue-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg active:shadow-sm active:translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-blue-300"
          >
            自分に近い口コミを探す/全ての口コミを見る
          </Link>
        </div>
      )}

      {/* 学校紹介 */}
      {school.intro && (
        <div className="bg-white rounded-2xl shadow-md p-6 md:p-8 mb-8 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">学校紹介</h2>
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{school.intro}</p>
        </div>
      )}
    </>
  );
}
