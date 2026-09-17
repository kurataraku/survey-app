import Link from 'next/link';
import PrefectureLandingFaq from '@/components/PrefectureLandingFaq';
import PrefectureLandingTrackedLink from '@/components/PrefectureLandingTrackedLink';
import PrefectureSchoolCardTracker from '@/components/PrefectureSchoolCardTracker';
import { appPath } from '@/lib/base-path';
import type { PrefectureFaqStats } from '@/lib/prefectures/prefecture-landing-schema';
import type {
  PrefectureLandingData,
  PrefectureRankingEntry,
  PrefectureSchoolRow,
  TuitionConfirmationState,
} from '@/lib/schools/getPrefectureLandingData';
import type { PrefectureLocationInsights } from '@/lib/schools/getPrefectureLocationInsights';
import type { SchoolCardGlobalAverages } from '@/lib/home/getHomeData';
import type { SchoolInstitutionType } from '@/lib/types/schools';
import {
  buildReasonGroupReviewsPath,
  REVIEW_REASON_GROUPS,
} from '@/lib/reviews/reason-groups';
import ThemeHubNav from '@/components/ThemeHubNav';
import {
  getPrefectureLandingHeading,
  getPrefectureLandingSubtitle,
} from '@/lib/prefectures/prefecture-landing-copy';
import { getPrefectureParentGuidePoints } from '@/lib/prefectures/prefecture-parent-guide';
import RequestNotificationCta from '@/components/RequestNotificationCta';
import TuitionDisclaimer from '@/components/TuitionDisclaimer';
import { GA_EVENTS } from '@/lib/analytics/events';
import { PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING } from '@/lib/schools/prefecture-landing-constants';

interface PrefectureLandingPageProps {
  data: PrefectureLandingData;
  introLead: string;
  globalAverages: SchoolCardGlobalAverages | null;
  hasSchools: boolean;
}

const institutionTypeLabels: Record<SchoolInstitutionType, string> = {
  public: '公立',
  private: '私立',
  support: 'サポート校',
};

const tuitionStateLabels: Record<TuitionConfirmationState, string> = {
  amounts: '目安あり',
  varies: 'コース別',
  contact_required: '個別確認',
  unconfirmed: '要確認',
};

function schoolHref(row: PrefectureSchoolRow): string | null {
  return row.slug ? appPath(`/schools/${row.slug}`) : null;
}

function SchoolNameCell({ row }: { row: PrefectureSchoolRow }) {
  const href = schoolHref(row);
  if (!href) {
    return <span className="font-medium text-gray-900">{row.name}</span>;
  }
  return (
    <Link href={href} className="font-medium text-blue-700 hover:text-blue-900 hover:underline">
      {row.name}
    </Link>
  );
}

function formatLocalBase(row: PrefectureSchoolRow, prefecture: string): string {
  const parts: string[] = [];
  if (row.hasLocalHeadquarters) parts.push('本校');
  if (row.localCampusCount > 0) {
    parts.push(
      row.localCities.length > 0
        ? `${row.localCities.slice(0, 2).join('・')}${row.localCampusCount > 2 ? 'ほか' : ''}`
        : `キャンパス${row.localCampusCount}拠点`
    );
  }
  if (parts.length === 0) {
    return `${prefecture}内の拠点は未登録`;
  }
  return parts.join(' / ');
}

