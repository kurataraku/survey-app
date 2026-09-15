import type { Metadata } from 'next';
import Link from 'next/link';
import StructuredData from '@/components/StructuredData';
import { appPath } from '@/lib/base-path';
import { getAppBaseUrl } from '@/lib/env-check';
import {
  ATTENDANCE_SATISFACTION_RELEASE,
} from '@/lib/press-releases';
import PressSatisfactionValleyChart from '@/components/PressSatisfactionValleyChart';
import PressMonthlyMetricCompareChart from '@/components/PressMonthlyMetricCompareChart';
import PressOnlineVsWeeklyChart from '@/components/PressOnlineVsWeeklyChart';
import PressMonthlyFreeTextCompareChart from '@/components/PressMonthlyFreeTextCompareChart';

const appBaseUrl = getAppBaseUrl();
const release = ATTENDANCE_SATISFACTION_RELEASE;
const canonical = `${appBaseUrl}/press-releases/${release.slug}`;
const fullTitle = `${release.title}｜通信制高校リアルレビュー`;

export const metadata: Metadata = {
  title: release.shortTitle,
  description: release.description,
  alternates: { canonical },
  openGraph: {
    title: fullTitle,
    description: release.description,
    type: 'article',
    url: canonical,
    publishedTime: `${release.publishedAt}T00:00:00+09:00`,
    images: [{ url: `${appBaseUrl}/logo-service.png` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: fullTitle,
    description: release.description,
    images: [`${appBaseUrl}/logo-service.png`],
  },
};

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'NewsArticle',
      '@id': `${canonical}#article`,
      headline: release.title,
      description: release.description,
      datePublished: release.publishedAt,
      dateModified: release.publishedAt,
      mainEntityOfPage: canonical,
      inLanguage: 'ja',
      image: `${appBaseUrl}/logo-service.png`,
      author: {
        '@type': 'Organization',
        name: '株式会社キャリアエッセンス',
        url: 'https://careeressence.jp/',
      },
      publisher: {
        '@type': 'Organization',
        name: '通信制高校リアルレビュー',
        legalName: '株式会社キャリアエッセンス',
        url: appBaseUrl,
        logo: {
          '@type': 'ImageObject',
          url: `${appBaseUrl}/logo-service.png`,
        },
      },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'ホーム',
          item: appBaseUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'プレスリリース・調査発表',
          item: `${appBaseUrl}/press-releases`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: release.shortTitle,
          item: canonical,
        },
      ],
    },
  ],
};

const METHOD_ROWS: [string, string][] = [
  ['調査対象', '通信制高校リアルレビューで公開状態にある口コミ851件'],
  ['対象校', '204校'],
  ['有効回答', '849件'],
  ['重複処理', '学校名・良かった点・改善点が完全一致した三重登録1組から重複2件を除外'],
  ['収集期間', '2026年1月9日〜9月14日'],
  ['回答者', '本人486件、保護者363件'],
  ['在籍状況', '在籍中210件、卒業604件、以前在籍35件'],
  ['集計日', '2026年9月15日'],
  ['収集方法', '自社運営サイトへの投稿及び外部調査サービスの利用'],
  [
    '高満足層',
    '総合満足度（5段階）で4または5を選んだ回答者。本調査では「十分に満足している側」として扱う',
  ],
  [
    '低満足層',
    '総合満足度（5段階）で1〜3を選んだ回答者。明確な不満（1〜2）に加え、中立寄りの3も含め、「高く満足しているとは言えない側」として扱う',
  ],
  ['高満足率', '各群における高満足層の割合（％）'],
  [
    '個別項目の高評価',
    '心身サポート・進路・雰囲気などの個別評価で4または5を選んだ割合。総合満足度の層分けとは別指標',
  ],
  [
    '学費の低評価',
    '学費の納得感で1または2を選んだ割合。強い不満に絞った集計のため、低満足層（1〜3）とは切り方が異なる',
  ],
  ['自由記述分析', '「改善してほしい点／合わない点」に含まれる関連テーマの言及を分類（複数分類を含む）'],
];

