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
} from '@/lib/schools/getPrefectureLandingData';
import PrefectureSchoolListRow from '@/components/PrefectureSchoolListRow';
import RegionalSchoolCard, { type RegionalSchoolCardData } from '@/components/RegionalSchoolCard';
import RegionalSchoolFinder from '@/components/RegionalSchoolFinder';
import {
  nationalAverageDiff,
  PREFECTURE_LIST_SKIP_LINK_MIN_SCHOOLS,
  PREFECTURE_REGIONAL_CARD_LIMIT,
  shouldShowPrefectureFinder,
} from '@/lib/schools/regionalLanding';
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

function TuitionCell({ tuition }: { tuition: PrefectureSchoolRow['tuition'] }) {
  if (!tuition) return <span className="text-gray-400">—</span>;
  return (
    <>
      <span className="whitespace-nowrap">{tuition.value}</span>
      {tuition.basisLabel && <span className="block text-[11px] text-gray-500">{tuition.basisLabel}</span>}
    </>
  );
}

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
      hint: `${prefecture}に本校${counts.localHeadquartersCount}校 / キャンパスがある学校${counts.localCampusSchoolCount}校`,
    },
    {
      label: `${prefecture}内のキャンパス`,
      value: `${counts.localCampusLocationCount}か所`,
      hint: 'キャンパス・学習センター',
    },
    {
      label: '公立 / 私立 / サポート校',
      value: `${counts.publicCount} / ${counts.privateCount} / ${counts.supportCount}`,
    },
    {
      label: `${prefecture}内キャンパスの口コミ`,
      value: data.localReviewCount > 0 ? `${data.localReviewCount}件` : '—',
      hint: data.localReviewCount > 0 ? '実際に通った人の声' : 'まだ投稿がありません',
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

/** 掲載範囲・口コミ・学費の見方。数値の意味が分かるよう本文と同じ画面に置く */
function MethodologyNote({ data }: { data: PrefectureLandingData }) {
  const { counts, prefecture } = data;
  return (
    <section
      className="mb-8 rounded-xl border border-gray-200 bg-white p-4 md:p-5"
      aria-labelledby="pref-methodology-heading"
    >
      <h2 id="pref-methodology-heading" className="text-base font-bold text-gray-900 mb-2">
        このページに掲載している情報について
      </h2>
      <ul className="space-y-1.5 text-xs text-gray-600 leading-relaxed">
        <li>
          {prefecture}に本校がある学校、{prefecture}にキャンパスがある学校、{prefecture}を対応地域としている学校を掲載しています。
          入試や説明会だけに使う会場はキャンパスに含みません。
        </li>
        <li>
          口コミは、当サイトのアンケートに回答した在校生・卒業生・保護者の声で、公開前に内容を審査しています。
          主に通っていたキャンパスが{prefecture}内だった口コミを
          <strong className="font-semibold">{prefecture}内キャンパスの口コミ</strong>（{data.localReviewCount}件）、
          他県のキャンパスも含めた口コミを
          <strong className="font-semibold">学校全体の口コミ</strong>（{data.totalReviewCount}件）として分けて表示しています。
        </li>
        <li>
          学費は、学校が初年度納入金の目安を公開している場合だけ金額を載せています。「—」は金額が公開されていないか、
          コースや通学頻度で大きく変わる学校で、学費が安い・無料という意味ではありません。
        </li>
        {counts.admissionVerifiedCount > 0 && (
          <li>
            「全国から出願可」「スクーリング会場」などの表示は、学校公式サイト・募集要項・教育委員会の公表資料で確認できた内容です。
          </li>
        )}
        <li>所在地・最寄り駅・学費は変わることがあります。出願前に各学校の公式情報で最新の内容を確認してください。</li>
      </ul>
    </section>
  );
}

const RESULTS_ID = 'pref-school-results';

function toCardData(
  row: PrefectureSchoolRow,
  globalAverages: SchoolCardGlobalAverages | null
): RegionalSchoolCardData | null {
  if (!row.excerpt) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tier: 'a',
    institutionType: row.institutionType,
    headquartersPrefecture: row.headquartersPrefecture,
    wards: row.localCities,
    stations: row.localStations,
    highlights: row.highlights,
    regionalReviewCount: row.localReviewCount,
    cityReviewCount: 0,
    totalReviewCount: row.reviewCount,
    rating: row.overallAvg,
    ratingDiff: nationalAverageDiff(
      row.overallAvg,
      globalAverages?.overall_satisfaction_avg ?? null,
      row.reviewCount
    ),
    staffAvg: row.staffAvg,
    staffDiff: nationalAverageDiff(
      row.staffAvg,
      globalAverages?.staff_rating_avg ?? null,
      row.staffRatingCount
    ),
    defaultOrder: row.defaultOrder,
    tuition: row.tuition,
    admissionBadges: row.admissionBadges,
    excerpt: row.excerpt,
    areaFilterIds: row.areaFilterIds,
  };
}

function SkipListLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:text-blue-900"
    >
      {label}
    </a>
  );
}

/**
 * 全掲載校の一覧。県内の口コミがある学校はカードで声を紹介し、残りは軽い1行で並べる。
 * 全校をHTMLに出し、絞り込みは表示の切り替えだけにする（URLは変えない）。
 */
function SchoolList({
  data,
  globalAverages,
}: {
  data: PrefectureLandingData;
  globalAverages: SchoolCardGlobalAverages | null;
}) {
  const { prefecture, featuredRows, otherRows, counts, locationInsights } = data;
  const hasLocationSection =
    locationInsights.topCities.length > 0 || locationInsights.topStations.length > 0;
  const skipLink =
    counts.totalSchools > PREFECTURE_LIST_SKIP_LINK_MIN_SCHOOLS
      ? hasLocationSection
        ? { href: '#pref-location-insights-heading', label: '一覧を飛ばしてエリア・ランキングへ ↓' }
        : { href: '#pref-regional-voice-heading', label: '一覧を飛ばして口コミ・ランキングへ ↓' }
      : null;
  const nationalOverall = globalAverages?.overall_satisfaction_avg ?? null;

  return (
    <section id={RESULTS_ID} className="mb-8" aria-labelledby="pref-comparison-heading">
      <span id="pref-school-list" className="block scroll-mt-40" aria-hidden />
      <h2 id="pref-comparison-heading" className="text-xl font-bold text-gray-900 mb-2">
        {prefecture}の通信制高校・サポート校を一覧で比較
      </h2>
      <p className="text-sm text-gray-600 leading-relaxed max-w-4xl">
        {prefecture}内のキャンパス、最寄り駅、初年度納入金の目安、口コミ件数、総合満足度を学校ごとにまとめています。
        「{prefecture}内」の口コミは{prefecture}内のキャンパスに通った人の口コミ、「学校全体」は他県のキャンパスも含めた口コミです。
        満足度は学校全体の口コミの平均で、全国平均（当サイトに寄せられた全国の口コミの平均）との差も表示しています。
      </p>
      {skipLink && (
        <p className="mb-2">
          <SkipListLink {...skipLink} />
        </p>
      )}
      <div className="mt-3">
        {shouldShowPrefectureFinder(counts.totalSchools) && (
          <RegionalSchoolFinder
            targetId={RESULTS_ID}
            prefecture={prefecture}
            totalSchools={counts.totalSchools}
            areas={data.finderAreas}
            schoolTypes={data.schoolTypeOptions}
            heading="市区町村と学校の種類で絞る"
            headingLevel="h3"
            areaLegend="市区町村"
            areaNote="複数の市区町村にキャンパスがある学校は、それぞれに数えています。"
            areaLinks={data.cityLandings.map((city) => ({
              href: appPath(city.path),
              label: `${city.municipality}の通信制高校ページを見る`,
            }))}
            scrollAreasOnMobile
            groupedSortNote={
              featuredRows.length > 0 && otherRows.length > 0
                ? '口コミを紹介している学校と、そのほかの掲載校は、それぞれの中で並べ替えます。'
                : undefined
            }
          />
        )}
      </div>

      {featuredRows.length > 0 && (
        <div data-regional-group="featured" className="mb-10">
          <h3 id="pref-featured-heading" className="text-lg font-bold text-gray-900">
            {prefecture}のキャンパスに通った人の口コミがある学校
          </h3>
          <p className="mt-1 mb-4 text-sm text-gray-600 leading-relaxed">
            {prefecture}内の口コミが多い順に、最大{PREFECTURE_REGIONAL_CARD_LIMIT}校の声を紹介しています。
            {data.localReviewSchoolCount > featuredRows.length &&
              `ほかの学校の${prefecture}内の口コミ件数は、下の一覧に載せています。`}
          </p>
          <ul className="space-y-5" data-regional-list>
            {featuredRows.map((row) => {
              const card = toCardData(row, globalAverages);
              return card ? (
                <RegionalSchoolCard
                  key={row.id}
                  school={card}
                  prefecture={prefecture}
                  showFullReviewLink
                  nameHeadingLevel="h4"
                />
              ) : null;
            })}
          </ul>
        </div>
      )}

      {otherRows.length > 0 && (
        <div data-regional-group="others">
          {featuredRows.length > 0 && (
            <h3 className="mb-2 text-lg font-bold text-gray-900">そのほかの掲載校</h3>
          )}
          <ul className="border-t border-gray-200" data-regional-list>
            {otherRows.map((row) => (
              <PrefectureSchoolListRow
                key={row.id}
                school={row}
                prefecture={prefecture}
                ratingDiff={nationalAverageDiff(row.overallAvg, nationalOverall, row.reviewCount)}
              />
            ))}
          </ul>
        </div>
      )}

      {skipLink && (
        <p className="mt-2">
          <SkipListLink {...skipLink} />
        </p>
      )}
      <p className="mt-2 text-xs text-gray-500">
        「—」の学費は、学校が金額を公開していないか、コースや通学頻度によって大きく変わる学校です。資料請求や個別相談で確認できます。
      </p>
      <TuitionDisclaimer className="mt-2" />
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
            <span className="shrink-0 text-xs text-gray-500">
              学校全体{entry.row.reviewCount}件
            </span>
          </li>
        ))}
      </ol>
    </PrefectureSchoolCardTracker>
  );
}

