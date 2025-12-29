'use client';

import StarRatingDisplay from './StarRatingDisplay';

interface RatingDisplayProps {
  staffRating?: number | null;
  atmosphereFitRating?: number | null;
  creditRating?: number | null;
  tuitionRating?: number | null;
}

export default function RatingDisplay({
  staffRating,
  atmosphereFitRating,
  creditRating,
  tuitionRating,
}: RatingDisplayProps) {
  const ratings = [
    { label: '先生・職員の対応', value: staffRating },
    { label: '在校生の雰囲気', value: atmosphereFitRating },
    { label: '単位取得のしやすさ', value: creditRating },
    { label: '学費の納得感', value: tuitionRating },
  ].filter(rating => rating.value !== null && rating.value !== undefined);

  if (ratings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {ratings.map((rating) => (
        <div key={rating.label} className="flex items-center justify-between">
          <span className="text-sm text-gray-700">{rating.label}</span>
          <div className="flex items-center gap-2">
            <StarRatingDisplay value={rating.value as number} size="sm" />
            <span className="text-sm text-gray-600 w-10 text-right">
              {rating.value?.toFixed(1)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}



