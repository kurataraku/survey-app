'use client';

import Link from 'next/link';
import StarRatingDisplay from './StarRatingDisplay';

interface SchoolCardProps {
  id: string;
  name: string;
  prefecture: string;
  prefectures?: string[]; // 複数の都道府県に対応
  matchedPrefecture?: string; // 検索で該当した都道府県
  slug: string | null;
  reviewCount: number;
  overallAvg: number | null;
}

export default function SchoolCard({
  id,
  name,
  prefecture,
  prefectures,
  matchedPrefecture,
  slug,
  reviewCount,
  overallAvg,
}: SchoolCardProps) {
  // 検索で該当した都道府県を最初に、その後に他の都道府県を3〜4つ表示
  let displayPrefectures: string[] = [];
  
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
  
  const allPrefectures = Array.from(allPrefecturesSet);
  
  if (allPrefectures.length === 0) {
    // 有効な都道府県が1つもない場合のみ空配列
    displayPrefectures = [];
  } else if (matchedPrefecture && allPrefectures.includes(matchedPrefecture)) {
    // 検索で該当した都道府県がある場合、それを最初に
    const otherPrefectures = allPrefectures.filter(p => p !== matchedPrefecture);
    // その他の都道府県を3〜4つに制限
    const limitedOthers = otherPrefectures.slice(0, 4);
    displayPrefectures = [matchedPrefecture, ...limitedOthers];
  } else {
    // 検索で該当した都道府県がない場合、メイン都道府県を最初に
    // メイン都道府県が「不明」の場合は、最初の有効な都道府県を使用
    const mainPrefecture = isValidPrefecture(prefecture) ? prefecture : allPrefectures[0];
    const otherPrefectures = allPrefectures.filter(p => p !== mainPrefecture);
    // その他の都道府県を3〜4つに制限
    const limitedOthers = otherPrefectures.slice(0, 4);
    displayPrefectures = [mainPrefecture, ...limitedOthers];
  }
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
      className="block p-5 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
            {name}
          </h3>
          <div className="flex flex-wrap gap-1">
            {displayPrefectures.map((pref, index) => (
              <span key={index} className="text-sm text-gray-600">
                {pref}{index < displayPrefectures.length - 1 && '、'}
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
              <StarRatingDisplay value={overallAvg} size="sm" showLabel />
            </>
          ) : (
            <span className="text-sm text-gray-400">評価なし</span>
          )}
        </div>
        <span className="text-sm text-gray-600">
          {reviewCount}件
        </span>
      </div>
    </Link>
  );
}