function LocationInsightsSection({
  prefecture,
  insights,
  cityLandings,
}: {
  prefecture: string;
  insights: PrefectureLocationInsights;
  cityLandings: PrefectureLandingData['cityLandings'];
}) {
  if (insights.topCities.length === 0 && insights.topStations.length === 0) return null;

  const prefParam = encodeURIComponent(prefecture);
  const cityLandingPathByName = new Map(cityLandings.map((city) => [city.municipality, city.path]));

  return (
    <section
      className="mb-8 rounded-xl border border-blue-100 bg-white p-5 md:p-6"
      aria-labelledby="pref-location-insights-heading"
    >
      <h2 id="pref-location-insights-heading" className="text-xl font-bold text-gray-900 mb-2">
        {prefecture}の通信制高校をエリア・最寄り駅から探す
      </h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-5 max-w-4xl">
        {prefecture}では{insights.cityCount}市区町村に通信制高校・サポート校のキャンパスがあります。
        通学のしやすさから絞り込みたい場合は、市区町村または最寄り駅から候補校を確認してください。
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {insights.topCities.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">市区町村から探す</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {insights.topCities.map((city) => {
                const cityParam = encodeURIComponent(city.city);
                const cityLandingPath = cityLandingPathByName.get(city.city);
                return (
                  <li key={city.city}>
                    <Link
                      href={
                        cityLandingPath
                          ? appPath(cityLandingPath)
                          : appPath(`/schools?campus_prefecture=${prefParam}&campus_city=${cityParam}`)
                      }
                      rel={cityLandingPath ? undefined : 'nofollow'}
                      className="block h-full rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2.5 hover:border-blue-300 hover:bg-blue-50/70 transition-colors"
                    >
                      <span className="block text-sm font-bold text-blue-700">
                        {prefecture}
                        {city.city}
                      </span>
                      <span className="block text-xs text-gray-600 leading-relaxed">
                        {city.schoolCount}校 / キャンパス{city.campusCount}か所
                        {city.nearestStations.length > 0
                          ? ` / 最寄り: ${city.nearestStations.join('・')}`
                          : ''}
                      </span>
                      {city.wards.length > 0 && (
                        <span className="block text-[11px] text-gray-500 leading-relaxed mt-0.5">
                          {city.wards
                            .map((ward) => `${ward.name}${ward.schoolCount}校`)
                            .join(' / ')}
                        </span>
                      )}
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
            <ul className="grid gap-2">
              {insights.topStations.map((station) => (
                <li
                  key={station.name}
                  className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2"
                >
                  <Link
                    href="#pref-comparison-heading"
                    className="text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                  >
                    {station.name}から通える{station.schoolCount}校を比較する
                  </Link>
                  <span className="block text-[11px] text-gray-500 leading-relaxed">
                    {[station.lines.join('・'), station.cities.join('・')]
                      .filter(Boolean)
                      .join(' / ')}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-500 leading-relaxed">
              通学頻度や必須スクーリングの場所は学校詳細で確認してください。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

/** その都道府県のキャンパスに通った回答だけを使う。競合が持てない一次データを地域の根拠にする */
function RegionalVoiceSection({ data }: { data: PrefectureLandingData }) {
  const { prefecture, regionalReviewSummary: summary } = data;
  const prefParam = encodeURIComponent(prefecture);

  if (summary.reviewCount === 0) {
    return (
      <section
        className="mb-8 rounded-xl border border-gray-200 bg-white p-5 md:p-6"
        aria-labelledby="pref-regional-voice-heading"
      >
        <h2 id="pref-regional-voice-heading" className="text-xl font-bold text-gray-900 mb-2">
          {prefecture}のキャンパスに通った人の回答
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          {prefecture}のキャンパスを回答した口コミはまだありません。掲載校の学校全体の口コミは
          {data.totalReviewCount}件あり、上の一覧の口コミ件数と学校詳細で確認できます。
        </p>
      </section>
    );
  }

  const distributions: Array<{ heading: string; note: string; items: Array<{ label: string; count: number }> }> = [
    {
      heading: '通学頻度の回答内訳',
      note: '同じ学校でもコースによって通学頻度は変わります。一覧と学校詳細で条件を確認してください。',
      items: summary.attendanceFrequencies,
    },
    {
      heading: '入学タイミングの回答内訳',
      note: '転入・編入の受け入れ時期は学校ごとに異なるため、募集要項で確認が必要です。',
      items: summary.enrollmentTypes,
    },
  ];

  return (
    <section
      className="mb-8 rounded-xl border border-blue-100 bg-white p-5 md:p-6"
      aria-labelledby="pref-regional-voice-heading"
    >
      <h2 id="pref-regional-voice-heading" className="text-xl font-bold text-gray-900 mb-2">
        {prefecture}のキャンパスに通った人の口コミ
      </h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-5 max-w-4xl">
        {prefecture}のキャンパスに通った人の口コミは{summary.reviewCount}件（
        {summary.schoolCount}校）です。
        {summary.overallAvg != null && `この口コミだけで見た総合満足度は${summary.overallAvg.toFixed(1)}（5点満点）です。`}
        他県のキャンパスに通った人の口コミは含みません。
      </p>
      {data.featuredRows.length > 0 && (
        <p className="mb-5 text-sm text-gray-700">
          学校ごとの口コミは、上の一覧で{data.featuredRows.length}校分を紹介しています。
          <a
            href="#pref-featured-heading"
            className="ml-1 font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:text-blue-900"
          >
            上の学校別の声を見る
          </a>
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {distributions.map(({ heading, note, items }) =>
          items.length === 0 ? null : (
            <div key={heading} className="rounded-lg border border-gray-100 bg-gray-50/70 p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-2">{heading}</h3>
              <ul className="space-y-1.5">
                {items.map((item) => {
                  const share = Math.round((item.count / summary.reviewCount) * 100);
                  return (
                    <li key={item.label} className="text-xs text-gray-700">
                      <span className="flex items-baseline justify-between gap-2">
                        <span>{item.label}</span>
                        <span className="shrink-0 font-semibold text-gray-900">
                          {item.count}件
                          <span className="ml-1 font-normal text-gray-500">{share}%</span>
                        </span>
                      </span>
                      <span
                        className="mt-1 block h-1 rounded bg-blue-200"
                        style={{ width: `${Math.max(share, 2)}%` }}
                        aria-hidden
                      />
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[11px] text-gray-500 leading-relaxed">{note}</p>
            </div>
          )
        )}
      </div>
      <Link
        href={appPath(`/reviews?prefecture=${prefParam}`)}
        className="mt-4 inline-block text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
      >
        {prefecture}の口コミ本文を読む
      </Link>
    </section>
  );
}

/** 初年度納入金の目安を公開している学校だけを並べる。金額のない学校を安いと誤読させない */
function TuitionSection({ data }: { data: PrefectureLandingData }) {
  const { prefecture, tuitionRows, counts } = data;

  return (
    <section
      className="mb-8 rounded-xl border border-gray-200 bg-white p-5 md:p-6"
      aria-labelledby="pref-tuition-heading"
    >
      <h2 id="pref-tuition-heading" className="text-xl font-bold text-gray-900 mb-2">
        {prefecture}の通信制高校の学費（初年度納入金の目安）
      </h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-4 max-w-4xl">
        通信制高校の学費は、コース、通学頻度、履修単位数、就学支援金の適用、サポート校の併用、スクーリングの交通・宿泊費で大きく変わります。
        {tuitionRows.length > 0
          ? `初年度納入金の目安を公開している${tuitionRows.length}校を並べています。就学支援金の適用前・適用後が学校によって違うため、金額と一緒に確認してください。`
          : `${prefecture}の掲載校では、比較できる形で初年度納入金を公開している学校がまだありません。気になる学校は資料請求や個別相談で確認してください。`}
      </p>
      {tuitionRows.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tuitionRows.map((row) => (
            <li key={row.id} className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2.5 text-sm">
              <SchoolNameCell row={row} />
              <span className="mt-0.5 block text-gray-800">
                <TuitionCell tuition={row.tuition} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-gray-500 leading-relaxed">
        公立{counts.publicCount}校と私立{counts.privateCount}校、サポート校
        {counts.supportCount}校は費用の考え方が異なります。サポート校の費用は提携する通信制高校の
        学費とは別にかかるため、合算して比較してください。
      </p>
      <TuitionDisclaimer className="mt-3" />
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
        公立・私立・サポート校は、費用の考え方も卒業資格の仕組みも異なります。一覧の学校名の横にある種別とあわせて確認してください。
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
    localReviewCount: data.localReviewCount,
    localReviewSchoolCount: data.localReviewSchoolCount,
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
                    学校の一覧を見る
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
                {data.cityLandings.map((city) => (
                  <li key={city.path}>
                    <Link
                      href={appPath(city.path)}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                    >
                      {city.municipality}の通信制高校を区・駅から比較する
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href={
                      data.featuredRows.length > 0
                        ? '#pref-featured-heading'
                        : '#pref-regional-voice-heading'
                    }
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {prefecture}のキャンパスに通った人の口コミを読む
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
                  <Link
                    href="#pref-tuition-heading"
                    className="text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    学費の目安を見る
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

            <SchoolList data={data} globalAverages={globalAverages} />

            <LocationInsightsSection
              prefecture={prefecture}
              insights={data.locationInsights}
              cityLandings={data.cityLandings}
            />

            <RegionalVoiceSection data={data} />

            <section className="mb-8" aria-labelledby="pref-rankings-heading">
              <h2 id="pref-rankings-heading" className="text-xl font-bold text-gray-900 mb-2">
                {prefecture}の口コミ評価から見る学校
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                口コミが{PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING}
                件以上ある学校を対象に、観点ごとの平均が高い順に並べています（学費満足度は金額ではなく納得感の評価です）。
                「{prefecture}内の口コミが多い学校」は{prefecture}内キャンパスの口コミ件数、ほかの3つは他県を含む学校全体の口コミの平均で並べています。
              </p>
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">
                    {prefecture}内の口コミが多い学校
                  </h3>
                  <RankingList
                    prefecture={prefecture}
                    block="top_local_reviews"
                    entries={data.topByLocalReviewCount}
                    emptyMessage={`${prefecture}内のキャンパスに通った人の口コミはまだありません。`}
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

            <TuitionSection data={data} />

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
