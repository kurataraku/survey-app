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
      className={`press-doc mb-4 mt-4 ${pressSerif.variable} ${pressSans.variable}`}
      aria-labelledby="home-press-release-heading"
    >
      <div className="mb-3 flex items-end justify-between gap-4 border-b border-neutral-400 pb-2">
        <h2
          id="home-press-release-heading"
          className="press-doc__serif text-lg font-bold text-neutral-900 sm:text-xl"
        >
          調査・プレスリリース
        </h2>
        <Link
          href={appPath('/press-releases')}
          className="shrink-0 text-sm no-underline hover:underline"
        >
          一覧を見る
        </Link>
      </div>

      <Link
        href={appPath(`/press-releases/${release.slug}`)}
        className="block no-underline"
      >
        <p className="press-doc__meta">
          <time dateTime={release.publishedAt}>{release.displayDate}</time>
          <span className="mx-2" aria-hidden>
            ｜
          </span>
          {release.category}
        </p>
        <h3 className="press-doc__serif mt-2 text-base font-bold leading-7 text-neutral-900 sm:text-lg">
          {release.shortTitle}
        </h3>
        <p className="mt-3 text-sm leading-7 text-neutral-700">
          公開口コミ851件を通学頻度別に見ると、ほぼオンライン層と週5通学層の高満足率は
          ともに94.3％。そのあいだの「月1〜数回」層だけ79.2％まで落ち、谷のような形が
          現れました。詳細はプレスリリース本文でご覧ください。
        </p>
      </Link>
    </section>
  );
}
