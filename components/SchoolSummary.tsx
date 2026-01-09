'use client';

import React from 'react';
import Link from 'next/link';
import StarRatingDisplay from './StarRatingDisplay';
import Badge from './ui/Badge';

interface SchoolSummaryProps {
  name: string;
  prefecture: string;
  prefectures?: string[]; // 複数の都道府県に対応
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
  prefectures,
  slug,
  overallAvg,
  reviewCount,
  staffRatingAvg,
  atmosphereFitRatingAvg,
  creditRatingAvg,
  latestReviews,
}: SchoolSummaryProps) {
  // 「不明」を除外する関数
  const isValidPrefecture = (pref: string | null | undefined): boolean => {
    return pref !== null && pref !== undefined && pref.trim() !== '' && pref !== '不明';
  };
  
  // すべての都道府県を収集（「不明」は除外）
  const allPrefecturesSet = new Set<string>();
  
  // メイン都道府県を追加（「不明」でない場合のみ）
  if (isValidPrefecture(prefecture)) {
    allPrefecturesSet.add(prefecture);
  }
  
  // prefectures配列があれば追加（「不明」は除外）
  if (prefectures && prefectures.length > 0) {
    prefectures.forEach(p => {
      if (isValidPrefecture(p)) {
        allPrefecturesSet.add(p);
      }
    });
  }
  
  // 有効な都道府県のみを表示
  const displayPrefectures = Array.from(allPrefecturesSet);
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 md:p-8 mb-6">
      {/* 学校名と都道府県 */}
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{name}</h1>
        <div className="flex flex-wrap gap-2">
          {displayPrefectures.map((pref, index) => (
            <Badge key={index} variant="primary" size="md">{pref}</Badge>
          ))}
        </div>
      </div>

      {/* 総合平均スコアと口コミ数 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 mb-6 pb-6 border-b border-gray-200">
        {overallAvg !== null ? (
          <>
            <div className="flex items-center gap-3">
              <StarRatingDisplay value={overallAvg} size="lg" showLabel />
              <div className="text-3xl md:text-4xl font-bold text-gray-900">
                {overallAvg.toFixed(1)}
                <span className="text-lg md:text-xl font-normal text-gray-600 ml-1">/ 5.0</span>
              </div>
            </div>
            <div className="text-sm md:text-base text-gray-600 sm:ml-auto">
              <span className="font-semibold text-gray-900">{reviewCount}</span>件の口コミ
            </div>
          </>
        ) : (
          <div className="text-gray-400">評価なし</div>
        )}
      </div>

      {/* 主要3指標を横並びのスコアカードで表示 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs md:text-sm text-gray-600 mb-2">先生・職員の対応</p>
          {staffRatingAvg !== null ? (
            <div className="flex items-center justify-center gap-1.5">
              <StarRatingDisplay value={staffRatingAvg} size="sm" />
              <span className="text-base md:text-lg font-semibold text-gray-900">{staffRatingAvg.toFixed(1)}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">評価なし</span>
          )}
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
          <p className="text-xs md:text-sm text-gray-600 mb-2">在校生の雰囲気</p>
          {atmosphereFitRatingAvg !== null ? (
            <div className="flex items-center justify-center gap-1.5">
              <StarRatingDisplay value={atmosphereFitRatingAvg} size="sm" />
              <span className="text-base md:text-lg font-semibold text-gray-900">{atmosphereFitRatingAvg.toFixed(1)}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">評価なし</span>
          )}
        </div>
        <div className="text-center p-4 bg-amber-50 rounded-lg border border-amber-100">
          <p className="text-xs md:text-sm text-gray-600 mb-2">単位取得のしやすさ</p>
          {creditRatingAvg !== null ? (
            <div className="flex items-center justify-center gap-1.5">
              <StarRatingDisplay value={creditRatingAvg} size="sm" />
              <span className="text-base md:text-lg font-semibold text-gray-900">{creditRatingAvg.toFixed(1)}</span>
            </div>
          ) : (
            <span className="text-xs text-gray-400">評価なし</span>
          )}
        </div>
      </div>
    </div>
  );
}


