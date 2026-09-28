import Link from 'next/link';
import { appPath } from '@/lib/base-path';
import type { RegionalReviewExcerpt } from '@/lib/schools/regionalReviewExcerpts';

interface RegionalReviewExcerptListProps {
  reviews: RegionalReviewExcerpt[];
  /** キャンパスのラベル。都市LPでは市のキャンパスかどうかで出し分ける */
  prefecture: string;
  municipality?: string;
}

function StarRating({ value }: { value: number }) {
  return (
    <span className="text-amber-500" aria-label={`総合満足度 ${value} / 5`}>
      {'★'.repeat(value)}
      <span className="text-gray-300">{'★'.repeat(5 - value)}</span>
    </span>
  );
}

export default function RegionalReviewExcerptList({ reviews, prefecture, municipality }: RegionalReviewExcerptListProps) {
  if (reviews.length === 0) return null;
  return (
    <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {reviews.map((review) => (
        <li key={review.id} className="flex flex-col rounded-lg border border-gray-100 bg-gray-50/70 p-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mb-2">
            {review.schoolSlug ? (
              <Link
                href={appPath(`/schools/${review.schoolSlug}`)}
                className="font-medium text-blue-700 hover:text-blue-900 hover:underline"
              >
                {review.schoolName}
              </Link>
            ) : (
              <span className="font-medium text-gray-900">{review.schoolName}</span>
            )}
            <span className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] text-gray-600">
              {municipality && review.isCityCampus ? `${municipality}のキャンパス` : `${prefecture}内のキャンパス`}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500 mb-2">
            {review.overall != null && <StarRating value={review.overall} />}
            {review.attendance && <span>通学: {review.attendance}</span>}
          </div>
          {review.good && (
            <p className="text-sm text-gray-700 leading-relaxed">
              <span className="mr-1 font-semibold text-emerald-700">良かった点</span>
              {review.good}
            </p>
          )}
          {review.bad && (
            <p className="mt-1.5 text-sm text-gray-700 leading-relaxed">
              <span className="mr-1 font-semibold text-rose-700">気になった点</span>
              {review.bad}
            </p>
          )}
          <Link
            href={appPath(`/reviews/${review.id}`)}
            className="mt-auto pt-3 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
          >
            この口コミを全文で読む
          </Link>
        </li>
      ))}
    </ul>
  );
}
