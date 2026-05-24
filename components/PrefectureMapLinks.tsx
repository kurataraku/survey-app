import Link from 'next/link';
import { appPath } from '@/lib/base-path';
import { getPrefecturePath, prefectures } from '@/lib/prefectures';
import {
  getPrefectureShortName,
  prefectureMapPositions,
} from '@/lib/prefectures/map-layout';

const linkBaseClass =
  'inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600';

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

/** 参考サイト風の装飾ブロック（視覚ガイドのみ・クリック不可） */
function MapDecorations() {
  const blocks = [
    'absolute left-[58%] top-[1%] h-[14%] w-[22%] rounded-lg bg-orange-200/50',
    'absolute left-[62%] top-[12%] h-[18%] w-[24%] rounded-lg bg-yellow-200/50',
    'absolute left-[58%] top-[30%] h-[22%] w-[26%] rounded-lg bg-green-200/45',
    'absolute left-[38%] top-[26%] h-[24%] w-[22%] rounded-lg bg-teal-200/45',
    'absolute left-[14%] top-[22%] h-[20%] w-[20%] rounded-lg bg-blue-200/45',
    'absolute left-[30%] top-[44%] h-[18%] w-[24%] rounded-lg bg-purple-200/45',
    'absolute left-[8%] top-[42%] h-[16%] w-[22%] rounded-lg bg-pink-200/45',
    'absolute left-[2%] top-[56%] h-[22%] w-[28%] rounded-lg bg-red-200/40',
    'absolute left-[4%] top-[82%] h-[10%] w-[14%] rounded-lg bg-red-200/35',
  ];
  return (
    <>
      {blocks.map((className) => (
        <div key={className} className={className} aria-hidden="true" />
      ))}
    </>
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
          全国47都道府県の通信制高校口コミ・評判ページへ。口コミ件数・満足度・学費・サポート体制を都道府県別に比較できます。地図から都道府県名をクリックして、地域別の学校比較ページへ移動してください。
        </p>
      </div>

      {/* モバイル・タブレット: 都道府県順グリッド */}
      <nav className="mt-6 lg:hidden" aria-label="都道府県別の通信制高校">
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {prefectures.map((prefecture) => (
            <li key={prefecture}>
              <PrefectureLink
                prefecture={prefecture}
                className="flex w-full items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-2 py-2 text-sm font-medium text-gray-800 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* PC: イラスト地図風レイアウト */}
      <nav
        className="relative mx-auto mt-8 hidden w-full max-w-4xl lg:block"
        aria-label="都道府県別の通信制高校（地図から探す）"
      >
        <div
          className="relative w-full overflow-hidden rounded-2xl border border-blue-100/80 bg-gradient-to-br from-sky-50 via-blue-50/40 to-indigo-50/30"
          style={{ aspectRatio: '4 / 3', minHeight: '480px' }}
        >
          <MapDecorations />

          <ul className="absolute inset-0 z-10">
            {prefectureMapPositions.map(({ prefecture, x, y }) => (
              <li
                key={prefecture}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <PrefectureLink prefecture={prefecture} />
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <p className="mt-6 text-center text-xs text-gray-500">
        全47都道府県の通信制高校口コミ・評判ページへリンクしています
      </p>
    </section>
  );
}
