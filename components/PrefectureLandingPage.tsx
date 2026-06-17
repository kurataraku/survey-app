import Link from 'next/link';
import type { ComponentProps } from 'react';
import SchoolCardServer from '@/components/SchoolCardServer';
import PrefectureLandingFaq from '@/components/PrefectureLandingFaq';
import PrefectureLandingTrackedLink from '@/components/PrefectureLandingTrackedLink';
import PrefectureSchoolCardTracker from '@/components/PrefectureSchoolCardTracker';
import { appPath } from '@/lib/base-path';
import type { PrefectureFaqStats } from '@/lib/prefectures/prefecture-landing-schema';
import type { SearchSchool } from '@/lib/schools/searchSchools';
import type { PrefectureAttendanceLink } from '@/lib/schools/prefecture-landing-attendance';
import type { SchoolInstitutionType } from '@/lib/types/schools';
import {
  buildReasonGroupReviewsPath,
  REVIEW_REASON_GROUPS,
} from '@/lib/reviews/reason-groups';
import ThemeHubNav from '@/components/ThemeHubNav';
import {
  getPrefectureLandingHeading,
  getPrefectureLandingMediaStrengths,
  getPrefectureLandingMediaStrengthsLead,
  getPrefectureLandingSubtitle,
} from '@/lib/prefectures/prefecture-landing-copy';
import { getPrefectureParentGuidePoints } from '@/lib/prefectures/prefecture-parent-guide';
import RequestNotificationCta from '@/components/RequestNotificationCta';
import TuitionDisclaimer from '@/components/TuitionDisclaimer';
import { GA_EVENTS } from '@/lib/analytics/events';
import { PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING } from '@/lib/schools/prefecture-landing-constants';

type SchoolCardGlobalAverages = NonNullable<
  ComponentProps<typeof SchoolCardServer>['globalAverages']
>;

const PREFECTURE_HIGHLIGHT_PREVIEW_LIMIT = 3;

