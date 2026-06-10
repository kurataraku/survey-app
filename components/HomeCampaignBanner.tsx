'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiPath, appPath } from '@/lib/base-path';
import { GA_EVENTS } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/track';

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  reward_amount: number;
  ends_at: string;
}

export default function HomeCampaignBanner() {
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    fetch(apiPath('/api/campaign/active'))
      .then((r) => r.json())
      .then((d) => setCampaign(d.campaign))
      .catch(() => setCampaign(null));
  }, []);

  const rewardLabel = (campaign?.reward_amount ?? 200).toLocaleString('ja-JP');

  return (
    <section className="mb-8" aria-label="口コミ協力キャンペーン">
      <Link
        href={appPath('/campaign')}
        onClick={() => trackEvent(GA_EVENTS.ctaCampaignClick, { source: 'home_banner' })}
        className="group block relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-4 sm:p-7 md:p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
      >
        <div
          className="pointer-events-none absolute -top-16 -right-12 h-56 w-56 rounded-full bg-white/15 blur-sm"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-yellow-200/20 blur-md"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-20 top-5 hidden h-16 w-16 rounded-full border border-white/25 bg-white/10 md:block"
          aria-hidden
        />

        <div className="relative grid gap-3 md:gap-5 md:grid-cols-[minmax(0,1fr)_310px] md:items-center lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 bg-white/25 text-white text-[10px] sm:text-xs font-black px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full mb-2 sm:mb-3 tracking-wide ring-1 ring-white/20">
              <span>🎁</span>
              <span>口コミ協力キャンペーン</span>
            </div>
            <h2 className="text-white font-black leading-tight tracking-tight mb-2 sm:mb-3">
              <span className="block text-base sm:text-2xl md:text-3xl">
                通信制高校の口コミ投稿で
              </span>
              <span className="mt-1 sm:mt-2 flex flex-wrap items-center gap-1.5 sm:gap-3">
                <span className="text-sm sm:text-xl md:text-2xl">QUOカードPay</span>
                <span className="inline-flex items-baseline rounded-xl sm:rounded-2xl bg-white px-2.5 sm:px-3.5 py-1 sm:py-1.5 text-orange-600 shadow-md ring-1 ring-orange-100">
                  <span className="text-3xl sm:text-5xl md:text-6xl leading-none tracking-[-0.05em]">
                    {rewardLabel}
                  </span>
                  <span className="ml-0.5 sm:ml-1 text-base sm:text-xl md:text-2xl">円分</span>
                </span>
                <span className="text-sm sm:text-xl md:text-2xl">プレゼント</span>
              </span>
            </h2>
            <p className="text-white/95 text-xs sm:text-base font-semibold mb-1.5 sm:mb-3 leading-relaxed">
              コンビニでアイス、アイスコーヒー、ジュースに。
              <br className="hidden sm:block" />
              <span className="hidden sm:inline">現役生・保護者・卒業生のリアルな声を募集しています。</span>
            </p>
            <p className="text-white/75 text-[10px] sm:text-xs leading-relaxed">
              2020年以降の入学者に関する口コミが対象。承認・対象条件があります。
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 md:flex-col md:items-center md:gap-4">
            <SummerRewardIllustration />
            <div className="inline-flex shrink-0 items-center justify-center gap-1.5 sm:gap-2 bg-white text-orange-600 font-black text-xs sm:text-base px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200">
              <span>キャンペーンを見る</span>
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}

function SummerRewardIllustration() {
  return (
    <div
      className="relative h-20 w-32 shrink-0 sm:mx-auto sm:h-40 sm:w-full sm:max-w-[300px] md:h-44 md:max-w-[340px]"
      aria-label="アイス、アイスコーヒー、ジュースのイラスト"
    >
      <div
        className="absolute inset-x-3 bottom-1 h-8 sm:h-14 rounded-[999px] bg-white/16 blur-sm"
        aria-hidden
      />
      <div
        className="absolute right-2 top-0 h-8 w-8 sm:right-3 sm:top-1 sm:h-14 sm:w-14 rounded-full bg-yellow-200/35 ring-1 ring-white/25"
        aria-hidden
      />
      <div
        className="absolute left-5 top-5 h-3 w-3 rounded-full bg-white/45"
        aria-hidden
      />
      <div
        className="absolute left-14 top-1 h-2 w-2 rounded-full bg-white/35"
        aria-hidden
      />
      <IceCreamIcon />
      <IcedCoffeeIcon />
      <JuiceIcon />
    </div>
  );
}

