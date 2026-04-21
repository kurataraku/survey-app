import Link from 'next/link';
import { appPath } from '@/lib/base-path';

interface RankingCardServerProps {
  rank: number;
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
  reviewCount: number;
  value: number | null;
  valueLabel: string;
  valueType: 'rating' | 'count' | 'percentage';
}

/** 星評価を静的に描画（Server Component用、SEO対応） */
function StarRating({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <div className="flex gap-1 items-center" aria-label={`${value}つ星`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-4 h-4 ${i <= rounded ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 fill-gray-300'}`}
          viewBox="0 0 24 24"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
      <span className="ml-2 text-sm text-gray-600">{value.toFixed(1)}</span>
    </div>
  );
}

/**
 * ランキングカード（Server Component）
 * 初期HTMLに学校名・評価を含め、SEO対応
 */
export default function RankingCardServer({
  rank,
  id,
  name,
  prefecture,
  slug,
  reviewCount,
  value,
  valueLabel,
  valueType,
}: RankingCardServerProps) {
  const href = slug && slug.trim() !== '' ? appPath(`/schools/${encodeURIComponent(slug)}`) : appPath(`/schools/id/${id}`);

  const formatValue = () => {
    if (value === null) return 'データなし';
    if (valueType === 'percentage') return `${value.toFixed(1)}%`;
    if (valueType === 'count') return `${value}件`;
    return value.toFixed(1);
  };

  const getRankColor = () => {
    if (rank === 1) return 'bg-yellow-500 text-white';
    if (rank === 2) return 'bg-gray-400 text-white';
    if (rank === 3) return 'bg-rose-500 text-white';
    return 'bg-gray-200 text-gray-700';
  };

  return (
    <Link
      href={href}
      className="block bg-white border border-gray-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${getRankColor()}`}>
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">{name}</h3>
          {prefecture?.trim() && prefecture !== '不明' ? (
            <p className="text-sm text-gray-600 mb-3">本校所在地：{prefecture}</p>
          ) : null}

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {valueType === 'rating' && value !== null && (
                  <>
                    <StarRating value={value} />
                    <span className="text-sm text-gray-600">({valueLabel})</span>
                  </>
                )}
                {valueType === 'rating' && value === null && (
                  <span className="text-lg font-semibold text-gray-900">データなし</span>
                )}
                {valueType !== 'rating' && (
                  <>
                    <span className="text-lg font-semibold text-blue-600">{formatValue()}</span>
                    <span className="text-sm text-gray-600 ml-2">{valueLabel}</span>
                  </>
                )}
              </div>
              <p className="text-sm text-gray-500">{reviewCount}件の口コミ</p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
