import Link from 'next/link';
import { IBM_Plex_Sans_JP, Noto_Serif_JP } from 'next/font/google';
import { appPath } from '@/lib/base-path';
import { ATTENDANCE_SATISFACTION_RELEASE } from '@/lib/press-releases';

const pressSerif = Noto_Serif_JP({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-press-serif',
  display: 'swap',
});

const pressSans = IBM_Plex_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-press-sans',
  display: 'swap',
});

export default function PressReleaseHomeTeaser() {
  const release = ATTENDANCE_SATISFACTION_RELEASE;

  return (
    <section
      className={`press-doc mb-12 ${pressSerif.variable} ${pressSans.variable}`}
      aria-labelledby="home-press-release-heading"
    >
      <div className="mb-4 flex items-end justify-between gap-4 border-b border-neutral-800 pb-3">
        <h2
          id="home-press-release-heading"
          className="press-doc__serif text-xl font-bold text-neutral-900 sm:text-2xl"
        >
          調査・プレスリリース
        </h2>
        <Link
          href={appPath('/press-releases')}
          className="shrink-0 text-sm font-medium no-underline hover:underline"
        >
          一覧を見る
        </Link>
      </div>

      <Link
        href={appPath(`/press-releases/${release.slug}`)}
        className="block border border-neutral-300 bg-white p-5 no-underline transition-colors hover:border-neutral-500 sm:p-6"
      >
        <p className="press-doc__meta">
          <time dateTime={release.publishedAt}>{release.displayDate}</time>
          <span className="mx-2" aria-hidden>
            ｜
          </span>
          {release.category}
        </p>
        <h3 className="press-doc__serif mt-3 text-lg font-bold leading-8 text-neutral-900 sm:text-xl">
          {release.shortTitle}
        </h3>
        <p className="mt-3 text-sm leading-7 text-neutral-700">
          公開口コミ851件を点検。通学頻度別に分析すると、月1〜数回層だけ
          高満足率が大きく低下する「谷」が見つかりました。
        </p>

        <table className="press-doc__table mt-5">
          <caption className="sr-only">通学頻度別の高満足率</caption>
          <thead>
            <tr>
              <th scope="col">主な通学頻度</th>
              <th scope="col" className="num">
                高満足率
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>ほぼオンライン／自宅</td>
              <td className="num">94.3％</td>
            </tr>
            <tr data-emphasis="true">
              <td>月1〜数回</td>
              <td className="num">79.2％</td>
            </tr>
            <tr>
              <td>週5</td>
              <td className="num">94.3％</td>
            </tr>
          </tbody>
        </table>
      </Link>
    </section>
  );
}