interface PrefectureLandingPageProps {
  prefecture: string;
  introLead: string;
  totalSchools: number;
  schoolsWithReviewsCount: number;
  totalReviewCount: number;
  averageOverallSatisfaction: number | null;
  averageTuitionSatisfaction: number | null;
  topByReviewCount: SearchSchool[];
  topByRating: SearchSchool[];
  topBySupport: SearchSchool[];
  topByTuition: SearchSchool[];
  schoolsByInstitutionType: Record<SchoolInstitutionType, SearchSchool[]>;
  attendanceFrequencyLinks: PrefectureAttendanceLink[];
  globalAverages: SchoolCardGlobalAverages | null;
  children: React.ReactNode;
  hasSchools: boolean;
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
      href: appPath(`/schools?campus_prefecture=${prefParam}`),
      label: `${prefecture}の通信制高校をキャンパス所在地で絞り込む`,
      description: 'キャンパス所在地の都道府県・市区町村で学校を探せます。',
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
      <p className="text-lg font-bold text-gray-900 mb-2">{prefecture}の通信制高校をさらに探す</p>
      <p className="text-sm text-gray-600 mb-4">
        条件やキャンパス所在地を変えて探したい方は、次のページも確認してください。
      </p>
      <ul className="grid gap-3 md:grid-cols-3">
        {links.map(({ href, label, description }) => (
          <li key={`${href}-${label}`}>
            <Link
              href={href}
              className="block h-full rounded-lg border border-gray-100 bg-gray-50/70 p-4 hover:border-blue-300 hover:bg-blue-50/70 transition-colors"
            >
              <span className="block text-sm font-bold text-blue-700 mb-1">{label}</span>
              <span className="block text-xs text-gray-600 leading-relaxed">
                {description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

type StatCard = {
  label: string;
  value: string;
  hint?: string;
  /** 点数の横に表示する全国平均との差（例: (+0.2)） */
  nationalDiff?: { label: string; className: string };
};

function formatNationalDiffLabel(
  local: number | null,
  national: number | null
): { label: string; className: string } | undefined {
  if (local == null || national == null) return undefined;
  const diff = parseFloat((local - national).toFixed(1));
  const label = diff > 0 ? `(+${diff.toFixed(1)})` : diff < 0 ? `(${diff.toFixed(1)})` : '(±0.0)';
  const className =
    diff > 0.05 ? 'text-emerald-600' : diff < -0.05 ? 'text-rose-500' : 'text-gray-500';
  return { label, className };
}

function SummaryStats({
  totalSchools,
  totalReviewCount,
  averageOverallSatisfaction,
  averageTuitionSatisfaction,
  globalAverages,
}: {
  totalSchools: number;
  totalReviewCount: number;
  averageOverallSatisfaction: number | null;
  averageTuitionSatisfaction: number | null;
  globalAverages: SchoolCardGlobalAverages | null;
}) {
  const cards: StatCard[] = [
    { label: '掲載校数', value: `${totalSchools}校` },
    {
      label: '口コミ総数',
      value: totalReviewCount > 0 ? `${totalReviewCount}件` : '—',
    },
    {
      label: '平均総合満足度',
      value: averageOverallSatisfaction != null ? averageOverallSatisfaction.toFixed(1) : '—',
      hint: '5点満点・±は全国平均比',
      nationalDiff: formatNationalDiffLabel(
        averageOverallSatisfaction,
        globalAverages?.overall_satisfaction_avg ?? null
      ),
    },
    {
      label: '平均学費満足度',
      value: averageTuitionSatisfaction != null ? averageTuitionSatisfaction.toFixed(1) : '—',
      hint: '5点満点・±は全国平均比',
      nationalDiff: formatNationalDiffLabel(
        averageTuitionSatisfaction,
        globalAverages?.tuition_rating_avg ?? null
      ),
    },
  ];

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-gray-200 bg-white px-4 py-3 min-h-[4.5rem] flex flex-col justify-center"
          >
            <p className="text-xs text-gray-500 mb-0.5 leading-snug">{card.label}</p>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <p className="text-lg font-bold text-gray-900">{card.value}</p>
              {card.nationalDiff && (
                <span className={`text-sm font-medium ${card.nationalDiff.className}`}>
                  {card.nationalDiff.label}
                </span>
              )}
            </div>
            {card.hint && (
              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{card.hint}</p>
            )}
          </div>
        ))}
      </div>
    </div>
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
      <p className="text-sm text-gray-600 leading-relaxed mb-5 max-w-3xl">
        口コミだけでなく、通い方・学費・サポート体制など、選校前に押さえておきたい観点を整理しました。
        詳しいテーマ別ガイドはページ下部のリンクからも確認できます。
      </p>
      <ul className="grid gap-4 md:grid-cols-2">
        {points.map((point) => (
          <li
            key={point.title}
            className="rounded-lg border border-gray-100 bg-gray-50/70 p-4"
          >
            <h3 className="text-sm font-bold text-gray-900 mb-1.5">{point.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{point.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MediaStrengths({ prefecture }: { prefecture: string }) {
  const items = getPrefectureLandingMediaStrengths(prefecture);
  return (
    <section
      className="mb-8 rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50/60 p-6 md:p-8 shadow-sm"
      aria-labelledby="pref-strengths-heading"
    >
      <h2 id="pref-strengths-heading" className="text-xl font-bold text-gray-900 mb-2">
        良い口コミだけでは選ばない。リアルレビューで比較する理由
      </h2>
      <p className="text-sm text-gray-700 leading-relaxed mb-6 max-w-5xl">
        {getPrefectureLandingMediaStrengthsLead(prefecture).map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </p>
      <ul className="grid gap-5 md:grid-cols-3">
        {items.map((item, index) => (
          <li
            key={item.title}
            className="rounded-lg border border-blue-100 bg-white/90 p-4 shadow-sm"
          >
            <p className="text-xs font-bold text-blue-700 mb-2">POINT {index + 1}</p>
            <h3 className="text-base font-bold text-gray-900 mb-2 leading-snug">{item.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{item.description}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PrefectureIntroSection({
  prefecture,
  introLead,
}: {
  prefecture: string;
  introLead: string;
}) {
  return (
    <section
      className="mt-10 mb-8 rounded-xl border border-gray-200 bg-white p-5 md:p-6"
      aria-labelledby="pref-intro-heading"
    >
      <h2 id="pref-intro-heading" className="text-xl font-bold text-gray-900 mb-3">
        {prefecture}の通信制高校を口コミで比較するポイント
      </h2>
      <p className="text-sm sm:text-base text-gray-600 leading-relaxed max-w-4xl">
        {introLead}
      </p>
    </section>
  );
}

function SchoolHighlightGrid({
  prefecture,
  block,
  schools,
  globalAverages,
  emptyMessage,
  primaryMetric = 'overall',
}: {
  prefecture: string;
  block: string;
  schools: SearchSchool[];
  globalAverages: SchoolCardGlobalAverages | null;
  emptyMessage: string;
  primaryMetric?: 'overall' | 'reviews' | 'support' | 'tuition';
}) {
  const visibleSchools = schools.slice(0, PREFECTURE_HIGHLIGHT_PREVIEW_LIMIT);
  if (visibleSchools.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>;
  }
  return (
    <PrefectureSchoolCardTracker prefecture={prefecture} block={block}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleSchools.map((school) => (
          <SchoolCardServer
            key={school.id}
            id={school.id}
            name={school.name}
            prefecture={school.prefecture}
            institutionType={school.institution_type}
            campusLocations={school.campus_locations}
            matchedPrefecture={prefecture}
            prefectures={school.prefectures ?? undefined}
            hidePrefectureUnderFilter
            slug={school.slug}
            highlights={school.highlights ?? undefined}
            intro={school.intro ?? undefined}
            reviewCount={school.review_count}
            overallAvg={school.overall_avg}
            flexibilityAvg={school.flexibility_avg ?? undefined}
            staffAvg={school.staff_avg ?? undefined}
            supportAvg={school.support_avg ?? undefined}
            atmosphereAvg={school.atmosphere_avg ?? undefined}
            creditAvg={school.credit_avg ?? undefined}
            uniqueCourseAvg={school.unique_course_avg ?? undefined}
            careerSupportAvg={school.career_support_avg ?? undefined}
            campusLifeAvg={school.campus_life_avg ?? undefined}
            tuitionAvg={school.tuition_avg ?? undefined}
            tuitionEstimate={school.tuition_estimate ?? undefined}
            courseListing={school.course_listing ?? undefined}
            latestGoodComment={school.latest_good_comment ?? undefined}
            latestBadComment={school.latest_bad_comment ?? undefined}
            reviewExcerpts={school.review_excerpts}
            reviewTendency={school.review_tendency ?? undefined}
            primaryMetric={primaryMetric}
            globalAverages={globalAverages ?? undefined}
          />
        ))}
      </div>
    </PrefectureSchoolCardTracker>
  );
}

const institutionTypeGuides: Record<SchoolInstitutionType, { title: string; description: string }> = {
  public: {
    title: '公立通信制高校',
    description:
      '公立の通信制高校は、学費負担を抑えやすい一方で、登校日数・レポート提出・スクーリングの場所などを自分で管理する場面もあります。口コミでは、単位取得のしやすさ、先生・職員の対応、通学頻度の実態を確認してみてください。',
  },
  private: {
    title: '私立通信制高校',
    description:
      '私立の通信制高校は、通学コースやオンライン学習、個別サポート、進路支援などの選択肢が学校ごとに大きく異なります。口コミでは、学びの柔軟さ、サポート体制、進路サポート、学費の納得感を見比べると選びやすくなります。',
  },
  support: {
    title: 'サポート校',
    description:
      'サポート校は、提携する通信制高校の学習支援や通学サポート、個別フォローを行う施設です。検討時は提携校、卒業資格の仕組み、通学頻度、サポート内容を公式情報と口コミの両方で確認してください。',
  },
};

function InstitutionTypeSection({
  prefecture,
  type,
  schools,
  globalAverages,
}: {
  prefecture: string;
  type: SchoolInstitutionType;
  schools: SearchSchool[];
  globalAverages: SchoolCardGlobalAverages | null;
}) {
  const guide = institutionTypeGuides[type];
  return (
    <section className="mb-10" aria-labelledby={`pref-institution-${type}-heading`}>
      <h2 id={`pref-institution-${type}-heading`} className="text-xl font-bold text-gray-900 mb-3">
        {prefecture}の{guide.title}
      </h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-3">
        {guide.description}
      </p>
      {schools.length > 0 ? (
        <SchoolHighlightGrid
          prefecture={prefecture}
          block={`institution_${type}`}
          schools={schools}
          globalAverages={globalAverages}
          emptyMessage=""
        />
      ) : (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
          この区分の学校はまだ登録されていません。
        </p>
      )}
    </section>
  );
}

export default function PrefectureLandingPage({
  prefecture,
  introLead,
  totalSchools,
  schoolsWithReviewsCount,
  totalReviewCount,
  averageOverallSatisfaction,
  averageTuitionSatisfaction,
  topByReviewCount,
  topByRating,
  topBySupport,
  topByTuition,
  schoolsByInstitutionType,
  attendanceFrequencyLinks,
  globalAverages,
  children,
  hasSchools,
}: PrefectureLandingPageProps) {
  const faqStats: PrefectureFaqStats = {
    totalSchools,
    schoolsWithReviewsCount,
    totalReviewCount,
    averageOverallSatisfaction,
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
          <Link href={appPath('/schools')} className="text-blue-600 hover:text-blue-700 mb-4 inline-block text-sm">
            ← 学校検索に戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">
            {getPrefectureLandingHeading(prefecture)}
          </h1>
          <p className="text-sm text-gray-500 mt-2">{getPrefectureLandingSubtitle(prefecture)}</p>
        </div>

        {hasSchools && (
          <>
            <SummaryStats
              totalSchools={totalSchools}
              totalReviewCount={totalReviewCount}
              averageOverallSatisfaction={averageOverallSatisfaction}
              averageTuitionSatisfaction={averageTuitionSatisfaction}
              globalAverages={globalAverages}
            />

            <nav
              className="mb-6 rounded-xl border border-blue-100 bg-white px-4 py-3 sm:px-5 sm:py-4"
              aria-label={`${prefecture}の通信制高校比較で次に見るページ`}
            >
              <p className="text-sm font-semibold text-gray-900 mb-2">
                すぐに学校を比較する
              </p>
              <p className="hidden sm:block text-sm text-gray-600 leading-relaxed mb-3">
                {prefecture}の学校を、重視したい条件や口コミの見方から絞り込めます。まずは気になる切り口から確認してください。
              </p>
              <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <li>
                  <Link href="#pref-highlights-reviews" className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                    口コミが多い学校を見る
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
                  <Link href="#pref-highlights-rating" className="text-blue-600 hover:text-blue-800 hover:underline">
                    総合満足度が高い学校を見る
                  </Link>
                </li>
                <li>
                  <Link href="#pref-highlights-support" className="text-blue-600 hover:text-blue-800 hover:underline">
                    サポートが手厚い学校を見る
                  </Link>
                </li>
                <li>
                  <Link href="#pref-highlights-tuition" className="text-blue-600 hover:text-blue-800 hover:underline">
                    学費満足度が高い学校を見る
                  </Link>
                </li>
                <li>
                  <Link href={appPath(`/reviews?prefecture=${prefParam}`)} className="text-blue-600 hover:text-blue-800 hover:underline">
                    {prefecture}の通信制高校の口コミ一覧を見る
                  </Link>
                </li>
                <li>
                  <Link href="#pref-school-list" className="text-blue-600 hover:text-blue-800 hover:underline">
                    学校一覧を見る
                  </Link>
                </li>
              </ul>
            </nav>

            <span id="pref-highlights-reviews" className="block scroll-mt-40" aria-hidden />
            <section className="mb-8" aria-labelledby="pref-highlights-reviews-heading">
              <h2 id="pref-highlights-reviews-heading" className="text-xl font-bold text-gray-900 mb-4">
                {prefecture}の口コミが多い学校
              </h2>
              <p className="text-sm text-gray-600 mb-4">公開口コミの件数が多い順です。</p>
              <SchoolHighlightGrid
                prefecture={prefecture}
                block="top_reviews"
                schools={topByReviewCount}
                globalAverages={globalAverages}
                primaryMetric="reviews"
                emptyMessage="口コミが掲載されている学校がまだありません。"
              />
            </section>

            <span id="pref-highlights-rating" className="block scroll-mt-40" aria-hidden />
            <section className="mb-8" aria-labelledby="pref-highlights-rating-heading">
              <h2 id="pref-highlights-rating-heading" className="text-xl font-bold text-gray-900 mb-4">
                {prefecture}の総合満足度が高い通信制高校ベスト3
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                口コミが{PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING}件以上あり、総合満足度の平均が高い順です。
              </p>
              <SchoolHighlightGrid
                prefecture={prefecture}
                block="top_rating"
                schools={topByRating}
                globalAverages={globalAverages}
                primaryMetric="overall"
                emptyMessage="条件を満たす学校がまだありません。"
              />
            </section>

            <span id="pref-highlights-support" className="block scroll-mt-40" aria-hidden />
            <section className="mb-8" aria-labelledby="pref-highlights-support-heading">
              <h2 id="pref-highlights-support-heading" className="text-xl font-bold text-gray-900 mb-4">
                {prefecture}のサポートが手厚い通信制高校ベスト3
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                口コミが{PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING}件以上あり、「心や体調の波・不安などに対するサポート」の平均評価が高い順です。
              </p>
              <SchoolHighlightGrid
                prefecture={prefecture}
                block="top_support"
                schools={topBySupport}
                globalAverages={globalAverages}
                primaryMetric="support"
                emptyMessage="サポート評価の口コミが十分にある学校がまだありません。"
              />
            </section>

            <span id="pref-highlights-tuition" className="block scroll-mt-40" aria-hidden />
            <section className="mb-8" aria-labelledby="pref-highlights-tuition-heading">
              <h2 id="pref-highlights-tuition-heading" className="text-xl font-bold text-gray-900 mb-4">
                {prefecture}の学費満足度が高い通信制高校ベスト3
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                口コミが{PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING}件以上あり、学費満足度の平均が高い順です。
              </p>
              <SchoolHighlightGrid
                prefecture={prefecture}
                block="top_tuition"
                schools={topByTuition}
                globalAverages={globalAverages}
                primaryMetric="tuition"
                emptyMessage="学費満足度の口コミが十分にある学校がまだありません。"
              />
              <TuitionDisclaimer className="mt-4" />
            </section>

            <ParentGuideSection prefecture={prefecture} />

            <MediaStrengths prefecture={prefecture} />

            <InstitutionTypeSection
              prefecture={prefecture}
              type="public"
              schools={schoolsByInstitutionType.public}
              globalAverages={globalAverages}
            />
            <InstitutionTypeSection
              prefecture={prefecture}
              type="private"
              schools={schoolsByInstitutionType.private}
              globalAverages={globalAverages}
            />
            <InstitutionTypeSection
              prefecture={prefecture}
              type="support"
              schools={schoolsByInstitutionType.support}
              globalAverages={globalAverages}
            />

            <span id="pref-school-list" className="block scroll-mt-40" aria-hidden />
            <h2 className="text-xl font-bold text-gray-900 mb-4">{prefecture}の通信制高校一覧</h2>
          </>
        )}

        <PrefectureSchoolCardTracker prefecture={prefecture} block="list">
          {children}
        </PrefectureSchoolCardTracker>

        {hasSchools && (
          <PrefectureIntroSection prefecture={prefecture} introLead={introLead} />
        )}

        {hasSchools && <PrefectureLandingFaq prefecture={prefecture} stats={faqStats} />}

        {hasSchools && (
          <>
            <section
              className="mt-10 mb-10 rounded-xl border border-gray-200 bg-white p-5 md:p-6"
              aria-labelledby="pref-attendance-heading"
            >
              <h2 id="pref-attendance-heading" className="text-xl font-bold text-gray-900 mb-3">
                {prefecture}の通信制高校の口コミを通学頻度で探す
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                {prefecture}の学校に関する口コミを、週何日通ったか・オンライン中心だったかで絞り込めます。
                自分が考えている通い方に近い口コミを確認してください。
              </p>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {attendanceFrequencyLinks.map(({ label, href }) => (
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
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                アンケートで回答された「通信制を選んだ理由」ごとに、{prefecture}の口コミを絞り込めます。
                不登校経験と断定せず、心の不調・人間関係・学習スタイルなど、近い悩みを持つ方の声として参考にしてください。
              </p>
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
