import Link from 'next/link';
import { appPath } from '@/lib/base-path';
import { isSafeNoticeLink, type SiteNotice } from '@/lib/notices/getPublishedNotices';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '.');
}

const LINK_CLASS = 'text-blue-600 hover:text-blue-700 underline';

/** お知らせ1件分（Server Component）。トップ欄と一覧ページで共用。 */
export default function NoticeItem({ notice }: { notice: SiteNotice }) {
  const link = isSafeNoticeLink(notice.link_url) ? notice.link_url : null;
  const isInternal = link?.startsWith('/') ?? false;

  return (
    <li className="py-3 sm:flex sm:items-baseline sm:gap-4">
      <time
        dateTime={notice.published_at}
        className="block text-sm text-gray-500 sm:w-24 sm:flex-shrink-0"
      >
        {formatDate(notice.published_at)}
      </time>
      <div className="min-w-0">
        {link && isInternal ? (
          <Link href={appPath(link)} className={LINK_CLASS}>
            {notice.title}
          </Link>
        ) : link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            {notice.title}
          </a>
        ) : (
          <span className="text-gray-900">{notice.title}</span>
        )}
        {notice.body && (
          <p className="mt-1 text-sm text-gray-600 whitespace-pre-line">{notice.body}</p>
        )}
      </div>
    </li>
  );
}
