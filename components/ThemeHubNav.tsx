import Link from 'next/link';
import {
  THEME_HUBS,
  getThemeHubArticlePath,
  getThemeHubsPagePath,
  type ThemeHubId,
} from '@/lib/theme-hubs';

type ThemeHubNavProps = {
  /** 表示するハブID。未指定なら全件 */
  hubIds?: ThemeHubId[];
  /** 見出しの接頭辞（例: 東京都で気になるテーマ） */
  heading?: string;
  /** コンパクト表示（学校ページ向け） */
  compact?: boolean;
  className?: string;
};

export default function ThemeHubNav({
  hubIds,
  heading = 'テーマ別に調べる',
  compact = false,
  className = '',
}: ThemeHubNavProps) {
  const hubs = hubIds
    ? THEME_HUBS.filter((hub) => hubIds.includes(hub.id))
    : THEME_HUBS;

  if (hubs.length === 0) return null;

  return (
    <nav
      className={`rounded-xl border border-gray-200 bg-white p-5 md:p-6 ${className}`}
      aria-label="テーマ別ハブ"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className={`font-bold text-gray-900 ${compact ? 'text-base' : 'text-lg'}`}>
          {heading}
        </h2>
        <Link
          href={getThemeHubsPagePath()}
          className="text-sm text-blue-600 hover:text-blue-800 hover:underline shrink-0"
        >
          ガイド一覧を見る
        </Link>
      </div>
      {!compact && (
        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
          学費・公立・スクーリング・転入など、気になるテーマから記事を選べます。
        </p>
      )}
      <ul className={`grid gap-3 ${compact ? 'sm:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
        {hubs.map((hub) => (
          <li key={hub.id}>
            <Link
              href={getThemeHubArticlePath(hub.primarySlug)}
              className="block h-full rounded-lg border border-gray-100 bg-gray-50/70 p-4 hover:border-blue-300 hover:bg-blue-50/70 transition-colors"
            >
              <span className="block text-sm font-bold text-blue-700 mb-1">{hub.title}</span>
              {!compact && (
                <span className="block text-xs text-gray-600 leading-relaxed">
                  {hub.description}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
