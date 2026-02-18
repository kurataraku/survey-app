import Link from 'next/link';
import SchoolReviewCard from '@/components/SchoolReviewCard';
import EmptyState from '@/components/ui/EmptyState';
import type { ReviewListItem } from '@/lib/reviews/getReviewsBySchoolSlug';

interface SchoolReviewsListServerProps {
  reviews: ReviewListItem[];
  schoolName: string;
  page: number;
  totalPages: number;
  buildPaginationUrl: (newPage: number) => string;
}

/**
 * 学校別口コミ一覧 — Server Component でSSR保証
 * 口コミ本文（良い点・悪い点）を初期HTMLに確実に含める
 */
export default function SchoolReviewsListServer({
  reviews,
  schoolName,
  page,
  totalPages,
  buildPaginationUrl,
}: SchoolReviewsListServerProps) {
  if (reviews.length === 0) {
    return (
      <EmptyState
        title="口コミが見つかりませんでした"
        description="この学校にはまだ口コミが投稿されていません。"
      />
    );
  }

  return (
    <>
      <div className="space-y-4 mb-8">
        {reviews.map((review) => (
          <SchoolReviewCard
            key={review.id}
            id={review.id}
            schoolName={review.school_name ?? schoolName}
            schoolSlug={review.school_slug}
            overallSatisfaction={review.overall_satisfaction ?? 0}
            goodComment={review.good_comment ?? ''}
            badComment={review.bad_comment ?? ''}
            enrollmentYear={review.enrollment_year}
            attendanceFrequency={review.attendance_frequency}
            likeCount={review.like_count}
            createdAt={review.created_at}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Link
            href={buildPaginationUrl(page - 1)}
            className={`px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 ${
              page <= 1 ? 'pointer-events-none opacity-50' : ''
            }`}
            aria-disabled={page <= 1}
          >
            前へ
          </Link>
          <span className="px-4 py-2 text-gray-600">
            {page} / {totalPages}
          </span>
          <Link
            href={buildPaginationUrl(page + 1)}
            className={`px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 ${
              page >= totalPages ? 'pointer-events-none opacity-50' : ''
            }`}
            aria-disabled={page >= totalPages}
          >
            次へ
          </Link>
        </div>
      )}
    </>
  );
}
