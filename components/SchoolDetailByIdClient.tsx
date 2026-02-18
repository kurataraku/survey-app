'use client';

import Link from 'next/link';
import StarRatingDisplay from '@/components/StarRatingDisplay';
import RatingDisplay from '@/components/RatingDisplay';
import { getQuestionLabel } from '@/lib/questionLabels';
import { appPath } from '@/lib/base-path';
import type { SchoolById } from '@/lib/schools/getSchoolById';

interface SchoolDetailByIdClientProps {
  school: SchoolById;
  schoolId: string;
}

export default function SchoolDetailByIdClient({
  school,
  schoolId,
}: SchoolDetailByIdClientProps) {
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
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="mb-4">
          <Link
            href={appPath('/schools')}
            className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-block"
          >
            ← 学校一覧に戻る
          </Link>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{school.name}</h1>
        <p className="text-gray-600 mb-4">{school.prefecture}</p>

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
              href={appPath(`/schools/${school.slug}/reviews`)}
              className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              すべての口コミを見る
            </Link>
          ) : (
            <Link
              href={appPath(`/schools/id/${schoolId}/reviews`)}
              className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              すべての口コミを見る
            </Link>
          )}
        </div>
      </div>

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

      {school.statistics && school.review_count > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">口コミ統計</h2>
          <div className="space-y-6">
            {school.statistics.respondent_role && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">投稿者の立場</h3>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-gray-600">本人</span>
                      <span className="text-sm font-medium text-gray-900">
                        {school.statistics.respondent_role.本人}件 (
                        {Math.round(
                          (school.statistics.respondent_role.本人 / school.review_count) * 100
                        )}
                        %)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all"
                        style={{
                          width: `${
                            (school.statistics.respondent_role.本人 / school.review_count) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-gray-600">保護者</span>
                      <span className="text-sm font-medium text-gray-900">
                        {school.statistics.respondent_role.保護者}件 (
                        {Math.round(
                          (school.statistics.respondent_role.保護者 / school.review_count) * 100
                        )}
                        %)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all"
                        style={{
                          width: `${
                            (school.statistics.respondent_role.保護者 / school.review_count) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {school.statistics.status &&
              Object.keys(school.statistics.status).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">現在の状況</h3>
                  <div className="space-y-2">
                    {Object.entries(school.statistics.status).map(([status, count]) => {
                      const countNum = typeof count === 'number' ? count : 0;
                      return (
                        <div key={status}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-gray-600">{status}</span>
                            <span className="text-sm font-medium text-gray-900">
                              {countNum}件 (
                              {Math.round(
                                (countNum / school.review_count) * 100
                              )}
                              %)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full transition-all"
                              style={{
                                width: `${
                                  (countNum / school.review_count) * 100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {school.statistics.reason_for_choosing &&
              Object.keys(school.statistics.reason_for_choosing).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    通信制を選んだ理由
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(school.statistics.reason_for_choosing)
                      .sort(
                        ([, a], [, b]) =>
                          (typeof b === 'number' ? b : 0) -
                          (typeof a === 'number' ? a : 0)
                      )
                      .map(([reason, count]) => (
                        <span
                          key={reason}
                          className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm"
                        >
                          {reason} ({typeof count === 'number' ? count : 0})
                        </span>
                      ))}
                  </div>
                </div>
              )}

            {school.statistics.attendance_frequency &&
              Object.keys(school.statistics.attendance_frequency).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    主な通学頻度
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(school.statistics.attendance_frequency)
                      .sort(
                        ([, a], [, b]) =>
                          (typeof b === 'number' ? b : 0) -
                          (typeof a === 'number' ? a : 0)
                      )
                      .map(([frequency, count]) => {
                        const countNum = typeof count === 'number' ? count : 0;
                        return (
                          <div key={frequency}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm text-gray-600">{frequency}</span>
                              <span className="text-sm font-medium text-gray-900">
                                {countNum}件 (
                                {Math.round(
                                  (countNum / school.review_count) * 100
                                )}
                                %)
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-1.5 rounded-full transition-all"
                                style={{
                                  width: `${
                                    (countNum / school.review_count) * 100
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

            {school.statistics.teaching_style &&
              Object.keys(school.statistics.teaching_style).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    授業のスタイル
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(school.statistics.teaching_style)
                      .sort(
                        ([, a], [, b]) =>
                          (typeof b === 'number' ? b : 0) -
                          (typeof a === 'number' ? a : 0)
                      )
                      .map(([style, count]) => (
                        <span
                          key={style}
                          className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-sm"
                        >
                          {getQuestionLabel('teaching_style', style)} (
                          {typeof count === 'number' ? count : 0})
                        </span>
                      ))}
                  </div>
                </div>
              )}

            {school.statistics.student_atmosphere &&
              Object.keys(school.statistics.student_atmosphere).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    生徒の雰囲気
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(school.statistics.student_atmosphere)
                      .sort(
                        ([, a], [, b]) =>
                          (typeof b === 'number' ? b : 0) -
                          (typeof a === 'number' ? a : 0)
                      )
                      .map(([atmosphere, count]) => (
                        <span
                          key={atmosphere}
                          className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-sm"
                        >
                          {getQuestionLabel('student_atmosphere', atmosphere)} (
                          {typeof count === 'number' ? count : 0})
                        </span>
                      ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {school.intro && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">学校紹介</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{school.intro}</p>
        </div>
      )}

      {school.latest_reviews.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">最新の口コミ</h2>
            {school.slug ? (
              <Link
                href={appPath(`/schools/${school.slug}/reviews`)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                すべて見る →
              </Link>
            ) : (
              <Link
                href={appPath(`/schools/id/${schoolId}/reviews`)}
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
                href={appPath(`/reviews/${review.id}`)}
                className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center gap-2 mb-3">
                  <StarRatingDisplay
                    value={review.overall_satisfaction}
                    size="sm"
                  />
                  <span className="text-sm text-gray-500">
                    {formatDate(review.created_at)}
                  </span>
                </div>
                {review.good_comment && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-green-500 mb-1">
                      良い点
                    </p>
                    <p className="text-gray-700 line-clamp-2">
                      {review.good_comment}
                    </p>
                  </div>
                )}
                {review.bad_comment && (
                  <div>
                    <p className="text-xs font-semibold text-rose-500 mb-1">
                      改善してほしい点
                    </p>
                    <p className="text-gray-700 line-clamp-2">
                      {review.bad_comment}
                    </p>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
