import Link from 'next/link';
import RegionalSchoolCard, {
  type RegionalSchoolCardData,
} from '@/components/RegionalSchoolCard';
import RegionalSchoolFinder from '@/components/RegionalSchoolFinder';
import RegionalSchoolListRow, {
  type RegionalSchoolListRowData,
} from '@/components/RegionalSchoolListRow';
import RequestNotificationCta from '@/components/RequestNotificationCta';
import TuitionDisclaimer from '@/components/TuitionDisclaimer';
import { appPath } from '@/lib/base-path';
import { getPrefecturePath } from '@/lib/prefectures';
import {
  buildCityFaqItems,
  getCityLandingHeading,
  getCityLandingSubtitle,
} from '@/lib/regions/city-landing-copy';
import { buildReasonGroupReviewsPath, REVIEW_REASON_GROUPS } from '@/lib/reviews/reason-groups';
import type { CityLandingData, CitySchoolRow } from '@/lib/schools/getCityLandingData';
import { getPrefectureAttendanceFrequencyLinks } from '@/lib/schools/prefecture-landing-attendance';

interface CityLandingPageProps {
  data: CityLandingData;
  intro: string;
}

const RESULTS_ID = 'city-school-results';

function toCardData(row: CitySchoolRow): RegionalSchoolCardData | null {
  if (!row.excerpt || row.tier !== 'a') return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tier: row.tier,
    institutionType: row.institutionType,
    headquartersPrefecture: row.headquartersPrefecture,
    stations: row.stations,
    regionalReviewCount: row.prefectureReviewCount,
    totalReviewCount: row.reviewCount,
    rating: row.overallAvg,
    defaultOrder: row.defaultOrder,
    staffAvg: row.staffAvg,
    atmosphereAvg: row.atmosphereAvg,
    ratingScopeLabel: row.ratingScopeLabel,
    tuition: row.tuition,
    admissionBadges: row.admissionBadges,
    excerpt: row.excerpt,
    stationFilterIds: row.stationFilterIds,
  };
}

function toListData(row: CitySchoolRow): RegionalSchoolListRowData {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tier: row.tier,
    institutionType: row.institutionType,
    stations: row.stations,
    regionalReviewCount: row.prefectureReviewCount,
    totalReviewCount: row.reviewCount,
    rating: row.overallAvg,
    defaultOrder: row.defaultOrder,
    tuition: row.tuition,
    excerpt: row.listExcerpt,
    stationFilterIds: row.stationFilterIds,
  };
}

const ATTENDANCE_THEME_LABELS: Record<string, string> = {
  '週1〜2': '週1〜2日で通った人',
  '月1〜数回': '月に数回通った人',
  'ほぼオンライン/自宅': 'ほぼ自宅・オンラインで学んだ人',
};

const REASON_THEME_LABELS: Record<string, string> = {
  mental_relationship: '人間関係や心の不調がきっかけの人',
  learning_style: '全日制の学び方が合わなかった人',
  health_development: '心身の状態や発達特性がきっかけの人',
};

