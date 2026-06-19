'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { BASE_PATH, appPath } from '@/lib/base-path';
import { GA_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`${appPath('/schools')}?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const navItems = [
    { href: appPath('/'), label: 'ホーム', special: false },
    { href: appPath('/schools'), label: '学校検索', special: false },
    { href: appPath('/rankings'), label: 'ランキング', special: false },
    { href: appPath('/features'), label: '特集', special: false },
    { href: appPath('/consultation-ai'), label: 'AI相談', special: 'consultation' },
    { href: appPath('/simulator'), label: '診断ナビ', special: true },
    { href: appPath('/survey'), label: '口コミ投稿', special: false },
  ];

  const isActive = (href: string) => {
    if (href === appPath('/')) return pathname === href;
    return pathname?.startsWith(href);
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-24 md:h-28 lg:h-32">
          {/* ロゴ */}
          <div className="flex items-start self-start">
            <Link
              href={appPath('/')}
              className="flex items-start focus:outline-none focus:ring-0"
            >
              {/* 視覚障害者向けのテキストラベル */}
              <span className="sr-only">通信制高校リアルレビュー</span>
              {/* ロゴ画像（publicフォルダ直下に配置してください: /public/logo-service.png など） */}
              <img
                src={`${BASE_PATH}/logo-service.png`}
                alt="通信制高校リアルレビュー"
                className="h-24 md:h-28 lg:h-32 w-auto block"
              />
            </Link>
          </div>

          {/* デスクトップナビゲーション */}
          <nav className="hidden md:flex items-center space-x-4">
            {navItems.map((item) =>
              item.special === 'consultation' ? (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() =>
                    trackEvent(GA_EVENTS.consultationAiOpen, { source: 'header_nav' })
                  }
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-black transition-all ${
                    isActive(item.href)
                      ? 'bg-gradient-to-r from-fuchsia-500 to-blue-600 text-white shadow-md scale-105'
                      : 'bg-gradient-to-r from-fuchsia-500 to-blue-600 text-white shadow-sm hover:shadow-md hover:scale-105 active:scale-95'
                  }`}
                >
                  <span className="text-base leading-none">💬</span>
                  {item.label}
                </Link>
              ) : item.special ? (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() =>
                    trackEvent(GA_EVENTS.diagnosisStartClick, { source: 'header_nav' })
                  }
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-black transition-all ${
                    isActive(item.href)
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md scale-105'
                      : 'bg-gradient-to-r from-sky-400 to-indigo-500 text-white shadow-sm hover:shadow-md hover:scale-105 active:scale-95'
                  }`}
                >
                  <span className="text-base leading-none">🎮</span>
                  {item.label}
                </Link>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 text-base font-medium transition-colors ${
                    isActive(item.href)
                      ? 'text-blue-500 border-b-2 border-blue-500'
                      : 'text-gray-700 hover:text-blue-500'
                  }`}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          {/* モバイルメニューボタン */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-gray-700 hover:text-blue-500"
            aria-label="メニュー"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* モバイルメニュー */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            {/* AI相談バナー（モバイルメニュー最上部） */}
            <Link
              href={appPath('/consultation-ai')}
              onClick={() => {
                trackEvent(GA_EVENTS.consultationAiOpen, { source: 'header_mobile_banner' });
                setIsMobileMenuOpen(false);
              }}
              className="mb-3 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-blue-600 px-4 py-3.5 text-white shadow-sm transition-all active:scale-[0.98]"
            >
              <span className="text-2xl leading-none">💬</span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-black leading-tight">通信制高校えらびAI相談</p>
                <p className="mt-0.5 text-xs font-medium text-white/85">
                  不登校・学習面の不安も、口コミをもとに学校選びを整理
                </p>
              </div>
              <svg className="h-5 w-5 shrink-0 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            {/* 診断バナー */}
            <Link
              href={appPath('/simulator')}
              onClick={() => {
                trackEvent(GA_EVENTS.diagnosisStartClick, { source: 'header_mobile_banner' });
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-3 mx-0 mb-3 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 text-white shadow-sm active:scale-[0.98] transition-all"
            >
              <span className="text-2xl leading-none">🎯</span>
              <div className="flex-1 min-w-0">
                <p className="font-black text-[15px] leading-tight">通信制高校えらび診断ナビ</p>
                <p className="text-white/80 text-xs font-medium mt-0.5">A/Bを選んで進めるだけ。合う学校へナビゲートします</p>
              </div>
              <svg className="w-5 h-5 text-white/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <nav className="flex flex-col space-y-1">
              {navItems.filter(item => !item.special && item.href !== appPath('/consultation-ai')).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-3 py-2 text-base font-medium rounded-md transition-colors ${
                    isActive(item.href)
                      ? 'text-blue-500 bg-blue-50'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <form onSubmit={handleSearch} className="mt-4">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="学校名で検索..."
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-blue-500"
                  aria-label="検索"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}



