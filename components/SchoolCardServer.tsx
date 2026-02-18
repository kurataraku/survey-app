import Link from 'next/link';
import { appPath } from '@/lib/base-path';

interface SchoolCardServerProps {
  id: string;
  name: string;
  prefecture: string;
  prefectures?: string[];
  matchedPrefecture?: string;
  slug: string | null;
  reviewCount: number;
  overallAvg: number | null;
}

/** 星評価を静的に描画（Server Component用、SEO対応） */
function StarRating({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const rounded = Math.round(value);
  return (
    <div className="flex gap-1" aria-label={`${value}つ星`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`${sizeClasses} ${i <= rounded ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 fill-gray-300'}`}
          viewBox="0 0 24 24"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

/**
 * 学校カード（Server Component）
 * 学校名・都道府県・評価を初期HTMLに含め、検索エンジンがインデックスできるようにする
 */
export default function SchoolCardServer({
  id,
  name,
  prefecture,
  prefectures,
  matchedPrefecture,
  slug,
  reviewCount,
  overallAvg,
}: SchoolCardServerProps) {
  const isValidPrefecture = (pref: string | null | undefined): boolean => {
    return pref !== null && pref !== undefined && pref.trim() !== '' && pref !== '不明';
  };

  const allPrefecturesSet = new Set<string>();
  if (isValidPrefecture(prefecture)) allPrefecturesSet.add(prefecture);
  if (prefectures?.length) {
    prefectures.forEach((p) => {
      if (isValidPrefecture(p)) allPrefecturesSet.add(p);
    });
  }
  const allPrefectures = Array.from(allPrefecturesSet);

  let displayPrefectures: string[] = [];
  if (allPrefectures.length === 0) {
    displayPrefectures = [];
  } else if (matchedPrefecture && allPrefectures.includes(matchedPrefecture)) {
    const otherPrefectures = allPrefectures.filter((p) => p !== matchedPrefecture);
    displayPrefectures = [matchedPrefecture, ...otherPrefectures.slice(0, 4)];
  } else {
    const mainPrefecture = isValidPrefecture(prefecture) ? prefecture : allPrefectures[0];
    const otherPrefectures = allPrefectures.filter((p) => p !== mainPrefecture);
    displayPrefectures = [mainPrefecture, ...otherPrefectures.slice(0, 4)];
  }

  const href =
    slug && slug.trim() !== ''
      ? appPath(`/schools/${encodeURIComponent(slug)}`)
      : appPath(`/schools/id/${id}`);

  return (
    <Link
      href={href}
      className="block p-5 bg-white border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">{name}</h3>
          <div className="flex flex-wrap gap-1">
            {displayPrefectures.map((pref, index) => (
              <span key={index} className="text-sm text-gray-600">
                {pref}
                {index < displayPrefectures.length - 1 && '、'}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          {overallAvg !== null ? (
            <>
              <span className="text-xs font-medium text-gray-600 whitespace-nowrap">総合満足度</span>
              <StarRating value={overallAvg} size="sm" />
            </>
          ) : (
            <span className="text-sm text-gray-400">評価なし</span>
          )}
        </div>
        <span className="text-sm text-gray-600">{reviewCount}件</span>
      </div>
    </Link>
  );
}
