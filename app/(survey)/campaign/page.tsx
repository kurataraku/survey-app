import type { Metadata } from 'next';
import Link from 'next/link';
import { appPath } from '@/lib/base-path';
import { getAppBaseUrl } from '@/lib/env-check';
import {
  CAMPAIGN_BENEFITS,
  CAMPAIGN_STEPS,
} from '@/lib/campaign/copy';
import {
  formatRewardAmount,
  getActiveCampaign,
  getDaysLeft,
} from '@/lib/campaign/getActiveCampaign';
import CampaignEligibilitySection from '@/components/CampaignEligibilitySection';
import CampaignFaqAccordion from '@/components/CampaignFaqAccordion';

const appBaseUrl = getAppBaseUrl();
const DEFAULT_REWARD_AMOUNT = 200;

export const metadata: Metadata = {
  title: '口コミ協力キャンペーン｜QUOカードPayプレゼント',
  description:
    '通信制高校の口コミにご協力いただいた方にQUOカードPayをプレゼント。2020年以降の入学者・保護者・卒業生が対象。コンビニで使える200円分の特典。',
  alternates: { canonical: `${appBaseUrl}/campaign` },
  openGraph: {
    title: '口コミ協力キャンペーン｜QUOカードPayプレゼント',
    description:
      '通信制高校のリアルな口コミにご協力ください。承認後、QUOカードPayをプレゼントします。',
    type: 'website',
    url: `${appBaseUrl}/campaign`,
  },
};

