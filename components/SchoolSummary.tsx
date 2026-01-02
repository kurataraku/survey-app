'use client';

import React from 'react';
import Link from 'next/link';
import StarRatingDisplay from './StarRatingDisplay';
import Badge from './ui/Badge';

interface SchoolSummaryProps {
  name: string;
  prefecture: string;
  slug: string;
  overallAvg: number | null;
  reviewCount: number;
  staffRatingAvg: number | null;
  atmosphereFitRatingAvg: number | null;
  creditRatingAvg: number | null;
  latestReviews: Array<{
    good_comment: string;
    bad_comment: string;
  }>;
}

export default function SchoolSummary({
  name,
  prefecture,
  slug,
  overallAvg,
  reviewCount,
  staffRatingAvg,
  atmosphereFitRatingAvg,
  creditRatingAvg,
  latestReviews,
}: SchoolSummaryProps) {
  // 最新3件から代表的な良い点/悪い点を抽出
  const representativeGood = latestReviews
    .filter((r) => r.good_comment)
    .slice(0, 1)
    .map((r) => r.good_comment.substring(0, 60) + (r.good_comment.length > 60 ? '...' : ''))[0];
  
  const representativeBad = latestReviews
    .filter((r) => r.bad_comment)
    .slice(0, 1)
    .map((r) => r.bad_comment.substring(0, 60) + (r.bad_comment.length > 60 ? '...' : ''))[0];

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
      {/* 学校名と都道府県 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{name}</h1>
          <Badge variant="primary" size="md">{prefecture}</Badge>
        </div>
      </div>

      {/* 総合平均スコア */}
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
        {overallAvg !== null ? (
          <>
            <div className="flex items-center gap-2">
              <StarRatingDisplay value={overallAvg} size="lg" showLabel />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {overallAvg.toFixed(1)}
              <span className="text-lg font-normal text-gray-600 ml-1">/ 5.0</span>
            </div>
            <div className="text-sm text-gray-600 ml-auto">
              <span className="font-semibold">{reviewCount}</span>件の口コミ
            </div>
          </>
        ) : (
          <div className="text-gray-400">評価なし</div>
        )}
      </div>

      {/* 主要3指標を横並びのスコアチップで表示 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-gray-600 mb-1">先生・職員の対応</p>
          {staffRatingAvg !== null ? (
            <div className="flex items-center justify-center gap-1">
              <StarRatingDisplay value={staffRatingAvg} size="sm" />
              <span className="text-sm font-semibold text-gray-900">{staffRatingAvg.toFixed(1)}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">評価なし</span>
          )}
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <p className="text-xs text-gray-600 mb-1">在校生の雰囲気</p>
          {atmosphereFitRatingAvg !== null ? (
            <div className="flex items-center justify-center gap-1">
              <StarRatingDisplay value={atmosphereFitRatingAvg} size="sm" />
              <span className="text-sm font-semibold text-gray-900">{atmosphereFitRatingAvg.toFixed(1)}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">評価なし</span>
          )}
        </div>
        <div className="text-center p-3 bg-amber-50 rounded-lg">
          <p className="text-xs text-gray-600 mb-1">単位取得のしやすさ</p>
          {creditRatingAvg !== null ? (
            <div className="flex items-center justify-center gap-1">
              <StarRatingDisplay value={creditRatingAvg} size="sm" />
              <span className="text-sm font-semibold text-gray-900">{creditRatingAvg.toFixed(1)}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">評価なし</span>
          )}
        </div>
      </div>

      {/* 代表的な良い点/悪い点 */}
      {(representativeGood || representativeBad) && (
        <div className="space-y-3 pt-6 border-t border-gray-200">
          {representativeGood && (
            <div>
              <p className="text-xs font-semibold text-green-600 mb-1">良い点</p>
              <p className="text-sm text-gray-700">{representativeGood}</p>
            </div>
          )}
          {representativeBad && (
            <div>
              <p className="text-xs font-semibold text-rose-600 mb-1">改善してほしい点</p>
              <p className="text-sm text-gray-700">{representativeBad}</p>
            </div>
          )}
        </div>
      )}

      {/* 口コミを見るボタン */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <Link
          href={`/schools/${slug}/reviews`}
          className="inline-block w-full text-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          すべての口コミを見る
        </Link>
      </div>
    </div>
  );
}

