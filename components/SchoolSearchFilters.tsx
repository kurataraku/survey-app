'use client';

import { useState } from 'react';

interface SchoolSearchFiltersProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedPrefecture: string;
  onPrefectureChange: (value: string) => void;
  minRating: number | null;
  onMinRatingChange: (value: number | null) => void;
  minReviewCount: number | null;
  onMinReviewCountChange: (value: number | null) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  prefectures: string[];
}

export default function SchoolSearchFilters({
  searchQuery,
  onSearchQueryChange,
  selectedPrefecture,
  onPrefectureChange,
  minRating,
  onMinRatingChange,
  minReviewCount,
  onMinReviewCountChange,
  sortBy,
  onSortByChange,
  onSubmit,
  prefectures,
}: SchoolSearchFiltersProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-lg shadow-sm p-6 mb-6">
      {/* 基本検索 */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="学校名で検索"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div className="md:w-48">
          <select
            value={selectedPrefecture}
            onChange={(e) => onPrefectureChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <option value="">都道府県を選択</option>
            {prefectures.map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
        >
          検索
        </button>
      </div>

      {/* 詳細フィルター */}
      <div className="border-t border-gray-200 pt-4">
        <button
          type="button"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="text-sm text-orange-600 hover:text-orange-700 font-medium mb-4"
        >
          {showAdvancedFilters ? '詳細フィルターを閉じる' : '詳細フィルターを開く'} {showAdvancedFilters ? '▲' : '▼'}
        </button>

        {showAdvancedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 最小評価 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                最小評価
              </label>
              <select
                value={minRating || ''}
                onChange={(e) => onMinRatingChange(e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">指定なし</option>
                <option value="4.5">4.5以上</option>
                <option value="4.0">4.0以上</option>
                <option value="3.5">3.5以上</option>
                <option value="3.0">3.0以上</option>
              </select>
            </div>

            {/* 最小口コミ数 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                最小口コミ数
              </label>
              <select
                value={minReviewCount || ''}
                onChange={(e) => onMinReviewCountChange(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">指定なし</option>
                <option value="10">10件以上</option>
                <option value="5">5件以上</option>
                <option value="3">3件以上</option>
                <option value="1">1件以上</option>
              </select>
            </div>

            {/* ソート順 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                並び順
              </label>
              <select
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="name">学校名順</option>
                <option value="rating_desc">評価が高い順</option>
                <option value="rating_asc">評価が低い順</option>
                <option value="review_count_desc">口コミ数が多い順</option>
                <option value="review_count_asc">口コミ数が少ない順</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}

