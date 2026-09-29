import Link from 'next/link';
import { BASE_PATH, appPath } from '@/lib/base-path';

const navItems = [
  { href: appPath('/'), label: 'ホーム' },
  { href: appPath('/schools'), label: '学校検索' },
  { href: appPath('/rankings'), label: 'ランキング' },
  { href: appPath('/features'), label: '特集' },
  { href: appPath('/survey'), label: '口コミ投稿' },
] as const;

export default function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-24 items-center justify-between md:h-28 lg:h-32">
          <Link
            href={appPath('/')}
            prefetch={false}
            className="flex self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="sr-only">通信制高校リアルレビュー</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${BASE_PATH}/logo-service.png`}
              alt="通信制高校リアルレビュー"
              className="block h-24 w-auto md:h-28 lg:h-32"
            />
          </Link>

          <nav className="hidden items-center gap-4 md:flex" aria-label="メインメニュー">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className="px-3 py-2 text-base font-medium text-gray-700 transition-colors hover:text-blue-600"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={appPath('/consultation-ai')}
              prefetch={false}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-500 to-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm transition-transform hover:scale-105"
            >
              <span aria-hidden>💬</span>
              AI相談
            </Link>
            <Link
              href={appPath('/simulator')}
              prefetch={false}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-400 to-indigo-500 px-4 py-2 text-sm font-black text-white shadow-sm transition-transform hover:scale-105"
            >
              <span aria-hidden>🎮</span>
              診断ナビ
            </Link>
          </nav>

          <details className="group md:hidden">
            <summary className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center text-gray-700 [&::-webkit-details-marker]:hidden">
              <span className="sr-only">メニューを開く</span>
              <svg
                className="h-6 w-6 group-open:hidden"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <svg
                className="hidden h-6 w-6 group-open:block"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </summary>

            <div className="absolute inset-x-0 top-full border-t border-gray-200 bg-white px-4 py-4 shadow-lg">
              <Link
                href={appPath('/consultation-ai')}
                prefetch={false}
                className="mb-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-blue-600 px-4 py-3.5 text-white shadow-sm"
              >
                <span className="text-2xl" aria-hidden>💬</span>
                <span>
                  <span className="block text-[15px] font-black">通信制高校えらびAI相談</span>
                  <span className="mt-0.5 block text-xs text-white/85">口コミをもとに学校選びを整理</span>
                </span>
              </Link>
              <Link
                href={appPath('/simulator')}
                prefetch={false}
                className="mb-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 px-4 py-3.5 text-white shadow-sm"
              >
                <span className="text-2xl" aria-hidden>🎯</span>
                <span>
                  <span className="block text-[15px] font-black">通信制高校えらび診断ナビ</span>
                  <span className="mt-0.5 block text-xs text-white/85">質問に答えて、合う学校へ</span>
                </span>
              </Link>

              <nav className="flex flex-col gap-1" aria-label="モバイルメニュー">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    className="rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <form action={appPath('/schools')} method="get" className="mt-4">
                <label htmlFor="header-school-search" className="sr-only">学校名で検索</label>
                <div className="flex gap-2">
                  <input
                    id="header-school-search"
                    name="q"
                    type="search"
                    placeholder="学校名で検索..."
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    type="submit"
                    className="min-h-11 rounded-lg bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700"
                  >
                    検索
                  </button>
                </div>
              </form>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
