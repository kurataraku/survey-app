'use client';

import Link from 'next/link';
import StarRatingDisplay from './StarRatingDisplay';

interface RankingCardProps {
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

export default function RankingCard({
  rank,
  id,
  name,
  prefecture,
  slug,
  reviewCount,
  value,
  valueLabel,
  valueType,
}: RankingCardProps) {
  const href = slug && slug.trim() !== '' ? `/schools/${encodeURIComponent(slug)}` : `/schools/id/${id}`;

  const formatValue = () => {
    if (value === null) return 'データなし';
    if (valueType === 'percentage') {
      return `${value.toFixed(1)}%`;
    }
    if (valueType === 'count') {
      return `${value}件`;
    }
    return value.toFixed(1);
  };

  const getRankColor = () => {
    if (rank === 1) return 'bg-yellow-500 text-white';
    if (rank === 2) return 'bg-gray-400 text-white';
    if (rank === 3) return 'bg-orange-600 text-white';
    return 'bg-gray-200 text-gray-700';
  };

  return (
    <Link
      href={href}
      className="block bg-white border border-gray-200 rounded-lg p-6 hover:border-orange-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-4">
        {/* ランク表示 */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${getRankColor()}`}>
          {rank}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
            {name}
          </h3>
          <p className="text-sm text-gray-600 mb-3">{prefecture}</p>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {valueType === 'rating' && value !== null && (
                  <StarRatingDisplay value={value} size="sm" showLabel />
                )}
                <span className={`text-lg font-semibold ${
                  valueType === 'rating' ? 'text-gray-900' : 'text-orange-600'
                }`}>
                  {formatValue()}
                </span>
                {valueType === 'rating' && (
                  <span className="text-sm text-gray-600">({valueLabel})</span>
                )}
                {valueType !== 'rating' && (
                  <span className="text-sm text-gray-600 ml-2">{valueLabel}</span>
                )}
              </div>
              <p className="text-sm text-gray-500">
                {reviewCount}件の口コミ
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}



