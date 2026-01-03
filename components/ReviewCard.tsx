'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StarRatingDisplay from './StarRatingDisplay';

// 通信制を選んだ理由の選択肢名マッピング
const reasonForChoosingMap: Record<string, string> = {
  '心の不調': '心の不調のため',
  '心の不調のため': '心の不調のため',
  '人間関係': '先生・友人などの人間関係に悩んだため',
  '先生・友人などの人間関係に悩んだため': '先生・友人などの人間関係に悩んだため',
  '全日制の学習スタイルが合わないため': '全日制の学習スタイルが合わないため',
  '心や体の状態／発達障害・知的障害などのため': '心や体の状態／発達障害・知的障害などのため',
  '働きながら学びたいため': '働きながら学びたいため',
  'スポーツ/芸術/芸能活動との両立のため': 'スポーツ/芸術/芸能活動との両立のため',
  '学費をおさえるため': '学費をおさえるため',
  '学びなおしのため': '学びなおしのため',
  'その他': 'その他',
};

interface ReviewCardProps {
  id: string;
  schoolName: string;
  schoolSlug: string | null;
  overallSatisfaction: number;
  goodComment: string;
  badComment?: string;
  enrollmentYear: number | null;
  attendanceFrequency: string | null;
  likeCount: number;
  createdAt: string;
  status?: string;
  reasonForChoosing?: string[];
  attendanceFrequencyProp?: string | null;
  campusPrefecture?: string | null;
}

export default function ReviewCard({
  id,
  schoolName,
  schoolSlug,
  overallSatisfaction,
  goodComment,
  badComment,
  enrollmentYear,
  attendanceFrequency,
  likeCount,
  createdAt,
  status,
  reasonForChoosing,
  attendanceFrequencyProp,
  campusPrefecture,
}: ReviewCardProps) {
  const router = useRouter();
  
  // デバッグ用ログ（最初の3件のみ）
  if (typeof window !== 'undefined' && id) {
    const debugKey = `review_debug_${id}`;
    if (!sessionStorage.getItem(debugKey)) {
      console.log(`[ReviewCard] ${id} - campusPrefecture:`, campusPrefecture);
      console.log(`[ReviewCard] ${id} - campusPrefecture型:`, typeof campusPrefecture);
      sessionStorage.setItem(debugKey, 'true');
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // コメントを100文字で切り詰め
  const truncatedGoodComment = goodComment.length > 100
    ? goodComment.substring(0, 100) + '...'
    : goodComment;
  
  const truncatedBadComment = badComment && badComment.length > 100
    ? badComment.substring(0, 100) + '...'
    : badComment;

  const handleCardClick = () => {
    router.push(`/reviews/${id}`);
  };

  return (
    <div
      onClick={handleCardClick}
      className="block p-5 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {schoolSlug ? (
              <Link
                href={`/schools/${schoolSlug}`}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                {schoolName}
              </Link>
            ) : (
              <span className="text-sm text-gray-600">{schoolName}</span>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              {reasonForChoosing && reasonForChoosing.length > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded">
                  通信制を選んだ理由：{reasonForChoosingMap[reasonForChoosing[0]] || reasonForChoosing[0]}
                </span>
              )}
              {attendanceFrequencyProp && (
                <span className="px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded">
                  通学頻度: {attendanceFrequencyProp}
                </span>
              )}
              {campusPrefecture && String(campusPrefecture).trim() !== '' && (
                <span className="px-2 py-0.5 text-xs font-medium bg-purple-50 text-purple-700 rounded">
                  都道府県: {String(campusPrefecture)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-600">総合満足度</span>
            <StarRatingDisplay value={overallSatisfaction} size="sm" />
            <span className="text-sm text-gray-500">
              {formatDate(createdAt)}
            </span>
          </div>
          {(enrollmentYear || attendanceFrequency) && (
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              {enrollmentYear && <span>{enrollmentYear}年入学</span>}
              {enrollmentYear && attendanceFrequency && <span>•</span>}
              {attendanceFrequency && <span>{attendanceFrequency}</span>}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2.5 mb-4">
        {goodComment && (
          <div>
            <p className="text-xs font-semibold text-green-600 mb-1">良い点</p>
            <p className="text-gray-700 line-clamp-2 text-sm">{truncatedGoodComment}</p>
          </div>
        )}
        {badComment && (
          <div>
            <p className="text-xs font-semibold text-rose-600 mb-1">改善してほしい点</p>
            <p className="text-gray-700 line-clamp-2 text-sm">{truncatedBadComment}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          <span>{likeCount}</span>
        </div>
        <span className="text-sm text-blue-600 hover:text-blue-700 font-medium">
          続きを読む →
        </span>
      </div>
    </div>
  );
}






