'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StarRatingDisplay from './StarRatingDisplay';

interface ReviewCardProps {
  id: string;
  schoolName: string;
  schoolSlug: string | null;
  overallSatisfaction: number;
  goodComment: string;
  enrollmentYear: number | null;
  attendanceFrequency: string | null;
  likeCount: number;
  createdAt: string;
}

export default function ReviewCard({
  id,
  schoolName,
  schoolSlug,
  overallSatisfaction,
  goodComment,
  enrollmentYear,
  attendanceFrequency,
  likeCount,
  createdAt,
}: ReviewCardProps) {
  const router = useRouter();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // コメントを100文字で切り詰め
  const truncatedComment = goodComment.length > 100
    ? goodComment.substring(0, 100) + '...'
    : goodComment;

  const handleCardClick = () => {
    router.push(`/reviews/${id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className="block p-6 bg-white border border-gray-200 rounded-lg hover:border-orange-300 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          {schoolSlug ? (
            <Link
              href={`/schools/${schoolSlug}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium text-orange-600 hover:text-orange-700 mb-2 inline-block"
            >
              {schoolName}
            </Link>
          ) : (
            <p className="text-sm text-gray-600 mb-2">{schoolName}</p>
          )}
          <div className="flex items-center gap-2 mb-2">
            <StarRatingDisplay value={overallSatisfaction} size="sm" />
            <span className="text-sm text-gray-500">
              {formatDate(createdAt)}
            </span>
          </div>
          {(enrollmentYear || attendanceFrequency) && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              {enrollmentYear && <span>{enrollmentYear}年入学</span>}
              {enrollmentYear && attendanceFrequency && <span>•</span>}
              {attendanceFrequency && <span>{attendanceFrequency}</span>}
            </div>
          )}
        </div>
      </div>

      <p className="text-gray-700 mb-4 line-clamp-3">{truncatedComment}</p>

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
          <span>{likeCount}</span>
        </div>
        <span className="text-sm text-orange-600 hover:text-orange-700">
          続きを読む →
        </span>
      </div>
    </div>
  );
}






