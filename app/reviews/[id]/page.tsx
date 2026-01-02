'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import StarRatingDisplay from '@/components/StarRatingDisplay';
import RatingDisplay from '@/components/RatingDisplay';
import LikeButton from '@/components/LikeButton';
import { getQuestionLabel, getQuestionLabels, getAttendanceFrequencyLabel, getEnrollmentYearLabel, getGraduationPathLabel } from '@/lib/questionLabels';

interface Review {
  id: string;
  school_id: string;
  school_name: string;
  school_slug: string | null;
  respondent_role: string;
  status: string;
  graduation_path?: string | null;
  graduation_path_other?: string | null;
  overall_satisfaction: number;
  good_comment: string;
  bad_comment: string;
  // Step1: 基本情報
  reason_for_choosing: string[];
  course?: string | null;
  enrollment_type?: string | null;
  enrollment_year?: string | null;
  // Step2: 学習/環境
  attendance_frequency?: string | null;
  campus_prefecture?: string | null;
  teaching_style?: string[];
  student_atmosphere?: string[];
  atmosphere_other?: string | null;
  // Step3: 評価
  flexibility_rating?: number | null;
  staff_rating?: number | null;
  support_rating?: number | null;
  atmosphere_fit_rating?: number | null;
  credit_rating?: number | null;
  unique_course_rating?: number | null;
  career_support_rating?: number | null;
  campus_life_rating?: number | null;
  tuition_rating?: number | null;
  like_count: number;
  is_liked: boolean;
  created_at: string;
  outlier_counts?: {
    overall: number;
    staff: number;
    atmosphere: number;
    credit: number;
    tuition: number;
  };
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">基本情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 font-medium">投稿者:</span>
                <span className="ml-2 text-gray-900">{review.respondent_role}</span>
              </div>
              <div>
                <span className="text-gray-600 font-medium">現在の状況:</span>
                <span className="ml-2 text-gray-900">{review.status}</span>
              </div>
              {review.status === '卒業した' && review.graduation_path && (
                <div className="md:col-span-2">
                  <span className="text-gray-600 font-medium">卒業後の進路:</span>
                  <span className="ml-2 text-gray-900">
                    {getGraduationPathLabel(review.graduation_path)}
                    {review.graduation_path_other && `（${review.graduation_path_other}）`}
                  </span>
                </div>
              )}
              {review.enrollment_type && (
                <div>
                  <span className="text-gray-600 font-medium">入学タイミング:</span>
                  <span className="ml-2 text-gray-900">{getQuestionLabel('enrollment_type', review.enrollment_type)}</span>
                </div>
              )}
              {review.enrollment_year && (
                <div>
                  <span className="text-gray-600 font-medium">入学年:</span>
                  <span className="ml-2 text-gray-900">{getEnrollmentYearLabel(review.enrollment_year)}</span>
                </div>
              )}
              {review.course && (
                <div>
                  <span className="text-gray-600 font-medium">在籍コース:</span>
                  <span className="ml-2 text-gray-900">{review.course}</span>
                </div>
              )}
            </div>
            {review.reason_for_choosing.length > 0 && (
              <div className="mt-4">
                <span className="text-gray-600 text-sm font-medium">通信制を選んだ理由:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {review.reason_for_choosing.map((reason, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm"
                    >
                      {getQuestionLabel('reason_for_choosing', reason)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 学習・環境 */}
          {(review.attendance_frequency || review.campus_prefecture || review.teaching_style?.length > 0 || review.student_atmosphere?.length > 0) && (
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">学習・環境</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {review.attendance_frequency && (
                  <div>
                    <span className="text-gray-600 font-medium">主な通学頻度:</span>
                    <span className="ml-2 text-gray-900">{getQuestionLabel('attendance_frequency', review.attendance_frequency)}</span>
                  </div>
                )}
                {review.campus_prefecture && (
                  <div>
                    <span className="text-gray-600 font-medium">主に通っていたキャンパス都道府県:</span>
                    <span className="ml-2 text-gray-900">{review.campus_prefecture}</span>
                  </div>
                )}
              </div>
              {review.teaching_style && review.teaching_style.length > 0 && (
                <div className="mt-4">
                  <span className="text-gray-600 text-sm font-medium">授業のスタイル:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {review.teaching_style.map((style, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                      >
                        {getQuestionLabel('teaching_style', style)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {review.student_atmosphere && review.student_atmosphere.length > 0 && (
                <div className="mt-4">
                  <span className="text-gray-600 text-sm font-medium">生徒の雰囲気:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {review.student_atmosphere.map((atmosphere, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm"
                      >
                        {getQuestionLabel('student_atmosphere', atmosphere)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {review.atmosphere_other && (
                <div className="mt-4">
                  <span className="text-gray-600 text-sm font-medium">その他（生徒の雰囲気）:</span>
                  <p className="mt-1 text-gray-900">{review.atmosphere_other}</p>
                </div>
              )}
            </div>
          )}

          {/* 詳細評価 */}
          {(review.flexibility_rating || review.staff_rating || review.support_rating || review.atmosphere_fit_rating || review.credit_rating || review.unique_course_rating || review.career_support_rating || review.campus_life_rating || review.tuition_rating) && (
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">詳細評価</h2>
              <RatingDisplay
                flexibilityRating={review.flexibility_rating}
                staffRating={review.staff_rating}
                supportRating={review.support_rating}
                atmosphereFitRating={review.atmosphere_fit_rating}
                creditRating={review.credit_rating}
                uniqueCourseRating={review.unique_course_rating}
                careerSupportRating={review.career_support_rating}
                campusLifeRating={review.campus_life_rating}
                tuitionRating={review.tuition_rating}
                outlierCounts={review.outlier_counts}
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


