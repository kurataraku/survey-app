'use client';

import Link from 'next/link';
import StarRatingDisplay from './StarRatingDisplay';

interface SchoolCardProps {
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
  reviewCount: number;
  overallAvg: number | null;
}

export default function SchoolCard({
  id,
  name,
  prefecture,
  slug,
  reviewCount,
  overallAvg,
}: SchoolCardProps) {
  // slugがnullまたは空文字列の場合はidを使用（フォールバック）
  const href = slug && slug.trim() !== '' ? `/schools/${encodeURIComponent(slug)}` : `/schools/id/${id}`;
  
  const handleClick = (e: React.MouseEvent) => {
    console.log('[SchoolCard] clicked:', { 
      id, 
      name, 
      slug, 
      slug_type: typeof slug,
      slug_length: slug?.length,
      href 
    });
  };
  
  return (
    <Link
      href={href}
      onClick={handleClick}
      className="block p-6 bg-white border border-gray-200 rounded-lg hover:border-orange-300 hover:shadow-md transition-all"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {name}
          </h3>
          <p className="text-sm text-gray-600">{prefecture}</p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-3">
          {overallAvg !== null ? (
            <>
              <StarRatingDisplay value={overallAvg} size="sm" showLabel />
              <span className="text-sm text-gray-600">
                {overallAvg.toFixed(1)}
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-400">評価なし</span>
          )}
        </div>
        <span className="text-sm text-gray-600">
          {reviewCount}件の口コミ
        </span>
      </div>
    </Link>
  );
}

