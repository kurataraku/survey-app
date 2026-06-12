import type { PublicCourseListing } from '@/lib/types/courses';

interface CourseListBlockProps {
  listing: PublicCourseListing | null;
  /** 学校公式サイトURL（出典クレジット用リンク） */
  officialUrl?: string | null;
  className?: string;
}

/**
 * コース一覧（学校公式サイト引用）の表示ブロック。
 * 学費目安とは独立したカードとして表示する。
 * 公式サイトからの引用であることを明記し、公式サイトへのリンクでクレジットする。
 * 公開済みデータがない場合は何も描画しない。
 */
export default function CourseListBlock({
  listing,
  officialUrl,
  className = '',
}: CourseListBlockProps) {
  if (!listing || listing.courses.length === 0) return null;

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 sm:p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h4 className="text-sm font-bold text-gray-900">コース一覧</h4>
        <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
          学校公式サイトより
        </span>
      </div>

      <ul className="space-y-1.5 mb-3">
        {listing.courses.map((course, i) => (
          <li key={i} className="text-sm text-gray-800 leading-relaxed">
            <span className="font-medium">{course.name}</span>
            {course.attendance && (
              <span className="text-gray-500 text-xs ml-1.5">（{course.attendance}）</span>
            )}
            {course.note && <span className="text-gray-500 text-xs ml-1.5">{course.note}</span>}
          </li>
        ))}
      </ul>

      {listing.public_note && (
        <p className="text-xs text-gray-600 leading-relaxed mb-2">{listing.public_note}</p>
      )}

      <p className="pt-2 border-t border-gray-100 text-xs text-gray-500 leading-relaxed">
        ※コース名は学校公式サイトの掲載内容を引用した参考情報です。名称・内容・募集状況は変わる場合があるため、最新情報は
        {officialUrl ? (
          <>
            <a
              href={officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline font-medium"
            >
              学校公式サイト
            </a>
            でご確認ください。
          </>
        ) : (
          '学校公式サイトでご確認ください。'
        )}
      </p>
    </div>
  );
}
