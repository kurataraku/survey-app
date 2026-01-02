'use client';

import StarRatingDisplay from './StarRatingDisplay';

interface RatingDisplayProps {
  staffRating?: number | null;
  atmosphereFitRating?: number | null;
  creditRating?: number | null;
  tuitionRating?: number | null;
  flexibilityRating?: number | null;
  supportRating?: number | null;
  uniqueCourseRating?: number | null;
  careerSupportRating?: number | null;
  campusLifeRating?: number | null;
  outlierCounts?: {
    overall: number;
    staff: number;
    atmosphere: number;
    credit: number;
    tuition: number;
  };
}

export default function RatingDisplay({
  staffRating,
  atmosphereFitRating,
  creditRating,
  tuitionRating,
  flexibilityRating,
  supportRating,
  uniqueCourseRating,
  careerSupportRating,
  campusLifeRating,
  outlierCounts,
}: RatingDisplayProps) {
  const ratings = [
    { label: '学びの柔軟さ（通学回数・時間割などの調整のしやすさ）', value: flexibilityRating, outlierCount: 0 },
    { label: '先生・職員の対応', value: staffRating, outlierCount: outlierCounts?.staff || 0 },
    { label: '心や体調の波・不安などに対するサポート', value: supportRating, outlierCount: 0 },
    { label: '在校生の雰囲気', value: atmosphereFitRating, outlierCount: outlierCounts?.atmosphere || 0 },
    { label: '単位取得のしやすさ', value: creditRating, outlierCount: outlierCounts?.credit || 0 },
    { label: '学校独自の授業・コースの充実度', value: uniqueCourseRating, outlierCount: 0 },
    { label: '進学・就職など進路サポートの手厚さ', value: careerSupportRating, outlierCount: 0 },
    { label: '授業以外の学校行事やキャンパスライフ', value: campusLifeRating, outlierCount: 0 },
    { label: '学費の納得感', value: tuitionRating, outlierCount: outlierCounts?.tuition || 0 },
  ].filter(rating => rating.value !== null && rating.value !== undefined && rating.value !== 6 && rating.value >= 1 && rating.value <= 5);

  if (ratings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {ratings.map((rating) => (
        <div key={rating.label} className="flex items-center justify-between py-1">
          <div className="flex-1 min-w-0 pr-4">
            <span className="text-sm text-gray-700">{rating.label}</span>
            {rating.outlierCount > 0 && (
              <span className="text-xs text-gray-500 ml-2">
                （評価不可: {rating.outlierCount}件）
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StarRatingDisplay value={rating.value as number} size="sm" />
            <span className="text-sm font-medium text-gray-900 w-10 text-right">
              {rating.value?.toFixed(1)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}







