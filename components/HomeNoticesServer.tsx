import Link from 'next/link';
import NoticeItem from '@/components/NoticeItem';
import { getPublishedNotices } from '@/lib/notices/getPublishedNotices';
import { appPath } from '@/lib/base-path';

const HOME_NOTICE_LIMIT = 5;

/** トップページのお知らせ欄（Server Component）。公開中が0件なら何も表示しない。 */
export default async function HomeNoticesServer() {
  const notices = await getPublishedNotices();
  if (notices.length === 0) return null;

  return (
    <section
      className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm"
      aria-labelledby="home-notices-heading"
    >
      <h2 id="home-notices-heading" className="text-lg font-bold text-gray-900 mb-1">
        お知らせ
      </h2>
      <ul className="divide-y divide-gray-100">
        {notices.slice(0, HOME_NOTICE_LIMIT).map((notice) => (
          <NoticeItem key={notice.id} notice={notice} />
        ))}
      </ul>
      <div className="mt-2 text-right">
        <Link
          href={appPath('/notices')}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          お知らせ一覧を見る →
        </Link>
      </div>
    </section>
  );
}
