import type { Metadata } from 'next';
import Link from 'next/link';
import { appPath } from '@/lib/base-path';
import { getAppBaseUrl } from '@/lib/env-check';
import { PRESS_RELEASES } from '@/lib/press-releases';

const appBaseUrl = getAppBaseUrl();

export const metadata: Metadata = {
  title: 'プレスリリース・調査発表',
  description:
    '通信制高校リアルレビューが、在校生・卒業生・保護者の口コミを分析した調査結果やプレスリリースを掲載しています。',
  alternates: { canonical: `${appBaseUrl}/press-releases` },
  openGraph: {
    title: 'プレスリリース・調査発表｜通信制高校リアルレビュー',
    description:
      '通信制高校の口コミをもとにした独自調査とプレスリリースを掲載しています。',
    type: 'website',
    url: `${appBaseUrl}/press-releases`,
  },
};

export default function PressReleasesPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-800 bg-white">
        <div className="mx-auto max-w-[42rem] px-4 py-10 sm:px-6 sm:py-12">
          <p className="press-doc__meta">株式会社キャリアエッセンス</p>
          <h1 className="press-doc__serif mt-3 text-3xl font-bold leading-tight text-neutral-900">
            プレスリリース・調査発表
          </h1>
          <p className="mt-4 text-[15px] leading-8 text-neutral-700">
            在校生・卒業生・保護者から寄せられた口コミをもとにした、独自調査と運営からのお知らせです。
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-[42rem] px-4 py-10 sm:px-6 sm:py-12">
        <ul className="divide-y divide-neutral-300 border-y border-neutral-800">
          {PRESS_RELEASES.map((release) => (
            <li key={release.slug} className="py-7">
              <p className="press-doc__meta">
                <time dateTime={release.publishedAt}>{release.displayDate}</time>
                <span className="mx-2" aria-hidden>
                  ｜
                </span>
                {release.category}
              </p>
              <h2 className="press-doc__serif mt-3 text-xl font-bold leading-8 text-neutral-900">
                <Link
                  href={appPath(`/press-releases/${release.slug}`)}
                  className="no-underline hover:underline"
                >
                  {release.title}
                </Link>
              </h2>
              <p className="mt-3 text-[15px] leading-8 text-neutral-700">
                {release.description}
              </p>
              <p className="mt-4">
                <Link
                  href={appPath(`/press-releases/${release.slug}`)}
                  className="text-sm font-medium"
                >
                  本文を読む
                </Link>
              </p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