/** 掲載母集団の内訳。合算した「掲載校数」だけを主指標にしない */
function SummaryStats({
  data,
  globalAverages,
}: {
  data: PrefectureLandingData;
  globalAverages: SchoolCardGlobalAverages | null;
}) {
  const { counts, prefecture } = data;
  const nationalOverall = globalAverages?.overall_satisfaction_avg ?? null;
  const diff =
    data.averageOverallSatisfaction != null && nationalOverall != null
      ? parseFloat((data.averageOverallSatisfaction - nationalOverall).toFixed(1))
      : null;

  const cards: { label: string; value: string; hint?: string }[] = [
    {
      label: '掲載校数',
      value: `${counts.totalSchools}校`,
      hint: `本校${counts.localHeadquartersCount}校 / キャンパスあり${counts.localCampusSchoolCount}校`,
    },
    {
      label: `${prefecture}内キャンパス`,
      value: `${counts.localCampusLocationCount}拠点`,
      hint: '学校数とは別に拠点数で数えています',
    },
    {
      label: '公立 / 私立 / サポート校',
      value: `${counts.publicCount} / ${counts.privateCount} / ${counts.supportCount}`,
      hint: '同じ母数で混ぜずに区分しています',
    },
    {
      label: '口コミ総数',
      value: data.totalReviewCount > 0 ? `${data.totalReviewCount}件` : '—',
      hint: `学校全体の公開口コミ / 掲載校のうち${data.schoolsWithReviewsCount}校に口コミあり`,
    },
    {
      label: '平均総合満足度',
      value:
        data.averageOverallSatisfaction != null
          ? data.averageOverallSatisfaction.toFixed(1)
          : '—',
      hint:
        diff != null
          ? `5点満点 / 全国平均比 ${diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1)}`
          : '5点満点',
    },
  ];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-gray-200 bg-white px-4 py-3 flex flex-col justify-center"
        >
          <p className="text-xs text-gray-500 mb-0.5 leading-snug">{card.label}</p>
          <p className="text-lg font-bold text-gray-900">{card.value}</p>
          {card.hint && (
            <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{card.hint}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/** 集計の定義と調査方法。数値の意味が分かるよう本文と同じ画面に置く */
function MethodologyNote({ data }: { data: PrefectureLandingData }) {
  const { counts, prefecture } = data;
  return (
    <section
      className="mb-8 rounded-xl border border-gray-200 bg-white p-4 md:p-5"
      aria-labelledby="pref-methodology-heading"
    >
      <h2 id="pref-methodology-heading" className="text-base font-bold text-gray-900 mb-2">
        このページの数え方と調査方法
      </h2>
      <ul className="space-y-1.5 text-xs text-gray-600 leading-relaxed">
        <li>
          掲載校は「本校が{prefecture}にある学校」{counts.localHeadquartersCount}校、「
          {prefecture}にキャンパスがある学校」{counts.localCampusSchoolCount}校、
          「対応地域として登録があり{prefecture}内の拠点が未登録の学校」
          {counts.withoutLocalLocationCount}校の合計です。
        </li>
        <li>
          口コミは当サイトのアンケート回答のうち、AI審査と管理者確認を通過し公開されたものだけを集計しています。
          回答キャンパスを特定できない口コミは<strong className="font-semibold">学校全体の口コミ</strong>
          として扱い、{prefecture}固有の件数としては扱っていません。
        </li>
        <li>
          学費は各学校の公開情報で確認できた範囲のみを「目安あり」として表示し、コースや通学頻度で変わる場合は
          「コース別」、確認できない場合は「要確認」と表示しています。未確認を安い・無料という意味では使っていません。
        </li>
        <li>
          キャンパス所在地・最寄り駅は学校公式サイト等で確認できた範囲の登録情報です。最新の所在地・募集状況は各学校の公式情報で確認してください。
        </li>
      </ul>
    </section>
  );
}

/** 全掲載校のコンパクト比較表。大型カードの繰り返しをやめ、初期HTMLを軽くする */
function ComparisonTable({ data }: { data: PrefectureLandingData }) {
  const { prefecture, rows } = data;
  return (
    <section className="mb-8" aria-labelledby="pref-comparison-heading">
      <span id="pref-school-list" className="block scroll-mt-40" aria-hidden />
      <h2 id="pref-comparison-heading" className="text-xl font-bold text-gray-900 mb-2">
        {prefecture}の通信制高校・サポート校を一覧で比較
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        学校種別、{prefecture}内の拠点、最寄り駅、学費の確認状態、口コミ件数、総合満足度を同じ条件で並べています。
        学校名から詳細ページへ移ると、口コミ本文と項目別評価を確認できます。
      </p>
      <PrefectureSchoolCardTracker prefecture={prefecture} block="list">
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-[44rem] w-full text-sm">
            <caption className="sr-only">
              {prefecture}の通信制高校・サポート校の比較一覧
            </caption>
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                  学校名
                </th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                  種別
                </th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                  {prefecture}内の拠点
                </th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                  最寄り駅
                </th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                  学費
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                  口コミ
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                  総合
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-blue-50/40">
                  <th scope="row" className="px-3 py-2.5 text-left font-normal">
                    <SchoolNameCell row={row} />
                    {!row.hasLocalHeadquarters && (
                      <span className="block text-[11px] text-gray-500">
                        本校: {row.headquartersPrefecture}
                      </span>
                    )}
                  </th>
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                    {row.institutionType ? institutionTypeLabels[row.institutionType] : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">{formatLocalBase(row, prefecture)}</td>
                  <td className="px-3 py-2.5 text-gray-700">
                    {row.localStations.length > 0 ? row.localStations.join('・') : '—'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                    {tuitionStateLabels[row.tuitionState]}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap text-gray-700">
                    {row.reviewCount > 0 ? `${row.reviewCount}件` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap text-gray-700">
                    {row.overallAvg != null ? row.overallAvg.toFixed(1) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PrefectureSchoolCardTracker>
      <TuitionDisclaimer className="mt-3" />
    </section>
  );
}

/** ランキングは学校名・根拠指標・口コミ件数だけの小型行にする */
function RankingList({
  prefecture,
  block,
  entries,
  emptyMessage,
}: {
  prefecture: string;
  block: string;
  entries: PrefectureRankingEntry[];
  emptyMessage: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>;
  }
  return (
    <PrefectureSchoolCardTracker prefecture={prefecture} block={block}>
      <ol className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {entries.map((entry, index) => (
          <li key={entry.row.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="w-5 shrink-0 text-xs font-bold text-gray-400">{index + 1}</span>
            <span className="min-w-0 flex-1">
              <SchoolNameCell row={entry.row} />
            </span>
            <span className="shrink-0 text-xs font-semibold text-gray-900">
              {entry.metricLabel}
            </span>
            <span className="shrink-0 text-xs text-gray-500">口コミ{entry.row.reviewCount}件</span>
          </li>
        ))}
      </ol>
    </PrefectureSchoolCardTracker>
  );
}

function LocationInsightsSection({
  prefecture,
  insights,
}: {
  prefecture: string;
  insights: PrefectureLocationInsights;
}) {
  if (insights.topCities.length === 0 && insights.topStations.length === 0) return null;

  const prefParam = encodeURIComponent(prefecture);

  return (
    <section
      className="mb-8 rounded-xl border border-blue-100 bg-white p-5 md:p-6"
      aria-labelledby="pref-location-insights-heading"
    >
      <h2 id="pref-location-insights-heading" className="text-xl font-bold text-gray-900 mb-2">
        {prefecture}の通信制高校をエリア・最寄り駅から探す
      </h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-5 max-w-4xl">
        {prefecture}内でキャンパス所在地を確認できたのは{insights.schoolsWithCampusLocation}校、
        そのうち最寄り駅まで確認できたのは{insights.schoolsWithNearestStation}校です。
        通学のしやすさから絞り込みたい場合は、市区町村または駅から候補校を確認してください。
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {insights.topCities.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">市区町村から探す</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {insights.topCities.map((city) => {
                const cityParam = encodeURIComponent(city.city);
                return (
                  <li key={city.city}>
                    <Link
                      href={appPath(`/schools?campus_prefecture=${prefParam}&campus_city=${cityParam}`)}
                      rel="nofollow"
                      className="block h-full rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2.5 hover:border-blue-300 hover:bg-blue-50/70 transition-colors"
                    >
                      <span className="block text-sm font-bold text-blue-700">
                        {prefecture}
                        {city.city}
                      </span>
                      <span className="block text-xs text-gray-600 leading-relaxed">
                        掲載校 {city.schoolCount}校
                        {city.nearestStations.length > 0
                          ? ` / 最寄り: ${city.nearestStations.join('・')}`
                          : ''}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {insights.topStations.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">主な最寄り駅から探す</h3>
            <ul className="flex flex-wrap gap-2">
              {insights.topStations.map((station) => (
                <li key={station.name}>
                  <Link
                    href="#pref-comparison-heading"
                    className="inline-block rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 hover:border-blue-300 hover:bg-blue-50"
                  >
                    {station.name}
                    <span className="ml-1 text-gray-400">({station.schoolCount}校)</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-500 leading-relaxed">
              駅名は比較表の「最寄り駅」列と対応しています。通学頻度や必須スクーリングの場所は学校詳細で確認してください。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

const institutionTypeGuides: Record<SchoolInstitutionType, { title: string; description: string }> = {
  public: {
    title: '公立通信制高校',
    description:
      '学費負担を抑えやすい一方で、登校日数・レポート提出・スクーリングの場所を自分で管理する場面があります。口コミでは単位取得のしやすさ、先生・職員の対応、通学頻度の実態を確認してください。',
  },
  private: {
    title: '私立通信制高校',
    description:
      '通学コース、オンライン学習、個別サポート、進路支援の選択肢が学校ごとに大きく異なります。口コミでは学びの柔軟さ、サポート体制、進路サポート、学費の納得感を見比べると選びやすくなります。',
  },
  support: {
    title: 'サポート校',
    description:
      '提携する通信制高校の学習支援や通学サポートを行う施設で、サポート校のみでは高校卒業資格を取得できません。提携校、卒業資格の仕組み、通学頻度、追加費用を公式情報と口コミの両方で確認してください。',
  },
};

function InstitutionTypeGuide({
  prefecture,
  counts,
}: {
  prefecture: string;
  counts: PrefectureLandingData['counts'];
}) {
  const items: { type: SchoolInstitutionType; count: number }[] = [
    { type: 'public', count: counts.publicCount },
    { type: 'private', count: counts.privateCount },
    { type: 'support', count: counts.supportCount },
  ];
  return (
    <section
      className="mb-8 rounded-xl border border-gray-200 bg-white p-5 md:p-6"
      aria-labelledby="pref-institution-guide-heading"
    >
      <h2 id="pref-institution-guide-heading" className="text-xl font-bold text-gray-900 mb-2">
        {prefecture}で比べる前に知っておきたい学校種別の違い
      </h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-4 max-w-4xl">
        公立・私立・サポート校は、費用の考え方も卒業資格の仕組みも異なります。比較表の「種別」列とあわせて確認してください。
      </p>
      <ul className="grid gap-4 md:grid-cols-3">
        {items.map(({ type, count }) => (
          <li key={type} className="rounded-lg border border-gray-100 bg-gray-50/70 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-1.5">
              {institutionTypeGuides[type].title}
              <span className="ml-2 text-xs font-normal text-gray-500">{count}校</span>
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {institutionTypeGuides[type].description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ParentGuideSection({ prefecture }: { prefecture: string }) {
  const points = getPrefectureParentGuidePoints(prefecture);
  return (
    <section
      className="mb-8 rounded-xl border border-gray-200 bg-white p-5 md:p-6"
      aria-labelledby="pref-parent-guide-heading"
    >
      <h2 id="pref-parent-guide-heading" className="text-xl font-bold text-gray-900 mb-2">
        {prefecture}で通信制高校を選ぶとき、保護者が確認したい比較ポイント
      </h2>
      <ul className="grid gap-4 md:grid-cols-2">
        {points.map((point) => (
          <li key={point.title} className="rounded-lg border border-gray-100 bg-gray-50/70 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-1.5">{point.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{point.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function InternalLinks({ prefecture }: { prefecture: string }) {
  const prefParam = encodeURIComponent(prefecture);
  const links: { href: string; label: string; description: string }[] = [
    {
      href: appPath(`/schools?campus_prefecture=${prefParam}`),
      label: `${prefecture}の通信制高校を条件検索で絞り込む`,
      description: '学校名や条件を変えて、同じ地域の学校を探せます。',
    },
    {
      href: appPath(`/reviews?prefecture=${prefParam}`),
      label: `${prefecture}の通信制高校の口コミを一覧で見る`,
      description: '地域を絞った口コミを新着順で確認できます。',
    },
    {
      href: appPath('/features/topics'),
      label: '学費・公立・スクーリングなど選び方ガイド',
      description: '気になるテーマから記事を読み、学校比較につなげられます。',
    },
  ];
  return (
    <nav className="mb-8 rounded-xl border border-gray-200 bg-white p-5 md:p-6" aria-label="関連ページ">
      <p className="text-lg font-bold text-gray-900 mb-4">{prefecture}の通信制高校をさらに探す</p>
      <ul className="grid gap-3 md:grid-cols-3">
        {links.map(({ href, label, description }) => (
          <li key={`${href}-${label}`}>
            <Link
              href={href}
              rel={href.includes('?') ? 'nofollow' : undefined}
              className="block h-full rounded-lg border border-gray-100 bg-gray-50/70 p-4 hover:border-blue-300 hover:bg-blue-50/70 transition-colors"
            >
              <span className="block text-sm font-bold text-blue-700 mb-1">{label}</span>
              <span className="block text-xs text-gray-600 leading-relaxed">{description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function PrefectureLandingPage({
  data,
  introLead,
  globalAverages,
  hasSchools,
}: PrefectureLandingPageProps) {
  const { prefecture } = data;
  const faqStats: PrefectureFaqStats = {
    totalSchools: data.counts.totalSchools,
    schoolsWithReviewsCount: data.schoolsWithReviewsCount,
    totalReviewCount: data.totalReviewCount,
    averageOverallSatisfaction: data.averageOverallSatisfaction,
  };

  const prefParam = encodeURIComponent(prefecture);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="text-sm text-gray-500 mb-4" aria-label="パンくず">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href={appPath('/')} className="hover:text-blue-600">
                トップ
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href={appPath('/schools')} className="hover:text-blue-600">
                学校一覧
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-gray-800 font-medium">{prefecture}の通信制高校</li>
          </ol>
        </nav>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {getPrefectureLandingHeading(prefecture)}
          </h1>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed max-w-4xl">
            {getPrefectureLandingSubtitle(prefecture, data.copyStats)}
          </p>
        </div>

        {!hasSchools ? (
          <div className="rounded-xl border border-gray-200 bg-white py-12 text-center">
            <p className="text-gray-600">{prefecture}の通信制高校が見つかりませんでした</p>
            <Link
              href={appPath('/schools')}
              className="mt-4 inline-block text-blue-600 hover:text-blue-700"
            >
              学校検索へ戻る
            </Link>
          </div>
        ) : (
          <>
            <SummaryStats data={data} globalAverages={globalAverages} />

            <nav
              className="mb-6 rounded-xl border border-blue-100 bg-white px-4 py-3 sm:px-5 sm:py-4"
              aria-label={`${prefecture}の通信制高校比較で次に見るページ`}
            >
              <p className="text-sm font-semibold text-gray-900 mb-2">すぐに学校を比較する</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <li>
                  <Link
                    href="#pref-comparison-heading"
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    全掲載校の比較表を見る
                  </Link>
                </li>
                <li>
                  <Link
                    href="#pref-location-insights-heading"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    エリア・最寄り駅から探す
                  </Link>
                </li>
                <li>
                  <Link
                    href="#pref-rankings-heading"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    口コミ評価が高い学校を見る
                  </Link>
                </li>
                <li>
                  <PrefectureLandingTrackedLink
                    href={appPath(`/simulator?prefecture=${prefParam}`)}
                    eventName={GA_EVENTS.diagnosisStartClick}
                    eventParams={{ prefecture, source: 'comparison_nav' }}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    通信制高校えらび診断ナビ
                  </PrefectureLandingTrackedLink>
                </li>
                <li>
                  <Link
                    href={appPath(`/reviews?prefecture=${prefParam}`)}
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {prefecture}の口コミ一覧を見る
                  </Link>
                </li>
              </ul>
            </nav>

            <ComparisonTable data={data} />

            <LocationInsightsSection prefecture={prefecture} insights={data.locationInsights} />

            <section className="mb-8" aria-labelledby="pref-rankings-heading">
              <h2 id="pref-rankings-heading" className="text-xl font-bold text-gray-900 mb-2">
                {prefecture}の口コミ評価から見る学校
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                口コミが{PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING}
                件以上ある学校を対象に、観点ごとの平均が高い順に並べています（学費満足度は金額ではなく納得感の評価です）。
              </p>
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">口コミが多い学校</h3>
                  <RankingList
                    prefecture={prefecture}
                    block="top_reviews"
                    entries={data.topByReviewCount}
                    emptyMessage="口コミが掲載されている学校がまだありません。"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">総合満足度が高い学校</h3>
                  <RankingList
                    prefecture={prefecture}
                    block="top_rating"
                    entries={data.topByRating}
                    emptyMessage="条件を満たす学校がまだありません。"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">サポート評価が高い学校</h3>
                  <RankingList
                    prefecture={prefecture}
                    block="top_support"
                    entries={data.topBySupport}
                    emptyMessage="サポート評価の口コミが十分にある学校がまだありません。"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">学費満足度が高い学校</h3>
                  <RankingList
                    prefecture={prefecture}
                    block="top_tuition"
                    entries={data.topByTuition}
                    emptyMessage="学費満足度の口コミが十分にある学校がまだありません。"
                  />
                </div>
              </div>
            </section>

            <MethodologyNote data={data} />

            <InstitutionTypeGuide prefecture={prefecture} counts={data.counts} />

            <ParentGuideSection prefecture={prefecture} />

            <section
              className="mb-8 rounded-xl border border-gray-200 bg-white p-5 md:p-6"
              aria-labelledby="pref-intro-heading"
            >
              <h2 id="pref-intro-heading" className="text-xl font-bold text-gray-900 mb-3">
                {prefecture}の通信制高校を口コミで比較するポイント
              </h2>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed max-w-4xl">
                {introLead}
              </p>
            </section>

            <PrefectureLandingFaq prefecture={prefecture} stats={faqStats} />

            <section
              className="mt-10 mb-10 rounded-xl border border-gray-200 bg-white p-5 md:p-6"
              aria-labelledby="pref-attendance-heading"
            >
              <h2 id="pref-attendance-heading" className="text-xl font-bold text-gray-900 mb-3">
                {prefecture}の通信制高校の口コミを通学頻度で探す
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {data.attendanceFrequencyLinks.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="block h-full rounded-lg border border-gray-200 bg-gray-50/70 p-4 hover:border-blue-300 hover:bg-blue-50/70 transition-colors"
                    >
                      <span className="block text-sm font-bold text-gray-900 mb-1">{label}</span>
                      <span className="block text-xs text-gray-600 leading-relaxed">
                        {prefecture}の{label}で通った口コミを見る
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section
              className="mb-10 rounded-xl border border-gray-200 bg-white p-5 md:p-6"
              aria-labelledby="pref-reason-heading"
            >
              <h2 id="pref-reason-heading" className="text-lg font-bold text-gray-900 mb-3">
                {prefecture}の口コミを通信制を選んだ理由別に見る
              </h2>
              <ul className="grid gap-3 md:grid-cols-3">
                {REVIEW_REASON_GROUPS.map((group) => (
                  <li key={group.key}>
                    <Link
                      href={buildReasonGroupReviewsPath(prefecture, group)}
                      className="block h-full rounded-lg border border-gray-200 bg-gray-50/70 p-4 hover:border-blue-300 hover:bg-blue-50/70 transition-colors"
                    >
                      <p className="text-sm font-bold text-gray-900 mb-1">{group.shortLabel}</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{group.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <ThemeHubNav
              heading={`${prefecture}で気になるテーマから調べる`}
              hubIds={['tuition', 'public', 'schooling', 'transfer']}
              className="mb-8"
            />

            <RequestNotificationCta
              source="prefecture_landing"
              prefecture={prefecture}
              className="mb-8"
            />

            <InternalLinks prefecture={prefecture} />
          </>
        )}
      </div>
    </div>
  );
}
