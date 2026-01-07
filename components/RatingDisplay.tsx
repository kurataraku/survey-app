'use client';

import { useState } from 'react';
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
  globalAverages?: {
    flexibility_rating_avg: number | null;
    staff_rating_avg: number | null;
    support_rating_avg: number | null;
    atmosphere_fit_rating_avg: number | null;
    credit_rating_avg: number | null;
    unique_course_rating_avg: number | null;
    career_support_rating_avg: number | null;
    campus_life_rating_avg: number | null;
    tuition_rating_avg: number | null;
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
  globalAverages,
}: RatingDisplayProps) {
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const baseRatings = [
    { 
      label: '学びの柔軟さ（通学回数・時間割などの調整のしやすさ）', 
      value: flexibilityRating, 
      outlierCount: 0,
      globalAvg: globalAverages?.flexibility_rating_avg ?? null,
    },
    { 
      label: '先生・職員の対応', 
      value: staffRating, 
      outlierCount: outlierCounts?.staff || 0,
      globalAvg: globalAverages?.staff_rating_avg ?? null,
    },
    { 
      label: '心や体調の波・不安などに対するサポート', 
      value: supportRating, 
      outlierCount: 0,
      globalAvg: globalAverages?.support_rating_avg ?? null,
    },
    { 
      label: '在校生の雰囲気', 
      value: atmosphereFitRating, 
      outlierCount: outlierCounts?.atmosphere || 0,
      globalAvg: globalAverages?.atmosphere_fit_rating_avg ?? null,
    },
    { 
      label: '単位取得のしやすさ', 
      value: creditRating, 
      outlierCount: outlierCounts?.credit || 0,
      globalAvg: globalAverages?.credit_rating_avg ?? null,
    },
    { 
      label: '学校独自の授業・コースの充実度', 
      value: uniqueCourseRating, 
      outlierCount: 0,
      globalAvg: globalAverages?.unique_course_rating_avg ?? null,
    },
    { 
      label: '進学・就職など進路サポートの手厚さ', 
      value: careerSupportRating, 
      outlierCount: 0,
      globalAvg: globalAverages?.career_support_rating_avg ?? null,
    },
    { 
      label: '授業以外の学校行事やキャンパスライフ', 
      value: campusLifeRating, 
      outlierCount: 0,
      globalAvg: globalAverages?.campus_life_rating_avg ?? null,
    },
    { 
      label: '学費の納得感', 
      value: tuitionRating, 
      outlierCount: outlierCounts?.tuition || 0,
      globalAvg: globalAverages?.tuition_rating_avg ?? null,
    },
  ].filter(
    (rating) =>
      rating.value !== null &&
      rating.value !== undefined &&
      rating.value !== 6 &&
      rating.value >= 1 &&
      rating.value <= 5
  );

  if (baseRatings.length === 0) {
    return null;
  }

  const importantOrder = ['先生・職員の対応', '在校生の雰囲気', '単位取得のしやすさ'];

  const sortFn = (
    a: { label: string; value: number | null | undefined; outlierCount: number },
    b: { label: string; value: number | null | undefined; outlierCount: number }
  ) =>
    sortOrder === 'desc'
      ? (b.value as number) - (a.value as number)
      : (a.value as number) - (b.value as number);

  const importantRatings = baseRatings
    .filter((r) => importantOrder.includes(r.label))
    .sort(sortFn);

  const otherRatings = baseRatings
    .filter((r) => !importantOrder.includes(r.label))
    .sort(sortFn);

  const ratings = [...importantRatings, ...otherRatings];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs text-gray-500">
          まずは「指標別スコア」でこの学校の強みと弱みを確認してみましょう。
        </p>
        <div className="inline-flex items-center rounded-full bg-gray-100 p-1 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSortOrder('desc')}
            className={`px-3 py-1 rounded-full ${
              sortOrder === 'desc' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            高い順
          </button>
          <button
            type="button"
            onClick={() => setSortOrder('asc')}
            className={`px-3 py-1 rounded-full ${
              sortOrder === 'asc' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            低い順
          </button>
        </div>
      </div>

      {/* 凡例 */}
      {globalAverages && (
        <div className="text-xs text-gray-600 bg-gray-50 rounded px-3 py-2 border border-gray-200">
          <span className="inline-flex items-center gap-1.5 mr-4">
            <span className="inline-block w-8 h-2 rounded-full bg-blue-500"></span>
            棒＝この学校の平均
          </span>
          <span className="inline-flex items-center gap-1.5 mr-4">
            <span className="inline-block w-0.5 h-3 bg-gray-600"></span>
            ｜＝全体平均
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-gray-700 font-medium">(±)</span>
            ＝平均との差
          </span>
        </div>
      )}

      <div className="space-y-3">
        {ratings.map((rating) => {
          const value = rating.value as number;
          const percentage = (value / 5) * 100;
          const globalAvg = rating.globalAvg;
          const hasGlobalAvg = globalAvg !== null && globalAvg !== undefined;
          const avgPercentage = hasGlobalAvg ? (globalAvg / 5) * 100 : 0;
          const diff = hasGlobalAvg ? value - globalAvg : null;
          const diffText = diff !== null 
            ? diff > 0 
              ? `(+${diff.toFixed(1)})` 
              : diff < 0 
                ? `(${diff.toFixed(1)})` 
                : `(±0.0)`
            : null;

          return (
            <div
              key={rating.label}
              className="py-1.5 border-b border-gray-100 last:border-b-0"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-800">{rating.label}</span>
                  {rating.outlierCount > 0 && (
                    <span className="text-xs text-gray-500 ml-2">
                      （評価不可: {rating.outlierCount}件）
                    </span>
                  )}
                </div>
                <div className="w-full sm:w-72 flex items-center gap-3">
                  <div className="flex-1 relative py-0.5">
                    {/* 平均位置のマーカー（バーの上に表示） */}
                    {hasGlobalAvg && (
                      <div
                        className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-gray-600 z-10 pointer-events-none"
                        style={{ left: `${avgPercentage}%` }}
                        title={`全体平均: ${globalAvg.toFixed(1)}`}
                      />
                    )}
                    {/* この学校のスコアバー */}
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-sm font-semibold text-gray-900 w-10 text-right tabular-nums">
                      {value.toFixed(1)}
                    </span>
                    {diffText && (
                      <span className={`text-xs font-medium tabular-nums ${
                        diff !== null && diff > 0 
                          ? 'text-green-600' 
                          : diff !== null && diff < 0 
                            ? 'text-red-600' 
                            : 'text-gray-500'
                      }`}>
                        {diffText}
                      </span>
                    )}
                    <StarRatingDisplay value={value} size="sm" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}







