import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { appPath } from '@/lib/base-path';
import { getAppBaseUrl } from '@/lib/env-check';
import {
  CONTEST_AWARDS,
  MY_STORY_AWARD_APPLY_PATH,
  MY_STORY_AWARD_DEADLINE_LABEL,
} from '@/lib/contest/copy';

const appBaseUrl = getAppBaseUrl();

export const metadata: Metadata = {
  title: '通信制高校 MY STORY AWARD｜体験談コンテスト',
  description:
    '通信制高校の在校生・卒業生向け体験談コンテスト。テーマは「私らしい高校生活」。応募後、口コミが承認されるとQUOカードPay 200円分をお届けします。',
  alternates: { canonical: `${appBaseUrl}/my-story-award` },
  openGraph: {
    title: '通信制高校 MY STORY AWARD',
    description: '「私らしい高校生活」をテーマに、あなたのストーリーを募集します。',
    type: 'website',
    url: `${appBaseUrl}/my-story-award`,
  },
};

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[32px] border-4 border-sky-100 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-black text-sky-900">{title}</h2>
      <div className="mt-3 text-slate-700 leading-relaxed">{children}</div>
    </section>
  );
}

export default function MyStoryAwardPage() {
  return (
    <div className="min-h-screen bg-[#eefdff] bg-[linear-gradient(rgba(14,165,233,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.12)_1px,transparent_1px)] bg-[size:22px_22px]">
      <main>
        <section className="relative overflow-hidden px-4 py-10 sm:py-14">
          <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_520px]">
            <div>
              <p className="inline-flex rounded-full bg-yellow-300 px-4 py-2 text-sm font-black text-slate-950 shadow-sm">
                通信制高校の体験談コンテスト
              </p>
              <h1 className="mt-5 text-4xl font-black leading-tight text-sky-950 sm:text-6xl">
                あなたの
                <br />
                「私らしい高校生活」を
                <br />
                聞かせてください
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-bold leading-relaxed text-slate-700">
                通信制高校の在校生・卒業生が対象です。探究活動、アルバイト、趣味、資格取得、学び直し。あなたが過ごしてきた時間が、これから学校を選ぶ人のヒントになります。
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-sky-900 shadow-sm">
                  締切 {MY_STORY_AWARD_DEADLINE_LABEL}
                </span>
                <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-sky-900 shadow-sm">
                  途中保存できます
                </span>
              </div>
              <Link
                href={appPath(MY_STORY_AWARD_APPLY_PATH)}
                className="mt-8 inline-flex rounded-full bg-yellow-300 px-8 py-4 text-lg font-black text-slate-950 shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
              >
                応募をはじめる
              </Link>
            </div>

            <div className="rounded-[36px] border-4 border-white bg-white p-3 shadow-2xl">
              <Image
                src="/my-story-award-main.jpg"
                alt="通信制高校の体験談コンテスト MY STORY AWARD 作品募集"
                width={602}
                height={257}
                priority
                className="h-auto w-full rounded-[28px]"
              />
            </div>
          </div>
        </section>

        <section className="px-4 pb-12">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[30px] bg-white p-6 shadow-sm ring-4 ring-sky-100">
                <h2 className="text-xl font-black text-sky-900">応募できる人</h2>
                <p className="mt-3 text-slate-700">通信制高校の在校生・卒業生ご本人が応募できます。保護者同意のチェックはありません。</p>
              </div>
              <div className="rounded-[30px] bg-white p-6 shadow-sm ring-4 ring-sky-100">
                <h2 className="text-xl font-black text-sky-900">書くこと</h2>
                <p className="mt-3 text-slate-700">入学前の気持ち、入学後の変化、頑張ったこと、学んだこと。文章は画面ごとに少しずつ書けます。</p>
              </div>
              <div className="rounded-[30px] bg-yellow-100 p-6 shadow-sm ring-4 ring-yellow-200">
                <h2 className="text-xl font-black text-slate-950">もらえるもの</h2>
                <p className="mt-3 text-slate-800">口コミが承認されると、QUOカードPay 200円分を1回お届けします。</p>
              </div>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              {CONTEST_AWARDS.map((award) => (
                <div key={award.name} className="rounded-[34px] border-4 border-yellow-200 bg-white p-6 text-center shadow-sm">
                  <p className="text-lg font-black text-sky-900">{award.name}</p>
                  <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">{award.amount}</p>
                  <p className="mt-2 text-sm font-bold text-slate-500">{award.count}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <SectionCard title="審査で見ること">
                <ul className="space-y-2 font-bold">
                  <li>具体的に書けているか</li>
                  <li>自分らしい学びがあるか</li>
                  <li>入学の前と後で変化があるか</li>
                </ul>
                <details className="mt-4 rounded-2xl bg-sky-50 p-4 text-sm">
                  <summary className="cursor-pointer font-black text-sky-900">点数の内訳を見る</summary>
                  <p className="mt-2">具体性30点、学びの独自性20点、成長・変化50点です。</p>
                </details>
              </SectionCard>

              <SectionCard title="作品の使われ方">
                <p>
                  応募作品は、通信制高校の多様な学び方や生き方を伝えるコンテンツとして活用する予定です。作品は自動では公開されません。応募画面で本人の同意を確認し、必要に応じて編集します。
                </p>
              </SectionCard>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <SectionCard title="スケジュール">
                <p>募集締切は {MY_STORY_AWARD_DEADLINE_LABEL} です。結果通知とオンライン表彰式は、決定し次第メールでお知らせします。</p>
              </SectionCard>

              <SectionCard title="応募規約の要点">
                <p>他サイトからのコピーや、個人を特定する表現、誹謗中傷は避けてください。投稿後の取り下げは、締切前にお問い合わせください。</p>
                <details className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm">
                  <summary className="cursor-pointer font-black text-slate-900">くわしく読む</summary>
                  <p className="mt-2">主催は株式会社キャリアエッセンスです。お問い合わせは info@careeressence.co.jp までお願いします。</p>
                </details>
              </SectionCard>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
