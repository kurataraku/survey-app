import Link from 'next/link';
import { User } from 'lucide-react';
import StarRatingDisplay from '@/components/StarRatingDisplay';
import { appPath } from '@/lib/base-path';

interface Review {
  id: string;
  overall_satisfaction: number;
  good_comment: string;
  bad_comment: string;
  created_at: string;
  like_count?: number;
}

interface SchoolFeaturedReviewsServerProps {
  latestReviews: Review[];
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** 注目の口コミ（いいね数順・最大5件）— Server Component でSSR保証 */
export default function SchoolFeaturedReviewsServer({
  latestReviews,
}: SchoolFeaturedReviewsServerProps) {
  const featuredReviews = [...latestReviews]
    .sort((a, b) => (b.like_count ?? 0) - (a.like_count ?? 0))
    .slice(0, 5);

  if (featuredReviews.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 md:p-8 mb-8 border border-gray-200">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">実際の口コミ（良い点・気になる点）</h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          投稿された口コミから、良い点と改善してほしい点が分かるコメントを抜粋しています。要約や評価だけでなく、生の声もあわせて確認してください。
        </p>
      </div>
      <div className="space-y-4">
        {featuredReviews.map((review) => (
          <article
            key={review.id}
            className="p-6 border border-gray-200 rounded-xl shadow-sm bg-white"
          >
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-full">
                  <User className="w-4 h-4 text-blue-600" aria-hidden />
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
                    aria-hidden
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
                <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">
                  {review.good_comment}
                </p>
              </div>
            )}
            {review.bad_comment && (
              <div className="mb-4 p-3 bg-rose-50/50 rounded-lg border-l-4 border-rose-500">
                <p className="text-xs font-semibold text-rose-700 mb-2">改善してほしい点</p>
                <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">
                  {review.bad_comment}
                </p>
              </div>
            )}
            <div className="pt-2 border-t border-gray-100">
              <Link
                href={appPath(`/reviews/${review.id}`)}
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                この口コミの詳細・回答属性を見る
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
