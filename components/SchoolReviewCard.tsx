import Link from 'next/link';
import { appPath } from '@/lib/base-path';

interface SchoolReviewCardProps {
  id: string;
  schoolName: string;
  schoolSlug: string | null;
  overallSatisfaction: number;
  goodComment: string;
  badComment?: string;
  enrollmentYear: number | null;
  attendanceFrequency: string | null;
  likeCount: number;
  createdAt: string;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** 星評価を静的に描画（Server Component用、SEO対応） */
function StarRating({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const rounded = Math.round(value);
  return (
    <div className="flex gap-1" aria-label={`${value}つ星`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`${sizeClasses} ${i <= rounded ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 fill-gray-300'}`}
          viewBox="0 0 24 24"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

/**
 * 学校別口コミ一覧用のカード（Server Component）
 * 口コミ本文を初期HTMLに含め、Google等のクローラーがインデックスできるようにする
 */
export default function SchoolReviewCard({
  id,
  schoolName,
  schoolSlug,
  overallSatisfaction,
  goodComment,
  badComment,
  enrollmentYear,
  attendanceFrequency,
  likeCount,
  createdAt,
}: SchoolReviewCardProps) {
  return (
    <article className="p-5 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-gray-300 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {schoolSlug ? (
              <span className="text-sm font-medium text-blue-600">{schoolName}</span>
            ) : (
              <span className="text-sm text-gray-600">{schoolName}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-600">総合満足度</span>
            <StarRating value={overallSatisfaction} size="sm" />
            <span className="text-sm text-gray-500">{formatDate(createdAt)}</span>
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

      <div className="space-y-2.5 mb-4">
        {goodComment && (
          <div>
            <p className="text-xs font-semibold text-green-500 mb-1">良い点</p>
            <p className="text-gray-700 line-clamp-2 text-sm">{goodComment}</p>
          </div>
        )}
        {badComment && (
          <div>
            <p className="text-xs font-semibold text-rose-500 mb-1">改善してほしい点</p>
            <p className="text-gray-700 line-clamp-2 text-sm">{badComment}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100 flex-wrap gap-2">
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
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
        <Link
          href={appPath(`/reviews/${id}`)}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          この口コミの詳細・回答属性を見る
        </Link>
      </div>
    </article>
  );
}