export default async function CampaignPage() {
  const campaign = await getActiveCampaign();
  const rewardAmount = campaign?.reward_amount ?? DEFAULT_REWARD_AMOUNT;
  const rewardLabel = formatRewardAmount(rewardAmount);
  const rewardNumberLabel = rewardAmount.toLocaleString('ja-JP');
  const daysLeft = campaign ? getDaysLeft(campaign.ends_at) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 py-10 sm:py-16 lg:py-20">
        <div
          className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-amber-200/40 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-orange-200/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute right-1/4 top-10 hidden h-20 w-20 rounded-full border border-white/70 bg-white/30 lg:block"
          aria-hidden
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="text-center lg:text-left">
              <p className="inline-flex items-center gap-1.5 bg-amber-500/15 text-amber-900 text-xs font-bold px-3 py-1 rounded-full mb-4 ring-1 ring-amber-200/60">
                <span>🎁</span>
                <span>口コミ協力キャンペーン</span>
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 leading-tight mb-4">
                <span className="block sm:hidden">
                  通信制高校の
                  <br />
                  口コミ投稿で
                </span>
                <span className="hidden sm:block">通信制高校の口コミ投稿で</span>
                <span className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3 lg:justify-start">
                  <span className="basis-full text-xl sm:basis-auto sm:text-2xl lg:text-3xl">
                    QUOカードPay
                  </span>
                  <span className="inline-flex items-baseline rounded-3xl bg-white px-4 py-2 text-orange-600 shadow-lg ring-1 ring-orange-100">
                    <span className="text-5xl sm:text-6xl lg:text-7xl leading-none tracking-[-0.06em]">
                      {rewardNumberLabel}
                    </span>
                    <span className="ml-1 text-2xl sm:text-3xl lg:text-4xl">円分</span>
                  </span>
                  <span className="text-xl sm:text-2xl lg:text-3xl">プレゼント</span>
                </span>
              </h1>
              <p className="text-sm sm:text-base lg:text-lg text-gray-700 font-medium leading-relaxed mb-5">
                アイス、ジュース、コーヒーなど、
                <br className="hidden sm:inline" />
                コンビニのちょっとした楽しみに使えます。
                <br />
                <span className="inline-block">
                  現役生・保護者・卒業生の
                  <br className="sm:hidden" />
                  リアルな声を募集しています。
                </span>
              </p>
              {daysLeft !== null && daysLeft > 0 && (
                <p className="text-sm text-amber-800 font-semibold mb-4">
                  キャンペーン終了まで 残り {daysLeft} 日
                </p>
              )}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 lg:justify-start">
                <Link
                  href={appPath('/survey')}
                  className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-black text-base sm:text-lg px-7 sm:px-9 py-4 rounded-2xl shadow-lg transition-colors w-full sm:w-auto"
                >
                  口コミに回答して{rewardLabel}を受け取る
                </Link>
                <Link
                  href="#eligibility"
                  className="inline-flex items-center justify-center text-orange-700 hover:text-orange-800 font-semibold text-sm underline-offset-4 hover:underline"
                >
                  条件を見る
                </Link>
              </div>
              <div className="mt-4 flex flex-col items-center gap-1 text-xs sm:text-sm text-gray-600 lg:items-start">
                <p className="font-semibold text-gray-700">所要時間：約5分</p>
                <p>対象：現役生・保護者・卒業生</p>
                <p className="text-gray-500">
                  2020年以降の入学者に関する口コミが対象です
                </p>
              </div>
            </div>

            <CampaignHeroIllustration />
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-14 sm:space-y-16">
        {/* Social value */}
        <section className="bg-blue-50 rounded-2xl border border-blue-100 px-4 py-4 sm:p-8">
          <h2 className="text-base sm:text-xl font-bold text-gray-900 mb-1.5 sm:mb-3 whitespace-nowrap">
            あなたの声が、次の選択を支えます
          </h2>
          <p className="text-gray-700 text-xs sm:text-base leading-relaxed">
            パンフレットや学校の公式サイトだけでは分からない、通学のリアルや学校選びの理由。あなたの口コミは、これから通信制高校を検討する生徒や保護者にとって、大切な判断材料になります。
          </p>
        </section>

        {/* Benefits */}
        <section>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 text-center whitespace-nowrap">
            {rewardLabel}で、こんな夏の楽しみに
          </h2>
          <p className="text-sm text-gray-600 text-center mb-8">
            全国のコンビニなど、QUOカードPayが使えるお店でご利用いただけます
          </p>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {CAMPAIGN_BENEFITS.map((item) => (
              <div
                key={item.label}
                className="bg-white rounded-xl sm:rounded-2xl border border-amber-100 px-2 py-4 sm:p-7 text-center shadow-sm flex flex-col items-center"
              >
                <span className="text-3xl sm:text-5xl mb-2 sm:mb-4 block" aria-hidden>
                  {item.emoji}
                </span>
                <p className="font-bold text-gray-900 text-xs sm:text-lg mb-0.5 sm:mb-1 flex-1 flex items-center">{item.label}</p>
                <p className="text-[10px] sm:text-sm text-gray-500 mt-auto">目安：{item.example}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">参加の流れ</h2>
          <ol className="space-y-2 sm:space-y-4">
            {CAMPAIGN_STEPS.map((step) => (
              <li
                key={step.step}
                className="flex gap-3 sm:gap-6 bg-white rounded-xl sm:rounded-2xl border border-gray-100 px-4 py-3 sm:p-6 shadow-sm items-start"
              >
                <span
                  className="flex h-7 w-7 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white font-black text-sm sm:text-lg mt-0.5"
                  aria-hidden
                >
                  {step.step}
                </span>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm sm:text-lg">{step.title}</h3>
                  <p className="text-xs sm:text-base text-gray-600 leading-snug sm:leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-gray-500 text-center">
            ※特典は投稿直後ではなく、内容の承認後にメールでお届けします
          </p>
        </section>

        {/* Target summary */}
        <section className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 px-4 py-3 sm:p-8 shadow-sm">
          <h2 className="text-base sm:text-xl font-bold text-gray-900 mb-2 sm:mb-4 whitespace-nowrap">こんな方にご参加ください</h2>
          <ul className="space-y-1 sm:space-y-3 text-gray-700 text-xs sm:text-base">
            <li className="flex gap-1.5 sm:gap-2">
              <span className="text-orange-500 font-bold shrink-0">✓</span>
              <span>現在、通信制高校に通っている生徒の方</span>
            </li>
            <li className="flex gap-1.5 sm:gap-2">
              <span className="text-orange-500 font-bold shrink-0">✓</span>
              <span>お子様が通信制高校に通っている保護者の方</span>
            </li>
            <li className="flex gap-1.5 sm:gap-2">
              <span className="text-orange-500 font-bold shrink-0">✓</span>
              <span>
                2020年以降に通信制高校へ入学し、すでに卒業された方（保護者の方も対象）
              </span>
            </li>
          </ul>
          <p className="mt-2 sm:mt-4 text-[10px] sm:text-xs text-gray-500">
            メールアドレスのご登録が必要です。お1人様1回のみご参加いただけます。
          </p>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-6">よくある質問</h2>
          <CampaignFaqAccordion />
        </section>

        {/* Eligibility / terms */}
        <section className="bg-amber-50/80 rounded-xl sm:rounded-2xl border border-amber-200 px-4 py-3 sm:p-8">
          <CampaignEligibilitySection />
        </section>

        {/* Bottom CTA */}
        <section className="text-center pb-4">
          <Link
            href={appPath('/survey')}
            className="inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-black text-lg px-10 py-4 rounded-2xl shadow-lg transition-colors w-full sm:w-auto"
          >
            口コミに回答して{rewardLabel}を受け取る
          </Link>
          <p className="mt-3 text-xs text-gray-500">
            所要時間の目安：約5分
          </p>
        </section>
      </div>
    </div>
  );
}

function CampaignHeroIllustration() {
  return (
    <div
      className="relative mx-auto h-36 w-full max-w-[280px] sm:h-72 sm:max-w-[360px] lg:h-80 lg:max-w-[420px]"
      aria-label="QUOカードPay、アイスコーヒー、アイス、ジュースのイラスト"
    >
      <div
        className="absolute inset-x-5 bottom-3 h-10 sm:bottom-5 sm:h-20 rounded-[999px] bg-orange-200/30 blur-xl"
        aria-hidden
      />
      <div
        className="absolute right-2 top-0 h-10 w-10 sm:right-3 sm:top-1 sm:h-20 sm:w-20 rounded-full bg-yellow-200/60 ring-1 ring-white/80"
        aria-hidden
      />
      <GiftCardIcon />
      <HeroIceCreamIcon />
      <HeroIcedCoffeeIcon />
      <HeroJuiceIcon />
    </div>
  );
}

function GiftCardIcon() {
  return (
    <svg
      className="absolute left-3 top-4 h-16 w-24 -rotate-6 drop-shadow-xl sm:left-5 sm:top-10 sm:h-28 sm:w-40 lg:left-2 lg:top-14 lg:h-32 lg:w-44"
      viewBox="0 0 176 128"
      fill="none"
      aria-hidden
    >
      <rect x="10" y="20" width="148" height="86" rx="18" fill="#FFFFFF" />
      <rect x="10" y="20" width="148" height="86" rx="18" stroke="#FFE0B8" strokeWidth="3" />
      <path d="M30 49h72" stroke="#FF8A3D" strokeWidth="8" strokeLinecap="round" />
      <path d="M30 70h48" stroke="#FFD19B" strokeWidth="7" strokeLinecap="round" />
      <rect x="112" y="48" width="26" height="22" rx="6" fill="#FFB45C" />
      <path d="M125 44v30" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
      <path d="M112 59h26" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
      <path d="M119 45c-7-9-18 4-7 10" stroke="#FF7A59" strokeWidth="4" strokeLinecap="round" />
      <path d="M131 45c7-9 18 4 7 10" stroke="#FF7A59" strokeWidth="4" strokeLinecap="round" />
      <text x="30" y="92" fill="#EA580C" fontSize="18" fontWeight="800">
        QUO Pay
      </text>
    </svg>
  );
}

function HeroIceCreamIcon() {
  return (
    <svg
      className="absolute bottom-2 left-0 h-20 w-16 rotate-[-9deg] drop-shadow-xl sm:bottom-5 sm:h-36 sm:w-32"
      viewBox="0 0 96 112"
      fill="none"
      aria-hidden
    >
      <path d="M38.4 98.4 19.2 51.6h57.6L57.6 98.4c-3.6 8.6-15.6 8.6-19.2 0Z" fill="#F6B26B" />
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

function HeroIcedCoffeeIcon() {
  return (
    <svg
      className="absolute bottom-0 left-1/2 z-10 h-28 w-20 -translate-x-1/2 drop-shadow-2xl sm:h-52 sm:w-40 lg:h-56 lg:w-44"
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

function HeroJuiceIcon() {
  return (
    <svg
      className="absolute bottom-2 right-0 h-20 w-16 rotate-[8deg] drop-shadow-xl sm:bottom-5 sm:right-1 sm:h-40 sm:w-32"
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