function ThemeReviewLinks({ prefecture }: { prefecture: string }) {
  const links = [
    ...getPrefectureAttendanceFrequencyLinks(prefecture)
      .filter((link) => ATTENDANCE_THEME_LABELS[link.label])
      .map((link) => ({ label: ATTENDANCE_THEME_LABELS[link.label], href: link.href })),
    ...REVIEW_REASON_GROUPS.map((group) => ({
      label: REASON_THEME_LABELS[group.key] ?? group.shortLabel,
      href: buildReasonGroupReviewsPath(prefecture, group),
    })),
  ];
  return (
    <section
      className="mb-12 border-t border-blue-100 pt-9"
      aria-labelledby="city-theme-reviews-heading"
    >
      <h2 id="city-theme-reviews-heading" className="text-2xl font-bold text-gray-950">
        テーマ別に口コミを読む
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
        {prefecture}内のキャンパスに通った人の口コミを、通い方や通信制を選んだきっかけ別にまとめて読めます。
      </p>
      <ul className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              prefetch={false}
              className="inline-flex min-h-11 items-center font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:text-blue-900"
            >
              {link.label}の口コミ →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AreaGuide({ data }: { data: CityLandingData }) {
  if (data.wards.length === 0 && data.topStations.length === 0) return null;
  return (
    <section
      className="mb-12 border-t border-blue-100 pt-9"
      aria-labelledby="city-area-heading"
    >
      <h2 id="city-area-heading" className="text-2xl font-bold text-gray-950">
        {data.wards.length > 0 ? '区・駅' : '駅'}から通いやすさを見る
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
        登録されているキャンパス所在地をもとにした件数です。主な駅は上の絞り込みでも選べます。
      </p>
      {data.wards.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-bold text-gray-800">キャンパスがある区</h3>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-700">
            {data.wards.map((ward) => (
              <li key={ward.name}>
                {ward.name} <span className="text-gray-500">{ward.schoolCount}校</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.topStations.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-bold text-gray-800">主な最寄り駅</h3>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {data.topStations.slice(0, 12).map((station) => (
              <li key={station.name}>
                <a
                  href={`#${RESULTS_ID}-finder-heading`}
                  className="font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:text-blue-900"
                >
                  {station.name}
                </a>
                <span className="ml-1 text-gray-500">{station.schoolCount}校</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function AboutNote({ data }: { data: CityLandingData }) {
  const { municipality, prefecture, counts } = data;
  return (
    <section
      className="mb-10 border-t border-gray-200 pt-8"
      aria-labelledby="city-about-heading"
    >
      <h2 id="city-about-heading" className="text-lg font-bold text-gray-950">
        このページに掲載している情報について
      </h2>
      <ul className="mt-3 max-w-4xl space-y-2 text-sm leading-relaxed text-gray-600">
        <li>
          {municipality}内に通えるキャンパス・学習センターがある学校を掲載しています。入試や説明会だけに使う会場は含みません。
        </li>
        <li>
          口コミは当サイトのアンケートに回答した在校生・卒業生・保護者の声です。
          {prefecture}内の口コミを{municipality}内の口コミとは数えず、回答された地域を表示しています。
        </li>
        {counts.admissionVerifiedCount > 0 && (
          <li>
            出願区域・スクーリング会場の表示は、学校公式サイト・募集要項・教育委員会の公表資料で確認できた内容です。
          </li>
        )}
        <li>
          所在地・最寄り駅・学費・通い方は変わることがあります。出願前に学校公式の最新情報を確認してください。
        </li>
      </ul>
    </section>
  );
}

export default function CityLandingPage({ data, intro }: CityLandingPageProps) {
  const { municipality, prefecture } = data;
  const prefecturePath = appPath(getPrefecturePath(prefecture));
  const faqItems = buildCityFaqItems(data);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50/60 via-white to-white py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <nav className="mb-5 text-sm text-gray-500" aria-label="パンくず">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href={appPath('/')} prefetch={false} className="hover:text-blue-700">
                トップ
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href={appPath('/schools')} prefetch={false} className="hover:text-blue-700">
                学校一覧
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href={prefecturePath} prefetch={false} className="hover:text-blue-700">
                {prefecture}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="font-medium text-gray-800">{municipality}</li>
          </ol>
        </nav>

        <header className="mb-9 max-w-4xl">
          <p className="mb-2 text-sm font-bold text-blue-700">場所と実際の口コミから比べる</p>
          <h1 className="text-3xl font-bold leading-tight text-gray-950 sm:text-4xl">
            {getCityLandingHeading(municipality)}
          </h1>
          <p className="mt-4 text-base leading-8 text-gray-700">{getCityLandingSubtitle(data)}</p>
          <p className="mt-3 text-sm text-gray-500">
            {countsText(data)}
          </p>
        </header>

        <RegionalSchoolFinder
          targetId={RESULTS_ID}
          prefecture={prefecture}
          totalSchools={data.counts.totalSchools}
          stations={data.finderStations}
          schoolTypes={data.schoolTypeOptions}
        />

        <section id={RESULTS_ID} className="mb-10" aria-labelledby="city-comparison-heading">
          <div className="mb-5 max-w-3xl">
            <h2 id="city-comparison-heading" className="text-2xl font-bold text-gray-950">
              {municipality}の通信制高校・サポート校 全{data.counts.totalSchools}校
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {prefecture}内のキャンパスに通った人の口コミがある学校は、その声を大きく紹介しています。口コミがまだない学校も含め、
              {municipality}内に通えるキャンパスがある学校をすべて掲載しています。
            </p>
          </div>
          <ul className="space-y-5" data-regional-list>
            {data.rows.map((row) => {
              const card = toCardData(row);
              return card ? (
                <RegionalSchoolCard
                  key={row.id}
                  school={card}
                  prefecture={prefecture}
                  municipality={municipality}
                />
              ) : (
                <RegionalSchoolListRow
                  key={row.id}
                  school={toListData(row)}
                  prefecture={prefecture}
                  municipality={municipality}
                />
              );
            })}
          </ul>
        </section>

        <div className="mb-10">
          <p className="text-xs leading-relaxed text-gray-500">
            「—」の学費は、公開された金額を当サイトで確認できない学校です。コースや通学頻度で変わる場合もあるため、資料や個別相談で確認してください。
          </p>
          <TuitionDisclaimer className="mt-2" />
        </div>

        {data.prefectureReviewCount > 0 && <ThemeReviewLinks prefecture={prefecture} />}

        <AreaGuide data={data} />

        <section className="mb-12 border-t border-blue-100 pt-9" aria-labelledby="city-intro-heading">
          <h2 id="city-intro-heading" className="text-2xl font-bold text-gray-950">
            {municipality}で学校を選ぶときに確認したいこと
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-gray-700">{intro}</p>
        </section>

        <section className="mb-12 border-t border-gray-200 pt-9" aria-labelledby="city-faq-heading">
          <h2 id="city-faq-heading" className="text-2xl font-bold text-gray-950">
            よくある質問
          </h2>
          <div className="mt-4 divide-y divide-gray-200 border-y border-gray-200">
            {faqItems.map((item) => (
              <details key={item.question} className="group py-1">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700">
                  {item.question}
                  <span aria-hidden className="text-blue-700 transition-transform group-open:rotate-45">
                    ＋
                  </span>
                </summary>
                <p className="max-w-4xl pb-5 pr-8 text-sm leading-7 text-gray-700">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <AboutNote data={data} />

        <RequestNotificationCta
          source="city_landing"
          prefecture={prefecture}
          className="mb-10"
        />

        <nav className="mb-8 border-t border-gray-200 pt-8" aria-label="関連ページ">
          <h2 className="text-lg font-bold text-gray-950">さらに探す</h2>
          <ul className="mt-3 flex flex-col gap-3 text-sm sm:flex-row sm:gap-8">
            <li>
              <Link
                href={prefecturePath}
                className="font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:text-blue-900"
              >
                {prefecture}の通信制高校をすべて見る
              </Link>
            </li>
            <li>
              <Link
                href={appPath(`/reviews?prefecture=${encodeURIComponent(prefecture)}`)}
                rel="nofollow"
                className="font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:text-blue-900"
              >
                {prefecture}の口コミを新着順で見る
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

function countsText(data: CityLandingData): string {
  const { counts, prefecture } = data;
  const parts = [
    `${counts.totalSchools}校`,
    `${counts.campusLocationCount}キャンパス`,
    data.prefectureReviewCount > 0 ? `${prefecture}内の口コミ${data.prefectureReviewCount}件` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(' ／ ');
}
