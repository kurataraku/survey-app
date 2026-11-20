import Link from 'next/link';
import type { Metadata } from 'next';
import NoticeItem from '@/components/NoticeItem';
import { getPublishedNotices } from '@/lib/notices/getPublishedNotices';
import { appPath } from '@/lib/base-path';
import { getAppBaseUrl } from '@/lib/env-check';

export const revalidate = 300;

const TITLE = 'お知らせ｜通信制高校リアルレビュー';

export const metadata: Metadata = {
  title: TITLE,
  description: '通信制高校リアルレビューからのお知らせ一覧です。',
  alternates: { canonical: `${getAppBaseUrl()}/notices` },
};

export default async function NoticesPage() {
  const notices = await getPublishedNotices();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <nav className="text-sm text-gray-500 mb-4">
          <Link href={appPath('/')} className="hover:text-gray-700">
            トップ
          </Link>
          <span className="mx-2">/</span>
          <span>お知らせ</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">お知らせ</h1>
        {notices.length === 0 ? (
          <p className="text-gray-500">現在お知らせはありません。</p>
        ) : (
          <ul className="rounded-2xl border border-gray-200 bg-white px-4 sm:px-5 shadow-sm divide-y divide-gray-100">
            {notices.map((notice) => (
              <NoticeItem key={notice.id} notice={notice} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
