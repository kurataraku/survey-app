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

const writingExamples = [
  '入学前に不安だったことと、実際に入って感じたこと',
  '登校する日や、自宅で過ごす日のこと',
  '先生や友達との、印象に残っているやり取り',
  '勉強と、趣味やアルバイトとの両立',
  '自分に合っていたこと、少し困ったこと',
];

const selectionCriteria = [
  { name: '具体性（30点）', description: '本人の経験や日常が具体的に伝わるか' },
  { name: '学びの独自性（20点）', description: 'その人ならではの学びが伝わるか' },
  { name: '成長・変化（50点）', description: '入学前と入学後の変化が伝わるか' },
];

function Section({
  id,
  title,
  children,
  className = '',
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`border-t border-sky-100 py-12 sm:py-16 ${className}`}>
      <h2 className="text-2xl font-black leading-tight text-sky-950 sm:text-3xl">{title}</h2>
      <div className="mt-6 text-base leading-[1.8] text-slate-700">{children}</div>
    </section>
  );
}

export default function MyStoryAwardPage() {
  return (
    <div className="min-h-screen bg-white">
      <main>
        <section className="bg-sky-50 px-4 pb-12 pt-5 sm:px-5 sm:pb-16 sm:pt-8">
          <div className="mx-auto max-w-[960px]">
            <h1 className="sr-only">通信制高校 MY STORY AWARD 私らしい高校生活</h1>
            <div className="bg-white shadow-lg">
              <Image
                src="/my-story-award-main.jpg"
                alt="通信制高校の体験談コンテスト MY STORY AWARD。募集テーマは私らしい高校生活。在校生・卒業生が対象。最優秀賞はAmazonギフトカード10,000円分。"
                width={602}
                height={295}
                priority
                sizes="(min-width: 1000px) 960px, calc(100vw - 32px)"
                className="block h-auto w-full object-contain"
              />
            </div>

            <div className="mx-auto mt-9 max-w-3xl">
              <h2 className="text-2xl font-black leading-tight text-sky-950 sm:text-4xl">
                特別なエピソードじゃなくて、大丈夫。
              </h2>
              <p className="mt-5 text-base leading-[1.85] text-slate-700 sm:text-lg">
                学校でのこと、家で過ごす時間、アルバイトや趣味のこと。通信制高校で過ごした日々を、あなたの言葉で教えてください。楽しかったことも、戸惑ったことも。あなたの経験が、これから学校を選ぶ人の参考になります。
              </p>

              <dl className="mt-7 divide-y divide-sky-100 border-y border-sky-100 text-base">
                <div className="grid gap-1 py-3 sm:grid-cols-[140px_1fr]">
                  <dt className="font-bold text-sky-950">対象</dt>
                  <dd className="text-slate-700">通信制高校の在校生・卒業生</dd>
                </div>
                <div className="grid gap-1 py-3 sm:grid-cols-[140px_1fr]">
                  <dt className="font-bold text-sky-950">応募締切</dt>
                  <dd className="text-slate-700">{MY_STORY_AWARD_DEADLINE_LABEL}</dd>
                </div>
                <div className="grid gap-1 py-3 sm:grid-cols-[140px_1fr]">
                  <dt className="font-bold text-sky-950">体験談の文字数</dt>
                  <dd className="text-slate-700">
                    タイトル20字以内。本文は設問ごとに20字以上または50字以上（目安100〜300字）
                  </dd>
                </div>
              </dl>

              <Link
                href={appPath(MY_STORY_AWARD_APPLY_PATH)}
                className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-yellow-300 px-8 py-4 text-lg font-black text-slate-950 shadow-md transition hover:bg-yellow-200 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-sky-500 sm:w-auto"
              >
                体験談を書いて応募する
              </Link>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                指定された質問に文章で回答します。体験談と学校についての回答を、同じフォームで送信します。
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[960px] px-4 sm:px-5">
          <Section title="何を書けばいい？ たとえば、こんなこと。">
            <p>テーマを考えるための例です。実際の応募作品や受賞作品の引用ではありません。</p>
            <ul className="mt-5 space-y-3 border-l-4 border-sky-300 pl-5">
              {writingExamples.map((example) => (
                <li key={example}>{example}</li>
              ))}
            </ul>
            <p className="mt-5 font-bold text-sky-950">
              全部について書く必要はありません。書きやすいことを選んでください。
            </p>
          </Section>

          <Section title="応募の流れ" className="bg-sky-50/60">
            <ol className="grid gap-8 sm:grid-cols-3">
              <li>
                <p className="text-sm font-black text-sky-600">STEP 1</p>
                <h3 className="mt-2 text-lg font-black text-sky-950">あなたと体験談について入力</h3>
                <p className="mt-2">在籍状況、公開用の名前、連絡先と、通信制高校での経験を入力します。</p>
              </li>
              <li>
                <p className="text-sm font-black text-sky-600">STEP 2</p>
                <h3 className="mt-2 text-lg font-black text-sky-950">学校について回答</h3>
                <p className="mt-2">学校名、通い方、評価、良かった点や気になる点に回答します。</p>
              </li>
              <li>
                <p className="text-sm font-black text-sky-600">STEP 3</p>
                <h3 className="mt-2 text-lg font-black text-sky-950">確認して応募</h3>
                <p className="mt-2">作品の利用について確認・同意し、体験談と学校についての回答を一緒に送信します。</p>
              </li>
            </ol>
            <div className="mt-8 border-t border-sky-200 pt-5">
              <p className="font-bold text-sky-950">会員登録はありません。入力内容は途中保存できます。</p>
              <p className="mt-2">
                今の端末で続きを書けます。メールで再開リンクを受け取ると、別の端末でも続きから入力できます。
              </p>
            </div>
          </Section>

          <Section title="賞・応募特典">
            <h3 className="text-xl font-black text-sky-950">受賞作品の賞</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {CONTEST_AWARDS.map((award) => (
                <div key={award.name} className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm">
                  <p className="font-black text-sky-950">{award.name}</p>
                  <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{award.amount}</p>
                  <p className="mt-1 text-sm font-bold text-slate-600">Amazonギフトカード／{award.count}</p>
                </div>
              ))}
            </div>

            <div className="mt-9 border-l-4 border-sky-300 bg-sky-50 px-5 py-6 sm:px-7">
              <h3 className="text-xl font-black text-sky-950">学校についての回答が承認・掲載された方への特典</h3>
              <p className="mt-3 font-black text-slate-950">QUOカードPay 200円分／1回</p>
              <p className="mt-3">
                コンテスト応募と同時に送信する学校についての回答が、掲載基準を満たして承認・公開された場合に対象となります。コンテストの受賞有無とは別の特典です。重複投稿と判定された場合は対象外です。
              </p>
              <p className="mt-3">
                承認後、後日、登録したメールアドレス宛に受け取りの案内をお送りします。応募しただけで全員に付与される特典ではありません。
              </p>
            </div>
          </Section>

          <Section title="応募する前に、知っておいてほしいこと">
            <dl className="divide-y divide-sky-100 border-y border-sky-100">
              <div className="py-5">
                <dt className="font-black text-sky-950">公開時の名前</dt>
                <dd className="mt-1">
                  応募フォームで「サイトに出すときの名前」を入力します。例として、ニックネームや「卒業生A」のような名前を使用できます。
                </dd>
              </div>
              <div className="py-5">
                <dt className="font-black text-sky-950">学校についての回答</dt>
                <dd className="mt-1">
                  学校名とあわせて審査し、承認された回答は、学校を選ぶ人の参考になる口コミとしてサイトに公開されます。
                </dd>
              </div>
              <div className="py-5">
                <dt className="font-black text-sky-950">応募作品の使われ方</dt>
                <dd className="mt-1">
                  通信制高校の多様な学び方や生き方を伝える広報コンテンツとして活用する予定です。作品は応募と同時に自動公開されず、利用への同意を確認したうえで、内容を確認し必要に応じて編集します。
                </dd>
              </div>
              <div className="py-5">
                <dt className="font-black text-sky-950">個人を特定できる情報</dt>
                <dd className="mt-1">
                  本文には、氏名や連絡先など、本人やほかの人を特定できる情報を書かないでください。誹謗中傷や、他サイトからコピーした文章も応募できません。
                </dd>
              </div>
              <div className="py-5">
                <dt className="font-black text-sky-950">公開前の確認</dt>
                <dd className="mt-1">
                  作品の公開前に、応募者へ個別に掲載内容を確認する仕組みは設けていません。
                </dd>
              </div>
            </dl>
            <a href="#entry-guidelines" className="mt-5 inline-flex font-bold text-sky-700 underline underline-offset-4">
              募集要項の詳細を見る
            </a>
          </Section>

          <Section title="選考について">
            <p>応募作品は、事務局が次の3項目を基準に100点満点で審査します。</p>
            <ul className="mt-5 divide-y divide-sky-100 border-y border-sky-100">
              {selectionCriteria.map((criterion) => (
                <li key={criterion.name} className="py-4">
                  <p className="font-black text-sky-950">{criterion.name}</p>
                  <p className="mt-1">{criterion.description}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="日程">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-sm font-bold text-sky-700">応募締切</p>
                <p className="mt-1 text-xl font-black text-sky-950">{MY_STORY_AWARD_DEADLINE_LABEL}</p>
              </div>
              <div>
                <p className="text-sm font-bold text-sky-700">結果通知・オンライン表彰式</p>
                <p className="mt-1 text-xl font-black text-sky-950">日程未定</p>
                <p className="mt-2">決定し次第、登録したメールアドレスへお知らせします。</p>
              </div>
            </div>
          </Section>

          <Section id="entry-guidelines" title="募集要項">
            <details className="group border-y border-sky-100">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 font-black text-sky-950">
                募集要項を詳しく読む
                <span aria-hidden="true" className="text-2xl font-normal group-open:rotate-45">＋</span>
              </summary>
              <div className="space-y-5 border-t border-sky-100 pb-6 pt-5">
                <div>
                  <h3 className="font-black text-sky-950">応募資格</h3>
                  <p>通信制高校に在籍している方、または卒業した方ご本人。</p>
                </div>
                <div>
                  <h3 className="font-black text-sky-950">応募方法</h3>
                  <p>
                    応募フォームから、体験談と学校についての回答を一緒に送信してください。会員登録はありません。参加費は無料です。
                  </p>
                </div>
                <div>
                  <h3 className="font-black text-sky-950">体験談の形式・文字数</h3>
                  <p>
                    作品タイトルは20字以内。頑張ったことは20字以上（目安100字）、入学前・入学後・学びや変化は各50字以上（目安各300字）、在校生の今後の目標または卒業生の現在の生活は20字以上（目安200字）です。学校についての自由記述にも、評価内容に応じて最低文字数があります。
                  </p>
                </div>
                <div>
                  <h3 className="font-black text-sky-950">応募締切</h3>
                  <p>{MY_STORY_AWARD_DEADLINE_LABEL}</p>
                </div>
                <div>
                  <h3 className="font-black text-sky-950">応募内容の取り扱い</h3>
                  <p>
                    学校についての回答は確認・承認後に口コミとして公開されます。応募作品は、利用への同意を確認したうえで、通信制高校の多様な学び方や生き方を伝える広報コンテンツとして活用する予定です。
                  </p>
                </div>
                <div>
                  <h3 className="font-black text-sky-950">応募の取り下げ</h3>
                  <p>締切前に、下記のお問い合わせ先へご連絡ください。</p>
                </div>
                <div>
                  <h3 className="font-black text-sky-950">主催・お問い合わせ</h3>
                  <p>株式会社キャリアエッセンス</p>
                  <p>
                    <a href="mailto:info@careeressence.co.jp" className="text-sky-700 underline underline-offset-4">
                      info@careeressence.co.jp
                    </a>
                  </p>
                </div>
              </div>
            </details>
          </Section>

          <section className="border-t border-sky-100 py-14 text-center sm:py-20">
            <h2 className="text-2xl font-black leading-tight text-sky-950 sm:text-3xl">
              あなたの経験を、これから学校を選ぶ人へ。
            </h2>
            <Link
              href={appPath(MY_STORY_AWARD_APPLY_PATH)}
              className="mt-7 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-yellow-300 px-8 py-4 text-lg font-black text-slate-950 shadow-md transition hover:bg-yellow-200 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-sky-500 sm:w-auto"
            >
              体験談を書いて応募する
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}
