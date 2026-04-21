import { notFound } from 'next/navigation';
import Link from 'next/link';
import StarRatingDisplay from '@/components/StarRatingDisplay';
import RatingDisplay from '@/components/RatingDisplay';
import LikeButton from '@/components/LikeButton';
import Chip from '@/components/ui/Chip';
import StructuredData from '@/components/StructuredData';
import { getQuestionLabel, getEnrollmentYearLabel, getGraduationPathLabel } from '@/lib/questionLabels';
import { getReviewById, type ReviewData } from '@/lib/reviews/getReviewById';
import { getReviewIds } from '@/lib/reviews/getReviewIds';
import { appPath } from '@/lib/base-path';
import { getAppBaseUrl } from '@/lib/env-check';

export const revalidate = 3600;

/** ビルド時に口コミ詳細を静的生成し、初期HTMLに本文を含める */
export async function generateStaticParams() {
  const ids = await getReviewIds();
  return ids;
}

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildReviewJsonLd(review: ReviewData) {
  const reviewBody = [review.good_comment, review.bad_comment]
    .filter(Boolean)
    .join(' ')
    .slice(0, 500);
  const base = getAppBaseUrl();
  const schoolHubUrl = review.school_slug
    ? `${base}/schools/${encodeURIComponent(review.school_slug)}`
    : undefined;
  const itemReviewed: Record<string, unknown> = {
    '@type': 'EducationalOrganization',
    name: review.school_name,
  };
  if (schoolHubUrl) {
    itemReviewed.url = schoolHubUrl;
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed,
    author: { '@type': 'Person', name: '匿名' },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.overall_satisfaction,
      bestRating: 5,
      worstRating: 1,
    },
    reviewBody: reviewBody || `${review.school_name}の口コミ`,
    datePublished: review.created_at,
  };
}

export default async function ReviewDetailPage({ params }: PageProps) {
  const resolved = params instanceof Promise ? await params : params;
  const review = await getReviewById(resolved.id);

  if (!review) {
    notFound();
  }

  const jsonLd = buildReviewJsonLd(review);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <StructuredData data={jsonLd} />
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          {review.school_slug ? (
            <Link
              href={appPath(`/schools/${review.school_slug}`)}
              className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              {review.school_name}の口コミ・評判（まとめ）へ戻る
            </Link>
          ) : (
            <Link
              href={appPath('/schools')}
              className="text-sm text-blue-600 hover:text-blue-700 mb-4 inline-flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              学校一覧に戻る
            </Link>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {review.school_name}の口コミ（投稿）
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
              {review.course && <Chip variant="outline">{review.course}</Chip>}
              {review.status === '卒業した' && review.graduation_path && (
                <Chip variant="success">
                  {getGraduationPathLabel(review.graduation_path)}
                  {review.graduation_path_other && `（${review.graduation_path_other}）`}
                </Chip>
              )}
            </div>
            {review.reason_for_choosing.length > 0 && (
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

          {(review.attendance_frequency ||
            review.campus_prefecture ||
            review.teaching_style.length > 0 ||
            review.student_atmosphere.length > 0) && (
            <div className="mb-8 pb-8 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 mb-4">学習・環境</h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {review.attendance_frequency && (
                  <Chip variant="outline">
                    {getQuestionLabel('attendance_frequency', review.attendance_frequency)}
                  </Chip>
                )}
                {review.campus_prefecture && (
                  <Chip variant="outline">{review.campus_prefecture}</Chip>
                )}
              </div>
              {review.teaching_style.length > 0 && (
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
              {review.student_atmosphere.length > 0 && (
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

          {(review.flexibility_rating ||
            review.staff_rating ||
            review.support_rating ||
            review.atmosphere_fit_rating ||
            review.credit_rating ||
            review.unique_course_rating ||
            review.career_support_rating ||
            review.campus_life_rating ||
            review.tuition_rating) && (
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

          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">良かった点</h2>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{review.good_comment}</p>
          </div>

          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">改善してほしい点</h2>
            <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{review.bad_comment}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
