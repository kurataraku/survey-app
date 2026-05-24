import Link from 'next/link';
import { appPath } from '@/lib/base-path';
import { getPrefecturePath } from '@/lib/prefectures';
import {
  getPrefectureShortName,
  prefectureMapGroups,
} from '@/lib/prefectures/map-layout';

const linkBaseClass =
  'inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

function PrefectureLink({
  prefecture,
  className,
}: {
  prefecture: string;
  className?: string;
}) {
  const shortName = getPrefectureShortName(prefecture);
  return (
    <Link
      href={appPath(getPrefecturePath(prefecture))}
      title={`${prefecture}の通信制高校 口コミ・評判`}
      className={className ?? linkBaseClass}
    >
      {shortName}
    </Link>
  );
}

export default function PrefectureMapLinks() {
  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm md:p-8"
      aria-labelledby="prefecture-map-heading"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2 id="prefecture-map-heading" className="mb-2 text-2xl font-bold text-gray-900">
          都道府県から通信制高校を探す
        </h2>
        <p className="text-sm leading-relaxed text-gray-600">
          全国47都道府県の通信制高校口コミ・評判ページへ。口コミ件数・満足度・学費・サポート体制を都道府県別に比較できます。
        </p>
      </div>

      <nav
        className="mx-auto mt-8 w-full max-w-5xl"
        aria-label="都道府県別の通信制高校（地図から探す）"
      >
        <div className="grid gap-4 lg:grid-cols-6 lg:auto-rows-min">
          {prefectureMapGroups.map((group) => (
            <section
              key={group.label}
              className={`rounded-2xl border p-4 shadow-sm ${group.className}`}
              aria-labelledby={`prefecture-group-${group.label}`}
            >
              <h3
                id={`prefecture-group-${group.label}`}
                className="mb-3 text-sm font-bold text-gray-900"
              >
                {group.label}
              </h3>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
                {group.prefectures.map((prefecture) => (
                  <li key={prefecture}>
                    <PrefectureLink
                      prefecture={prefecture}
                      className="flex w-full items-center justify-center rounded-md border border-gray-200 bg-white/90 px-2.5 py-2 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </nav>

      <p className="mt-6 text-center text-xs text-gray-500">
        全47都道府県の通信制高校口コミ・評判ページへリンクしています
      </p>
    </section>
  );
}
