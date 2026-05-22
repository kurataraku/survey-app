'use client';

interface SchoolSearchFiltersProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selectedPrefecture: string;
  onPrefectureChange: (value: string) => void;
  selectedCampusPrefecture: string;
  onCampusPrefectureChange: (value: string) => void;
  selectedCampusCity: string;
  onCampusCityChange: (value: string) => void;
  campusCityOptions: string[];
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
  selectedCampusPrefecture,
  onCampusPrefectureChange,
  selectedCampusCity,
  onCampusCityChange,
  campusCityOptions,
  minReviewCount,
  onMinReviewCountChange,
  sortBy,
  onSortByChange,
  onSubmit,
  prefectures,
}: SchoolSearchFiltersProps) {
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="md:w-48">
          <select
            value={selectedCampusPrefecture}
            onChange={(e) => onCampusPrefectureChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">キャンパス都道府県</option>
            {prefectures.map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>
        </div>
        <div className="md:w-48">
          <select
            value={selectedCampusCity}
            onChange={(e) => onCampusCityChange(e.target.value)}
            disabled={!selectedCampusPrefecture || campusCityOptions.length === 0}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">市区町村を選択</option>
            {campusCityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          検索
        </button>
      </div>

      {/* 詳細フィルター */}
      <div className="border-t border-gray-200 pt-4">
        <p className="text-sm font-semibold text-gray-900 mb-3">詳細条件</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 最小口コミ数 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              最小口コミ数
            </label>
            <select
              value={minReviewCount || ''}
              onChange={(e) => onMinReviewCountChange(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="review_count_desc">口コミ数が多い順</option>
              <option value="rating_desc">総合満足度が高い順</option>
              <option value="flexibility_desc">生徒対応の柔軟さの評価が高い順</option>
              <option value="support_desc">サポート評価が高い順</option>
              <option value="staff_desc">先生評価が高い順</option>
              <option value="atmosphere_desc">雰囲気評価が高い順</option>
              <option value="credit_desc">単位取得のしやすさの評価が高い順</option>
              <option value="unique_course_desc">独自の授業の評価が高い順</option>
              <option value="career_support_desc">進路支援評価が高い順</option>
              <option value="campus_life_desc">授業以外の学校生活評価が高い順</option>
              <option value="tuition_desc">学費満足度が高い順</option>
              <option value="rating_asc">総合満足度が低い順</option>
              <option value="review_count_asc">口コミ数が少ない順</option>
              <option value="name">学校名順</option>
            </select>
          </div>
        </div>
      </div>
    </form>
  );
}