export default function AttendanceFrequencySatisfactionReleasePage() {
  return (
    <>
      <StructuredData data={structuredData} />
      <article className="min-h-screen bg-[var(--press-page)]">
        <header className="border-b border-slate-300 bg-white">
          <div className="mx-auto max-w-[46rem] px-4 py-10 sm:px-6 sm:py-12">
            <nav className="press-doc__meta mb-6" aria-label="パンくず">
              <Link href={appPath('/')} className="no-underline hover:underline">
                ホーム
              </Link>
              <span className="mx-2" aria-hidden>
                ／
              </span>
              <Link
                href={appPath('/press-releases')}
                className="no-underline hover:underline"
              >
                プレスリリース
              </Link>
            </nav>

            <p className="press-doc__meta">
              株式会社キャリアエッセンス
              <span className="mx-2" aria-hidden>
                ｜
              </span>
              <time dateTime={release.publishedAt}>{release.displayDate}</time>
              <span className="mx-2" aria-hidden>
                ｜
              </span>
              {release.category}
            </p>

            <h1 className="press-doc__serif mt-5 text-[1.75rem] font-bold leading-[1.45] tracking-tight text-slate-950 sm:text-[2rem]">
              通信制高校に「満足度の谷」
            </h1>
            <p className="mt-4 text-lg font-semibold leading-8 text-slate-800 sm:text-xl">
              「月1〜数回通学」の高満足率は79.2％、ほぼオンライン・週5通学はともに94.3％
            </p>
            <p className="mt-6 border-t border-neutral-300 pt-5 text-[15px] leading-8 text-neutral-700">
              公開口コミ851件をクロス分析。中間的な通学層では、学校との接点や進路支援への期待と実際の支援にギャップがある可能性が見えてきました。
            </p>
          </div>
        </header>

        <div className="press-doc__body mx-auto max-w-[46rem] px-4 py-10 sm:px-6 sm:py-12">
          <section className="border border-slate-300 border-t-4 border-t-[var(--press-navy)] bg-white px-5 py-5 sm:px-6">
            <h2 className="press-doc__serif text-base font-bold text-neutral-950">
              調査結果の要点
            </h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px] leading-8 text-neutral-800">
              <li>
                「月1〜数回」層の高満足率（高満足層の割合）は<strong>79.2％</strong>で、通学頻度別で最低
              </li>
              <li>
                同層では、心身サポート・進路サポート・雰囲気の高評価がすべて6割未満
              </li>
              <li>
                ほぼオンライン層と週5通学層は、評価の中身が異なるものの高満足率はともに
                <strong>94.3％</strong>
              </li>
            </ol>
          </section>

          <section className="mt-10" aria-labelledby="definitions-heading">
            <h2 id="definitions-heading" className="press-doc__serif text-base font-bold text-neutral-950">
              本調査での満足度の分け方
            </h2>
            <div className="mt-4 border-y border-slate-300 bg-white px-4 py-4 text-[15px] leading-7 text-neutral-800 sm:px-5">
              <p>
                総合満足度（5段階）を、次の2群に分けて集計しました。
              </p>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                <li>
                  <strong>高満足層</strong>：評価4・5
                </li>
                <li>
                  <strong>低満足層</strong>：評価1〜3
                </li>
              </ul>
              <p className="mt-3 text-sm text-slate-600">
                「十分に満足している（4・5）か」を比較するための本調査上の区分です。本文の「高満足率」は、高満足層が各群に占める割合を指します。個別項目の高評価は4・5、学費の低評価は1・2です。
              </p>
            </div>
          </section>

          <section className="mt-10">
            <p>
              通信制高校の口コミサイト「通信制高校リアルレビュー」を運営する株式会社キャリアエッセンスは、204校に寄せられた公開口コミ851件を対象に、実際の通学頻度と学校評価の関係を分析しました。
            </p>
            <p>
              重複登録2件を除いた有効回答849件を集計したところ、高満足層の割合は、「ほぼオンライン／自宅」層と「週5通学」層で、ともに94.3％でした。
            </p>
            <p>
              一方、「月1〜数回」層では79.2％に低下。他の通学頻度より11〜15ポイント低く、高満足率に「谷」が生じていることが分かりました。
            </p>
          </section>

          <section className="mt-12" aria-labelledby="frequency-heading">
            <h2 id="frequency-heading" className="press-doc__h2">
              1. 通学頻度別の高満足率
            </h2>
            <p className="!mt-4 text-sm leading-7 text-neutral-600">
              高満足率＝各通学頻度における高満足層（総合満足度4〜5）の割合です。
            </p>

            <PressSatisfactionValleyChart />

            <p>
              「通学日数が少ないほど負担も少ない」「通学日数が多いほどサポートを受けやすい」という単純な関係ではなく、完全なオンライン学習と定期通学の中間にあたる「月1〜数回」層で、高満足率が低くなる結果となりました。言い換えると、同層では低満足層（総合満足度1〜3）の割合が他より高くなっています。
            </p>
          </section>

          <section className="mt-12" aria-labelledby="monthly-ratings-heading">
            <h2 id="monthly-ratings-heading" className="press-doc__h2">
              2. 月1〜数回層では、サポート・進路・雰囲気の高評価が6割未満
            </h2>
            <p>
              総合満足度とは別に、各項目を5段階で評価してもらい、4または5を選んだ人を「高評価」として集計しました。月1〜数回層だけでなく、5つの通学頻度すべてで同じ3項目を比較すると、次のようになります。
            </p>

            <PressMonthlyMetricCompareChart />

            <p>
              心身サポート、雰囲気の適合、進路サポートは、いずれも月1〜数回層が5区分中でもっとも低く、57.4％、58.4％、55.4％にとどまりました。
            </p>
            <p>
              単位取得や学び方の柔軟性には満足している一方、学校とのつながりや進路支援には満足しきれていない、という評価構造が見られます。総合満足度の谷と重なる形で、個別項目の高評価も同層で低く出ています。
            </p>
          </section>

          <section className="mt-12" aria-labelledby="comparison-heading">
            <h2 id="comparison-heading" className="press-doc__h2">
              3. 同じ高満足率94.3％でも、ほぼオンライン層と週5通学層では中身が異なる
            </h2>
            <p>
              両者は高満足率が同じですが、個別評価には大きな違いがありました。
            </p>

            <PressOnlineVsWeeklyChart />

            <p>
              ほぼオンライン層は、サポートや進路支援の高評価が週5通学層より低い一方、学費の低評価（1〜2）は少ない結果でした。週5通学層はサポートや進路支援を高く評価していますが、学費の低評価はほぼオンライン層の約2.5倍です。
            </p>
            <p>
              同じ高満足率でも、ほぼオンライン層は自由度や費用面、週5通学層は対面サポートを評価している可能性があります。
            </p>
          </section>

          <section className="mt-12" aria-labelledby="hypotheses-heading">
            <h2 id="hypotheses-heading" className="press-doc__h2">
              4. なぜ「月1〜数回」に満足度の谷が生まれるのか
            </h2>
            <p className="border-l-4 border-[var(--press-gold)] bg-amber-50 px-4 py-3 text-sm leading-7 text-neutral-700">
              以下は、定量評価と自由記述から考えられる仮説です。本調査だけで因果関係を断定するものではありません。
            </p>

            <h3 className="press-doc__serif mt-9 text-lg font-bold text-neutral-950">
              仮説1　「期待していた支援」と「実際の支援」にギャップがある
            </h3>
            <p>
              ほぼオンライン層は、自主学習を前提として自由度を評価している可能性があります。一方、月1〜数回層は、普段は自宅で学習しながら、限られた登校日に先生から進捗確認や相談対応を受けることを期待している可能性があります。
            </p>

            <figure className="mt-6">
              <figcaption className="mb-3 text-sm font-semibold text-neutral-900">
                表4. 心身サポートが「高評価でない」（1〜3）人のうち、高満足層の割合
              </figcaption>
              <div className="overflow-x-auto border-y border-slate-400 bg-white">
                <table className="press-doc__table">
                  <thead>
                    <tr>
                      <th scope="col">通学頻度</th>
                      <th scope="col" className="num">
                        高満足層の割合
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>ほぼオンライン／自宅</td>
                      <td className="num">90.1％</td>
                    </tr>
                    <tr data-emphasis="true">
                      <td>月1〜数回</td>
                      <td className="num">58.1％</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs leading-5 text-neutral-500">
                心身サポートの評価が1〜3の回答者に限定し、その中で総合満足度が4〜5（高満足層）だった割合です。
              </p>
            </figure>

            <p>
              サポートを高く評価していない場合でも、ほぼオンライン層では9割が高満足層です。一方、月1〜数回層では約6割まで低下しています。
            </p>
            <p>
              ほぼオンライン層はサポートの手厚さより自由度を優先する一方、月1〜数回層は「登校機会があるから、その日に支援を受けられる」と期待している可能性があります。その期待に対して十分な支援が提供されない場合、総合満足度へ直接影響しやすいと考えられます。
            </p>

            <h3 className="press-doc__serif mt-10 text-lg font-bold text-neutral-950">
              仮説2　月数回の接点では、継続的に見守る支援が途切れやすい
            </h3>
            <p>
              月1〜数回の登校では、一度先生と話せても、次の接点まで数週間空く場合があります。その間に、レポートの遅れ、体調や学習状況の変化、進路関係の締め切りなどを学校側が把握しにくくなることが考えられます。
            </p>

            <PressMonthlyFreeTextCompareChart />

            <p>
              低満足層では進路42.9％・連絡28.6％、高満足層では16.3％・10.0％でした。同じ「改善してほしい点／合わない点」の欄でも、低満足層の方が進路や学校からの働きかけに触れる割合が高くなっています。
            </p>

            <blockquote className="press-doc__quote">
              「こちら側から学校に聞かないと、どのような具合でやっているのか、これからの進路を決めなくて大丈夫なのかが少し不安です」
            </blockquote>
            <blockquote className="press-doc__quote">
              「手厚いサポートがあるわけではないので、自分で考え、提出期限なども把握して進めていく必要があります」
            </blockquote>
            <blockquote className="press-doc__quote">
              「大学を受けることを以前から伝えていたにもかかわらず、共通テストの締め切りをギリギリに言われて焦りました」
            </blockquote>

            <p>
              週5通学では、正式な面談がなくても、先生が普段の様子から生徒の変化に気づく機会があります。オンライン学習を前提としたコースでは、チャットや学習システムを使った進捗管理が整備されている場合があります。
            </p>
            <p>
              月1〜数回層では、そのどちらも弱くなり、単発の相談機会はあっても、継続的に見守られる仕組みが不足しやすい可能性があります。
            </p>
          </section>

          <section className="mt-12" aria-labelledby="caution-heading">
            <h2 id="caution-heading" className="press-doc__h2">
              5. 通学頻度が原因ではなく、結果である可能性も
            </h2>
            <p>
              本調査で尋ねたのは、希望する通学頻度や学校が指定した登校日数ではなく、回答者の「実際の主な通学頻度」です。
            </p>
            <p>
              学校への不満や体調の変化、人間関係や学習面でのつまずきなどの結果として、登校頻度が月1〜数回まで減った可能性もあります。今回の結果は、月1〜数回の通学が満足度を下げることや、特定の通学頻度の優劣を証明するものではありません。
            </p>
          </section>

          <section className="mt-12" aria-labelledby="checklist-heading">
            <h2 id="checklist-heading" className="press-doc__h2">
              6. 入学前に確認したいのは「登校日数」だけではない
            </h2>
            <p>
              通信制高校を比較する際には、登校日数に加えて、次の点を確認することが重要です。
            </p>
            <ol className="mt-5 list-decimal space-y-2 pl-5 text-[15px] leading-8 text-neutral-800">
              <li>登校しない期間にも学校側から連絡があるか</li>
              <li>レポートの遅れを誰が把握するか</li>
              <li>生徒から相談しなくても面談が設定されるか</li>
              <li>進路情報や締め切りが家庭にも共有されるか</li>
              <li>オンラインで質問・相談できる時間があるか</li>
              <li>月数回の登校が個別支援や交流につながっているか</li>
              <li>通学コースの追加費用に何が含まれるか</li>
            </ol>
            <p>
              登校回数の少なさよりも、登校していない時間に学校とどのようにつながるかが、学校との相性を左右している可能性があります。
            </p>
          </section>

          <section className="mt-12" aria-labelledby="representative-heading">
            <h2 id="representative-heading" className="press-doc__h2">
              7. 代表コメント
            </h2>
            <div className="mt-6 border border-slate-300 border-t-4 border-t-[var(--press-navy)] bg-white px-5 py-6 sm:px-6">
              <p className="text-sm font-semibold text-neutral-950">
                株式会社キャリアエッセンス
              </p>
              <p className="mt-1 text-sm text-neutral-600">代表取締役　倉田 嵩之</p>
              <div className="mt-5 space-y-5 text-[15px] leading-8 text-neutral-800">
                <p>
                  通信制高校は、さまざまな事情や背景を持つ生徒を受け入れ、卒業後の進路や社会へ送り出す重要な教育機関です。多様な生徒の学びを止めないために、さまざまな通学頻度やコースを設け、受け入れの選択肢を広げようとする学校の姿勢は、非常に意義のあるものだと考えています。
                </p>
                <p>
                  一方で、選択肢を増やすことと、それぞれの生徒を継続的に支えられる体制を整えることは、必ずしも同じではありません。多種多様な生徒やコースを受け入れるための教職員数、情報共有、進捗管理、進路支援などの運営体制が追いつかないまま、学校経営や規模の拡大が進んでいるケースもあるのではないかと感じています。今回の調査だけで個別の学校について断定はできませんが、選べるコースがあることと、十分な支援を受けられることは分けて確認する必要があります。
                </p>
                <p>
                  私たちが保護者や生徒にインタビューする中では、全日制高校への不安や中学校卒業後の進路に対する焦りから、十分に比較検討しないまま通信制高校を決めてしまったという例も散見されます。まずは実際に学校へ足を運び、学校見学やオープンキャンパスなどに参加することが重要です。
                </p>
                <p>
                  ただし、パンフレット、公式サイト、学校説明会、オープンキャンパスには、当然ながら学校が伝えたい教育方針や強みが反映されます。そこで得た情報だけで判断するのではなく、実際に通うキャンパスの雰囲気、登校しない日の支援、レポートの進捗管理、相談方法、進路支援、費用総額などを具体的に確認し、「この学校がわが子や自分に本当に合っているか」を慎重に考えていただきたいと思います。
                </p>
                <p>
                  通信制高校リアルレビューでは、学校を一方的に評価するのではなく、公式情報だけでは見えにくい在校生・卒業生・保護者の体験を届けることで、一人ひとりが納得して学校を選べる環境をつくっていきます。
                </p>
              </div>
            </div>
          </section>

          <section className="mt-12" aria-labelledby="method-heading">
            <h2 id="method-heading" className="press-doc__h2">
              8. 調査概要
            </h2>
            <div className="mt-6 overflow-x-auto border-y border-slate-400 bg-white">
              <table className="press-doc__table">
                <tbody>
                  {METHOD_ROWS.map(([term, description]) => (
                    <tr key={term}>
                      <th
                        scope="row"
                        className="w-[8.5rem] whitespace-nowrap font-semibold text-neutral-800 sm:w-40"
                      >
                        {term}
                      </th>
                      <td className="text-neutral-700">{description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 border-l-4 border-[var(--press-blue)] bg-[var(--press-blue-soft)] px-4 py-4 text-sm leading-7 text-neutral-700">
              <p className="font-semibold text-neutral-900">調査結果を読む際の注意</p>
              <p className="mt-2">
                本調査は無作為抽出ではなく、全国の通信制高校在籍者・卒業者全体を代表するものではありません。通学頻度は希望や学校指定の頻度ではなく、回答者の実際の主な通学頻度です。学校、コース、キャンパス、回答者の状況などの違いを完全には調整していません。高満足層・低満足層は総合満足度に基づく本調査上の区分です。本調査は各通学頻度と満足度の関連を示すもので、因果関係を証明するものではありません。
              </p>
            </div>
          </section>

          <section className="mt-12" aria-labelledby="service-heading">
            <h2 id="service-heading" className="press-doc__h2">
              9. 通信制高校リアルレビューについて
            </h2>
            <p>
              通信制高校の在校生・卒業生・保護者による口コミを掲載する口コミメディアです。学校の雰囲気、通学頻度、学習の柔軟性、心身へのサポート、進路支援、学費など、公式情報だけでは分かりにくい実際の体験を可視化し、本人と保護者が納得して学校を選べるよう支援しています。
            </p>
            <p>
              <Link href={appPath('/')}>通信制高校リアルレビューを見る</Link>
            </p>
          </section>

          <section className="mt-12" aria-labelledby="company-heading">
            <h2 id="company-heading" className="press-doc__h2">
              10. 会社概要・お問い合わせ
            </h2>
            <div className="mt-6 overflow-x-auto border-y border-slate-400 bg-white">
              <table className="press-doc__table">
                <tbody>
                  <tr>
                    <th scope="row" className="w-[8.5rem] font-semibold sm:w-40">
                      会社名
                    </th>
                    <td>株式会社キャリアエッセンス</td>
                  </tr>
                  <tr>
                    <th scope="row" className="font-semibold">
                      代表者
                    </th>
                    <td>代表取締役　倉田 嵩之</td>
                  </tr>
                  <tr>
                    <th scope="row" className="font-semibold">
                      設立
                    </th>
                    <td>2021年4月1日</td>
                  </tr>
                  <tr>
                    <th scope="row" className="font-semibold">
                      所在地
                    </th>
                    <td>東京都中央区日本橋蛎殻町1-13-1　ユニゾ蛎殻町北島ビル</td>
                  </tr>
                  <tr>
                    <th scope="row" className="font-semibold">
                      会社URL
                    </th>
                    <td>
                      <a href="https://careeressence.jp/">https://careeressence.jp/</a>
                    </td>
                  </tr>
                  <tr>
                    <th scope="row" className="font-semibold">
                      お問い合わせ
                    </th>
                    <td>
                      <a href="mailto:info@careeressence.co.jp">
                        info@careeressence.co.jp
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <p className="mt-12 border-t border-neutral-800 pt-6">
            <Link href={appPath('/press-releases')}>プレスリリース一覧へ戻る</Link>
          </p>
        </div>
      </article>
    </>
  );
}
