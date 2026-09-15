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
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-blue-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="mb-3 text-sm font-bold tracking-widest text-blue-600">
            PRESS RELEASE
          </p>
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
            プレスリリース・調査発表
          </h1>
          <p className="mt-4 max-w-3xl leading-7 text-gray-600">
            在校生・卒業生・保護者から寄せられた口コミをもとに、
            通信制高校選びに役立つ独自調査や運営からのお知らせを掲載します。
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="space-y-5">
          {PRESS_RELEASES.map((release) => (
            <article
              key={release.slug}
              className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8"
            >
              <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">
                  {release.category}
                </span>
                <time dateTime={release.publishedAt} className="text-gray-500">
                  {release.displayDate}
                </time>
              </div>
              <h2 className="text-xl font-bold leading-8 text-gray-900 sm:text-2xl">
                <Link
                  href={appPath(`/press-releases/${release.slug}`)}
                  className="transition-colors hover:text-blue-700"
                >
                  {release.title}
                </Link>
              </h2>
              <p className="mt-4 leading-7 text-gray-600">{release.description}</p>
              <Link
                href={appPath(`/press-releases/${release.slug}`)}
                className="mt-5 inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:text-blue-800"
              >
                詳細を見る
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
