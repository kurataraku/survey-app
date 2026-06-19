'use client';

import Link from 'next/link';
import { appPath } from '@/lib/base-path';
import { GA_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

export default function ConsultationAiTopBanner() {
  const handleOpenFloating = () => {
    trackEvent(GA_EVENTS.consultationAiOpen, { source: 'home_top_banner' });
    window.dispatchEvent(new Event('open-consultation-ai'));
  };

  return (
    <section className="mb-10" aria-labelledby="consultation-ai-banner-heading">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700 p-6 sm:p-8 shadow-lg">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -left-12 -bottom-12 h-52 w-52 rounded-full bg-white/10" />

        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-black text-white">
              💬 新機能
            </p>
            <h2 id="consultation-ai-banner-heading" className="text-2xl font-black leading-snug text-white md:text-3xl">
              通信制高校えらび相談AI
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/90 md:text-base">
              通学頻度・学習スタイル・サポート体制などの希望条件を、公開口コミをもとに整理。
              お子さまに合いそうな通信制高校の候補と、比較時に見るべきポイントを提案します。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleOpenFloating}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-sky-700 shadow-md hover:shadow-lg"
            >
              ここで相談を始める
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <Link
              href={appPath('/consultation-ai')}
              onClick={() => trackEvent(GA_EVENTS.consultationAiOpen, { source: 'home_top_banner_page' })}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/40 bg-transparent px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              専用ページを開く
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
