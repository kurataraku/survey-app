import type { Metadata } from 'next';
import Link from 'next/link';
import StructuredData from '@/components/StructuredData';
import { appPath } from '@/lib/base-path';
import { getAppBaseUrl } from '@/lib/env-check';
import {
  ATTENDANCE_SATISFACTION_DATA,
  ATTENDANCE_SATISFACTION_RELEASE,
} from '@/lib/press-releases';

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

function DefinitionNote() {
  return (
    <p className="mt-3 text-sm leading-6 text-gray-500">
      高満足率は、総合満足度を5段階で尋ね、4または5を選んだ回答者の割合です。
    </p>
  );
}

export default function AttendanceFrequencySatisfactionReleasePage() {
  return (
    <>
      <StructuredData data={structuredData} />
      <article className="min-h-screen bg-gray-50">
        <header className="border-b border-blue-100 bg-white">
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <nav className="mb-7 text-sm text-gray-500" aria-label="パンくず">
              <Link href={appPath('/')} className="hover:text-blue-700">
                ホーム
              </Link>
              <span className="mx-2" aria-hidden>
                /
              </span>
              <Link href={appPath('/press-releases')} className="hover:text-blue-700">
                プレスリリース
              </Link>
            </nav>

            <div className="mb-5 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700">
                {release.category}
              </span>
              <time dateTime={release.publishedAt} className="text-gray-500">
                {release.displayDate}
              </time>
            </div>

            <h1 className="text-3xl font-bold leading-tight text-gray-950 sm:text-4xl">
              通信制高校に「満足度の谷」
            </h1>
            <p className="mt-5 text-xl font-bold leading-9 text-gray-800 sm:text-2xl">
              「月1〜数回通学」の高満足率は79.2％、
              ほぼオンライン・週5通学はともに94.3％
            </p>
            <p className="mt-6 border-l-4 border-blue-500 pl-4 leading-7 text-gray-600">
              公開口コミ851件をクロス分析。中間的な通学層では、学校との接点や
              進路支援への期待と実際の支援にギャップがある可能性が見えてきました。
            </p>
          </div>
        </header>

        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 sm:p-8">
            <p className="text-sm font-bold tracking-wide text-blue-800">調査結果の要点</p>
            <ul className="mt-4 space-y-3 leading-7 text-gray-800">
              <li>
                ・「月1〜数回」層の高満足率は
                <strong className="text-blue-900">79.2％</strong>で、通学頻度別で最低
              </li>
              <li>
                ・同層では、心身サポート・進路サポート・雰囲気の高評価がすべて6割未満
              </li>
              <li>
                ・ほぼオンライン層と週5通学層は、評価の中身が異なるものの高満足率は
                ともに<strong className="text-blue-900">94.3％</strong>
              </li>
            </ul>
          </div>

          <div className="mt-10 space-y-12 text-base leading-8 text-gray-700 sm:text-[17px]">
            <section>
              <p>
                通信制高校の口コミサイト「通信制高校リアルレビュー」を運営する
                株式会社キャリアエッセンスは、204校に寄せられた公開口コミ851件を対象に、
                実際の通学頻度と学校評価の関係を分析しました。
              </p>
              <p className="mt-5">
                重複登録2件を除いた有効回答849件を集計したところ、総合満足度で4または5を
                選んだ割合は、「ほぼオンライン／自宅」層と「週5通学」層で、
                ともに94.3％でした。
              </p>
              <p className="mt-5">
                一方、「月1〜数回」層では79.2％に低下。他の通学頻度より11〜15ポイント低く、
                満足度に「谷」が生じていることが分かりました。
              </p>
            </section>

            <section aria-labelledby="frequency-heading">
              <h2
                id="frequency-heading"
                className="border-l-4 border-blue-500 pl-4 text-2xl font-bold leading-9 text-gray-950"
              >
                通学頻度別の高満足率
              </h2>
              <DefinitionNote />

              <figure className="mt-7 rounded-2xl border border-gray-200 bg-white p-5 sm:p-7">
                <figcaption className="mb-6">
                  <p className="font-bold text-gray-900">主な通学頻度別・総合満足度4〜5の割合</p>
                  <p className="mt-1 text-sm text-gray-500">
                    単位：％ ／ 有効回答849件
                  </p>
                </figcaption>
                <div className="space-y-5">
                  {ATTENDANCE_SATISFACTION_DATA.map((item) => {
                    const highlighted = 'highlighted' in item && item.highlighted;
                    return (
                      <div key={item.label}>
                        <div className="mb-1.5 flex items-end justify-between gap-4">
                          <span
                            className={`text-sm font-semibold ${
                              highlighted ? 'text-amber-800' : 'text-gray-700'
                            }`}
                          >
                            {item.label}
                          </span>
                          <span className="text-right">
                            <strong
                              className={`text-lg ${
                                highlighted ? 'text-amber-700' : 'text-blue-800'
                              }`}
                            >
                              {item.value}％
                            </strong>
                            <span className="ml-2 text-xs text-gray-500">{item.count}</span>
                          </span>
                        </div>
                        <div
                          className="h-3 overflow-hidden rounded-full bg-gray-100"
                          role="img"
                          aria-label={`${item.label}の高満足率${item.value}％`}
                        >
                          <div
                            className={`h-full rounded-full ${
                              highlighted ? 'bg-amber-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${item.value}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-6 border-t border-gray-100 pt-4 text-xs leading-5 text-gray-500">
                  出典：通信制高校リアルレビュー公開口コミ／2026年9月15日集計
                </p>
              </figure>

              <p className="mt-7">
                「通学日数が少ないほど負担も少ない」「通学日数が多いほどサポートを受けやすい」
                という単純な関係ではなく、完全なオンライン学習と定期通学の中間にあたる
                「月1〜数回」層で、満足度が低くなる結果となりました。
              </p>
            </section>

            <section aria-labelledby="monthly-ratings-heading">
              <h2
                id="monthly-ratings-heading"
                className="border-l-4 border-blue-500 pl-4 text-2xl font-bold leading-9 text-gray-950"
              >
                月1〜数回層では、サポート・進路・雰囲気の高評価が6割未満
              </h2>
              <p className="mt-4">
                各項目を5段階で評価してもらい、4または5を選んだ人を「高評価」として
                集計しました。「月1〜数回」層101人の結果は次のとおりです。
              </p>

              <dl className="mt-6 grid gap-4 sm:grid-cols-3">
                {[
                  ['心や体調の波・不安へのサポート', '57.4％', '58／101人'],
                  ['在校生の雰囲気が自分に合っている', '58.4％', '59／101人'],
                  ['進路サポート', '55.4％', '56／101人'],
                ].map(([label, value, count]) => (
                  <div key={label} className="rounded-xl border border-gray-200 bg-white p-5">
                    <dt className="min-h-12 text-sm font-semibold leading-6 text-gray-600">
                      {label}
                    </dt>
                    <dd className="mt-3 text-3xl font-bold text-blue-800">{value}</dd>
                    <dd className="mt-1 text-xs text-gray-500">{count}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-6">
                いずれも、5つの通学頻度区分の中で最も低い割合でした。一方、同じ層でも
                単位取得のしやすさは84.2％、学びの柔軟さは83.2％が高評価でした。
              </p>
              <p className="mt-5 font-semibold text-gray-900">
                単位取得や学び方の柔軟性には満足している一方、学校とのつながりや進路支援には
                満足しきれていない、という評価構造が見られます。
              </p>
            </section>

            <section aria-labelledby="comparison-heading">
              <h2
                id="comparison-heading"
                className="border-l-4 border-blue-500 pl-4 text-2xl font-bold leading-9 text-gray-950"
              >
                同じ満足度94.3％でも、ほぼオンライン層と週5通学層では中身が異なる
              </h2>
              <p className="mt-4">
                両者は総合満足度が同じですが、個別評価には大きな違いがありました。
              </p>

              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <section className="rounded-2xl border border-sky-200 bg-sky-50 p-6">
                  <h3 className="text-lg font-bold text-sky-950">ほぼオンライン／自宅層</h3>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
                    <li>総合満足度4〜5：216／229人、94.3％</li>
                    <li>心身サポート4〜5：138／229人、60.3％</li>
                    <li>進路サポート4〜5：142／229人、62.0％</li>
                    <li>学費納得感1〜2：15／191人、7.9％</li>
                  </ul>
                </section>
                <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
                  <h3 className="text-lg font-bold text-indigo-950">週5通学層</h3>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
                    <li>総合満足度4〜5：82／87人、94.3％</li>
                    <li>心身サポート4〜5：76／87人、87.4％</li>
                    <li>進路サポート4〜5：71／87人、81.6％</li>
                    <li>学費納得感1〜2：15／75人、20.0％</li>
                  </ul>
                </section>
              </div>

              <p className="mt-6">
                ほぼオンライン層は、サポートや進路支援の評価が週5通学層より低い一方、
                学費への低評価は少ない結果でした。週5通学層はサポートを高く評価していますが、
                学費低評価はほぼオンライン層の約2.5倍です。
              </p>
              <p className="mt-5">
                同じ高満足率でも、ほぼオンライン層は自由度や費用面、週5通学層は
                対面サポートを評価している可能性があります。
              </p>
            </section>

            <section aria-labelledby="hypotheses-heading">
              <h2
                id="hypotheses-heading"
                className="border-l-4 border-blue-500 pl-4 text-2xl font-bold leading-9 text-gray-950"
              >
                なぜ「月1〜数回」に満足度の谷が生まれるのか
              </h2>
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
                以下は、定量評価と自由記述から考えられる仮説です。本調査だけで因果関係を
                断定するものではありません。
              </div>

              <section className="mt-8">
                <p className="text-sm font-bold text-blue-700">仮説1</p>
                <h3 className="mt-1 text-xl font-bold leading-8 text-gray-950">
                  「期待していた支援」と「実際の支援」にギャップがある
                </h3>
                <p className="mt-4">
                  ほぼオンライン層は、自主学習を前提として自由度を評価している可能性があります。
                  一方、月1〜数回層は、普段は自宅で学習しながら、限られた登校日に先生から
                  進捗確認や相談対応を受けることを期待している可能性があります。
                </p>

                <div className="mt-6 rounded-2xl bg-gray-900 p-6 text-white">
                  <p className="text-sm font-semibold text-blue-200">
                    心身サポートを1〜3と評価した人のうち、総合満足度4〜5だった割合
                  </p>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <div>
                      <p className="text-sm text-gray-300">ほぼオンライン／自宅</p>
                      <p className="mt-1 text-3xl font-bold">90.1％</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-300">月1〜数回</p>
                      <p className="mt-1 text-3xl font-bold text-amber-300">58.1％</p>
                    </div>
                  </div>
                </div>

                <p className="mt-6">
                  サポートを高く評価していない場合でも、ほぼオンライン層では9割が学校全体に
                  満足しています。一方、月1〜数回層では約6割まで低下しています。
                </p>
                <p className="mt-5">
                  ほぼオンライン層はサポートの手厚さより自由度を優先する一方、月1〜数回層は
                  「登校機会があるから、その日に支援を受けられる」と期待している可能性があります。
                  その期待に対して十分な支援が提供されない場合、満足度へ直接影響しやすいと
                  考えられます。
                </p>
              </section>

              <section className="mt-10 border-t border-gray-200 pt-9">
                <p className="text-sm font-bold text-blue-700">仮説2</p>
                <h3 className="mt-1 text-xl font-bold leading-8 text-gray-950">
                  月数回の接点では、継続的に見守る支援が途切れやすい
                </h3>
                <p className="mt-4">
                  月1〜数回の登校では、一度先生と話せても、次の接点まで数週間空く場合があります。
                  その間に、レポートの遅れ、体調や学習状況の変化、進路関係の締め切りなどを
                  学校側が把握しにくくなることが考えられます。
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <p className="text-sm font-semibold text-gray-600">
                      低満足層の進路関連への言及
                    </p>
                    <p className="mt-2 text-3xl font-bold text-blue-800">42.9％</p>
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      高満足層では16.3％
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <p className="text-sm font-semibold text-gray-600">
                      低満足層の連絡・相談・フォローへの言及
                    </p>
                    <p className="mt-2 text-3xl font-bold text-blue-800">28.6％</p>
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      高満足層では10.0％
                    </p>
                  </div>
                </div>

                <p className="mt-6">
                  月1〜数回層のうち、総合満足度1〜3だった21人の自由記述を関連語で分類すると、
                  低満足層では、進路への言及が高満足層の約2.6倍、学校からの働きかけへの言及が
                  約2.9倍確認されました。
                </p>

                <div className="mt-6 space-y-4">
                  {[
                    'こちら側から学校に聞かないと、どのような具合でやっているのか、これからの進路を決めなくて大丈夫なのかが少し不安です',
                    '手厚いサポートがあるわけではないので、自分で考え、提出期限なども把握して進めていく必要があります',
                    '大学を受けることを以前から伝えていたにもかかわらず、共通テストの締め切りをギリギリに言われて焦りました',
                  ].map((quote) => (
                    <blockquote
                      key={quote}
                      className="rounded-r-xl border-l-4 border-gray-300 bg-white px-5 py-4 text-gray-700"
                    >
                      「{quote}」
                    </blockquote>
                  ))}
                </div>

                <p className="mt-6">
                  週5通学では、正式な面談がなくても、先生が普段の様子から生徒の変化に
                  気づく機会があります。オンライン学習を前提としたコースでは、チャットや
                  学習システムを使った進捗管理が整備されている場合があります。
                </p>
                <p className="mt-5">
                  月1〜数回層では、そのどちらも弱くなり、単発の相談機会はあっても、
                  継続的に見守られる仕組みが不足しやすい可能性があります。
                </p>
              </section>
            </section>

            <section aria-labelledby="caution-heading">
              <h2
                id="caution-heading"
                className="border-l-4 border-blue-500 pl-4 text-2xl font-bold leading-9 text-gray-950"
              >
                通学頻度が原因ではなく、結果である可能性も
              </h2>
              <p className="mt-4">
                本調査で尋ねたのは、希望する通学頻度や学校が指定した登校日数ではなく、
                回答者の「実際の主な通学頻度」です。
              </p>
              <p className="mt-5">
                学校への不満や体調の変化、人間関係や学習面でのつまずきなどの結果として、
                登校頻度が月1〜数回まで減った可能性もあります。今回の結果は、月1〜数回の
                通学が満足度を下げることや、特定の通学頻度の優劣を証明するものではありません。
              </p>
            </section>

            <section aria-labelledby="checklist-heading">
              <h2
                id="checklist-heading"
                className="border-l-4 border-blue-500 pl-4 text-2xl font-bold leading-9 text-gray-950"
              >
                入学前に確認したいのは「登校日数」だけではない
              </h2>
              <p className="mt-4">
                通信制高校を比較する際には、登校日数に加えて、次の点を確認することが重要です。
              </p>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  '登校しない期間にも学校側から連絡があるか',
                  'レポートの遅れを誰が把握するか',
                  '生徒から相談しなくても面談が設定されるか',
                  '進路情報や締め切りが家庭にも共有されるか',
                  'オンラインで質問・相談できる時間があるか',
                  '月数回の登校が個別支援や交流につながっているか',
                  '通学コースの追加費用に何が含まれるか',
                ].map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3.5 text-sm leading-6"
                  >
                    <span className="font-bold text-blue-600" aria-hidden>
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 font-semibold text-gray-900">
                登校回数の少なさよりも、登校していない時間に学校とどのようにつながるかが、
                学校との相性を左右している可能性があります。
              </p>
            </section>

            <section aria-labelledby="representative-heading">
              <h2
                id="representative-heading"
                className="border-l-4 border-blue-500 pl-4 text-2xl font-bold leading-9 text-gray-950"
              >
                代表コメント
              </h2>
              <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
                <p className="font-bold text-gray-950">株式会社キャリアエッセンス</p>
                <p className="mt-1 text-sm text-gray-500">代表取締役 倉田 嵩之</p>

                <div className="mt-6 space-y-5 text-[16px] leading-8 text-gray-700">
                  <p>
                    通信制高校は、さまざまな事情や背景を持つ生徒を受け入れ、卒業後の進路や
                    社会へ送り出す重要な教育機関です。多様な生徒の学びを止めないために、
                    さまざまな通学頻度やコースを設け、受け入れの選択肢を広げようとする
                    学校の姿勢は、非常に意義のあるものだと考えています。
                  </p>
                  <p>
                    一方で、選択肢を増やすことと、それぞれの生徒を継続的に支えられる体制を
                    整えることは、必ずしも同じではありません。多種多様な生徒やコースを
                    受け入れるための教職員数、情報共有、進捗管理、進路支援などの運営体制が
                    追いつかないまま、学校経営や規模の拡大が進んでいるケースもあるのでは
                    ないかと感じています。今回の調査だけで個別の学校について断定はできませんが、
                    選べるコースがあることと、十分な支援を受けられることは分けて確認する
                    必要があります。
                  </p>
                  <p>
                    私たちが保護者や生徒にインタビューする中では、全日制高校への不安や
                    中学校卒業後の進路に対する焦りから、十分に比較検討しないまま通信制高校を
                    決めてしまったという例も散見されます。まずは実際に学校へ足を運び、
                    学校見学やオープンキャンパスなどに参加することが重要です。
                  </p>
                  <p>
                    ただし、パンフレット、公式サイト、学校説明会、オープンキャンパスには、
                    当然ながら学校が伝えたい教育方針や強みが反映されます。そこで得た情報だけで
                    判断するのではなく、実際に通うキャンパスの雰囲気、登校しない日の支援、
                    レポートの進捗管理、相談方法、進路支援、費用総額などを具体的に確認し、
                    「この学校がわが子や自分に本当に合っているか」を慎重に考えていただきたいと
                    思います。
                  </p>
                  <p>
                    通信制高校リアルレビューでは、学校を一方的に評価するのではなく、
                    公式情報だけでは見えにくい在校生・卒業生・保護者の体験を届けることで、
                    一人ひとりが納得して学校を選べる環境をつくっていきます。
                  </p>
                </div>
              </div>
            </section>

            <section aria-labelledby="method-heading">
              <h2
                id="method-heading"
                className="border-l-4 border-blue-500 pl-4 text-2xl font-bold leading-9 text-gray-950"
              >
                調査概要
              </h2>
              <dl className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white text-sm">
                {[
                  ['調査対象', '通信制高校リアルレビューで公開状態にある口コミ851件'],
                  ['対象校', '204校'],
                  ['有効回答', '849件'],
                  [
                    '重複処理',
                    '学校名・良かった点・改善点が完全一致した三重登録1組から重複2件を除外',
                  ],
                  ['収集期間', '2026年1月9日〜9月14日'],
                  ['回答者', '本人486件、保護者363件'],
                  ['在籍状況', '在籍中210件、卒業604件、以前在籍35件'],
                  ['集計日', '2026年9月15日'],
                  ['収集方法', 'サイト投稿およびクラウドソーシングを利用したアンケート'],
                  ['高評価の定義', '5段階評価の4または5'],
                  ['低評価の定義', '5段階評価の1または2'],
                  [
                    '自由記述分析',
                    '改善点・合わない点に含まれる関連語の出現を分類（複数分類を含む）',
                  ],
                ].map(([term, description], index) => (
                  <div
                    key={term}
                    className={`grid gap-1 px-5 py-4 sm:grid-cols-[10rem_1fr] sm:gap-5 ${
                      index > 0 ? 'border-t border-gray-100' : ''
                    }`}
                  >
                    <dt className="font-semibold text-gray-700">{term}</dt>
                    <dd className="text-gray-600">{description}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6 rounded-xl bg-gray-100 p-5 text-sm leading-7 text-gray-600">
                <p className="font-semibold text-gray-800">調査結果を読む際の注意</p>
                <p className="mt-2">
                  本調査は無作為抽出ではなく、全国の通信制高校在籍者・卒業者全体を
                  代表するものではありません。通学頻度は希望や学校指定の頻度ではなく、
                  回答者の実際の主な通学頻度です。学校、コース、キャンパス、回答者の状況などの
                  違いを完全には調整していません。本調査は各通学頻度と満足度の関連を示すもので、
                  因果関係を証明するものではありません。
                </p>
              </div>
            </section>

            <section aria-labelledby="service-heading">
              <h2
                id="service-heading"
                className="border-l-4 border-blue-500 pl-4 text-2xl font-bold leading-9 text-gray-950"
              >
                通信制高校リアルレビューについて
              </h2>
              <p className="mt-4">
                通信制高校の在校生・卒業生・保護者による口コミを掲載する口コミメディアです。
                学校の雰囲気、通学頻度、学習の柔軟性、心身へのサポート、進路支援、学費など、
                公式情報だけでは分かりにくい実際の体験を可視化し、本人と保護者が納得して
                学校を選べるよう支援しています。
              </p>
              <Link
                href={appPath('/')}
                className="mt-5 inline-flex font-semibold text-blue-700 hover:text-blue-800"
              >
                通信制高校リアルレビューを見る
              </Link>
            </section>

            <section aria-labelledby="company-heading">
              <h2
                id="company-heading"
                className="border-l-4 border-blue-500 pl-4 text-2xl font-bold leading-9 text-gray-950"
              >
                会社概要・お問い合わせ
              </h2>
              <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-sm leading-7 sm:p-8">
                <p>
                  <strong>会社名：</strong>株式会社キャリアエッセンス
                </p>
                <p>
                  <strong>代表者：</strong>代表取締役 倉田 嵩之
                </p>
                <p>
                  <strong>設立：</strong>2021年4月1日
                </p>
                <p>
                  <strong>所在地：</strong>
                  東京都中央区日本橋蛎殻町1-13-1 ユニゾ蛎殻町北島ビル
                </p>
                <p>
                  <strong>会社URL：</strong>
                  <a
                    href="https://careeressence.jp/"
                    className="text-blue-700 hover:underline"
                  >
                    https://careeressence.jp/
                  </a>
                </p>
                <p className="mt-4 border-t border-gray-100 pt-4">
                  <strong>本件に関するお問い合わせ：</strong>
                  <a
                    href="mailto:info@careeressence.co.jp"
                    className="ml-1 text-blue-700 hover:underline"
                  >
                    info@careeressence.co.jp
                  </a>
                </p>
              </div>
            </section>
          </div>

          <div className="mt-14 border-t border-gray-200 pt-8">
            <Link
              href={appPath('/press-releases')}
              className="inline-flex items-center gap-2 font-semibold text-blue-700 hover:text-blue-800"
            >
              <span aria-hidden>←</span>
              プレスリリース一覧へ戻る
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