function IceCreamIcon() {
  return (
    <svg
      className="absolute bottom-1 left-0 h-16 w-14 rotate-[-8deg] drop-shadow-lg sm:h-32 sm:w-28 md:h-36 md:w-32"
      viewBox="0 0 96 112"
      fill="none"
      aria-hidden
    >
      <path
        d="M38.4 98.4 19.2 51.6h57.6L57.6 98.4c-3.6 8.6-15.6 8.6-19.2 0Z"
        fill="#F6B26B"
      />
      <path d="M26.8 63.6h42.4" stroke="#C97932" strokeWidth="4.4" strokeLinecap="round" />
      <path d="M32.4 76.8h31.2" stroke="#C97932" strokeWidth="4.4" strokeLinecap="round" />
      <circle cx="48" cy="40.8" r="25.6" fill="#FFF4CC" />
      <circle cx="35" cy="42.4" r="15.6" fill="#F7A8B8" />
      <circle cx="61" cy="42.4" r="15.6" fill="#FFF1A8" />
      <circle cx="48" cy="27.6" r="17.6" fill="#FFFFFF" />
      <path d="M42 21.6h.2M54 24.8h.2M48 34.4h.2" stroke="#EF7C8E" strokeWidth="4.8" strokeLinecap="round" />
    </svg>
  );
}

function JuiceIcon() {
  return (
    <svg
      className="absolute bottom-1 right-0 h-16 w-14 rotate-[8deg] drop-shadow-lg sm:h-32 sm:w-28 md:h-36 md:w-32"
      viewBox="0 0 96 112"
      fill="none"
      aria-hidden
    >
      <path d="M26 30h44l-4.8 68.8A10 10 0 0 1 55.2 108H40.8a10 10 0 0 1-10-9.2L26 30Z" fill="#FFE8A3" />
      <path d="M30.4 66h35.2l-2.2 32.6A7.6 7.6 0 0 1 55.8 106H40.2a7.6 7.6 0 0 1-7.6-7.4L30.4 66Z" fill="#FF8A3D" />
      <path d="M32 30h32" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      <path d="M56 28 68 6" stroke="#FFF7D6" strokeWidth="7" strokeLinecap="round" />
      <path d="M68 6h14" stroke="#FFF7D6" strokeWidth="7" strokeLinecap="round" />
      <circle cx="51.6" cy="81" r="4.4" fill="#FFFFFF" opacity=".7" />
      <circle cx="42" cy="91" r="3.2" fill="#FFFFFF" opacity=".65" />
    </svg>
  );
}

function IcedCoffeeIcon() {
  return (
    <svg
      className="absolute bottom-0 left-1/2 z-10 h-20 w-16 -translate-x-1/2 drop-shadow-xl sm:h-40 sm:w-32 md:h-44 md:w-36"
      viewBox="0 0 112 144"
      fill="none"
      aria-hidden
    >
      <path d="M34 32h44l-5.4 94.2A14 14 0 0 1 58.6 139H53.4a14 14 0 0 1-14-12.8L34 32Z" fill="#F7FBFF" />
      <path d="M39 65h34l-3.5 61A10 10 0 0 1 59.5 135h-7A10 10 0 0 1 42.5 126L39 65Z" fill="#9A5A2A" />
      <path d="M38 54h36" stroke="#FFFFFF" strokeWidth="8" strokeLinecap="round" />
      <path d="M43 77h26" stroke="#CDEBFF" strokeWidth="5" strokeLinecap="round" opacity=".9" />
      <path d="M45 94h21" stroke="#CDEBFF" strokeWidth="5" strokeLinecap="round" opacity=".75" />
      <path d="M63 31 78 6" stroke="#FFF7D6" strokeWidth="7" strokeLinecap="round" />
      <path d="M78 6h15" stroke="#FFF7D6" strokeWidth="7" strokeLinecap="round" />
      <circle cx="50" cy="75" r="6" fill="#F7FBFF" opacity=".85" />
      <circle cx="63" cy="87" r="5" fill="#F7FBFF" opacity=".7" />
      <circle cx="53" cy="101" r="4" fill="#F7FBFF" opacity=".65" />
      <path d="M33 32h46" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
