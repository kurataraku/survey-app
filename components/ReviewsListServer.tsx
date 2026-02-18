import Link from 'next/link';
import ReviewCardServer from '@/components/ReviewCardServer';
import type { ReviewListItem } from '@/lib/reviews/getReviewsList';
import { appPath } from '@/lib/base-path';

interface ReviewsListServerProps {
  reviews: ReviewListItem[];
  page: number;
  totalPages: number;
}

/**
 * サイト全体の口コミ一覧 — Server Component でSSR保証
 * 口コミ本文（良い点・悪い点）を初期HTMLに確実に含め、クローラーがインデックスできるようにする
 */
export default function ReviewsListServer({
  reviews,
  page,
  totalPages,
}: ReviewsListServerProps) {
  if (reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">口コミが見つかりませんでした</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {reviews.map((review) => (
          <ReviewCardServer
            key={review.id}
            id={review.id}
            schoolName={review.school_name}
            schoolSlug={review.school_slug}
            overallSatisfaction={review.overall_satisfaction}
            goodComment={review.good_comment}
            badComment={review.bad_comment}
            enrollmentYear={review.enrollment_year}
            attendanceFrequency={review.attendance_frequency}
            likeCount={review.like_count}
            createdAt={review.created_at}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 ? (
            <Link
              href={page === 2 ? appPath('/reviews') : appPath(`/reviews?page=${page - 1}`)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              前へ
            </Link>
          ) : (
            <span className="px-4 py-2 border border-gray-300 rounded-lg opacity-50 cursor-not-allowed">
              前へ
            </span>
          )}
          <span className="px-4 py-2 text-gray-600">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={appPath(`/reviews?page=${page + 1}`)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              次へ
            </Link>
          ) : (
            <span className="px-4 py-2 border border-gray-300 rounded-lg opacity-50 cursor-not-allowed">
              次へ
            </span>
          )}
        </div>
      )}
    </>
  );
}
