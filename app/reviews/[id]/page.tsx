'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import StarRatingDisplay from '@/components/StarRatingDisplay';
import RatingDisplay from '@/components/RatingDisplay';
import LikeButton from '@/components/LikeButton';
import Chip from '@/components/ui/Chip';
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
  reason_for_choosing: string[] | null | undefined;
  course?: string | null;
  enrollment_type?: string | null;
  enrollment_year?: string | null;
  // Step2: 学習/環境
  attendance_frequency?: string | null;
  campus_prefecture?: string | null;
  teaching_style?: string[] | null | undefined;
  student_atmosphere?: string[] | null | undefined;
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
              className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {review.school_name}の詳細に戻る
            </Link>
          ) : (
            <Link
              href="/schools"
              className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              学校一覧に戻る
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
          <div className="mb-8 pb-8 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">基本情報</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              <Chip variant="primary">{review.respondent_role}</Chip>
              <Chip variant="accent">{review.status}</Chip>
              {review.enrollment_type && (
                <Chip variant="outline">{getQuestionLabel('enrollment_type', review.enrollment_type)}</Chip>
              )}
              {review.enrollment_year && (
                <Chip variant="outline">{getEnrollmentYearLabel(review.enrollment_year)}</Chip>
              )}
              {review.course && (
                <Chip variant="outline">{review.course}</Chip>
              )}
              {review.status === '卒業した' && review.graduation_path && (
                <Chip variant="success">
                  {getGraduationPathLabel(review.graduation_path)}
                  {review.graduation_path_other && `（${review.graduation_path_other}）`}
                </Chip>
              )}
            </div>
            {Array.isArray(review.reason_for_choosing) && review.reason_for_choosing.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">通信制を選んだ理由</p>
                <div className="flex flex-wrap gap-2">
                  {review.reason_for_choosing.map((reason, index) => (
                    <Chip key={index} variant="primary">
                      {getQuestionLabel('reason_for_choosing', reason)}
                    </Chip>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 学習・環境 */}
          {(review.attendance_frequency || review.campus_prefecture || (Array.isArray(review.teaching_style) && review.teaching_style.length > 0) || (Array.isArray(review.student_atmosphere) && review.student_atmosphere.length > 0)) && (
            <div className="mb-8 pb-8 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">学習・環境</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {review.attendance_frequency && (
                  <Chip variant="outline">{getQuestionLabel('attendance_frequency', review.attendance_frequency)}</Chip>
                )}
                {review.campus_prefecture && (
                  <Chip variant="outline">{review.campus_prefecture}</Chip>
                )}
              </div>
              {Array.isArray(review.teaching_style) && review.teaching_style.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">授業のスタイル</p>
                  <div className="flex flex-wrap gap-2">
                    {review.teaching_style.map((style, index) => (
                      <Chip key={index} variant="primary">
                        {getQuestionLabel('teaching_style', style)}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(review.student_atmosphere) && review.student_atmosphere.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">生徒の雰囲気</p>
                  <div className="flex flex-wrap gap-2">
                    {review.student_atmosphere.map((atmosphere, index) => (
                      <Chip key={index} variant="success">
                        {getQuestionLabel('student_atmosphere', atmosphere)}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
              {review.atmosphere_other && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">その他（生徒の雰囲気）</p>
                  <p className="text-gray-700">{review.atmosphere_other}</p>
                </div>
              )}
            </div>
          )}

          {/* 詳細評価 */}
          {(review.flexibility_rating || review.staff_rating || review.support_rating || review.atmosphere_fit_rating || review.credit_rating || review.unique_course_rating || review.career_support_rating || review.campus_life_rating || review.tuition_rating) && (
            <div className="mb-8 pb-8 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">詳細評価</h2>
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
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">良かった点</h2>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{review.good_comment}</p>
          </div>

          {/* 改善してほしい点 */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">改善してほしい点</h2>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{review.bad_comment}</p>
          </div>
        </div>
      </div>
    </div>
  );
}


