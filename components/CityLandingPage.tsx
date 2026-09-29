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
import type { CityLandingData, CitySchoolRow } from '@/lib/schools/getCityLandingData';

interface CityLandingPageProps {
  data: CityLandingData;
  intro: string;
}

function ratingFor(row: CitySchoolRow): number | null {
  return row.prefectureReviewCount >= 3 ? row.regionalOverallAvg : row.overallAvg;
}

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
    rating: ratingFor(row),
    staffAvg: row.staffAvg,
    atmosphereAvg: row.atmosphereAvg,
    ratingScopeLabel: row.ratingScopeLabel,
    tuition: row.tuition,
    admissionBadges: row.admissionBadges,
    excerpt: row.excerpt,
    stationFilterIds: row.stationFilterIds,
    reviewFilterKeys: row.reviewFilterKeys,
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
    rating: ratingFor(row),
    ratingScopeLabel: row.ratingScopeLabel,
    tuition: row.tuition,
    excerpt: row.listExcerpt,
    stationFilterIds: row.stationFilterIds,
    reviewFilterKeys: row.reviewFilterKeys,
  };
}

function AreaGuide({ data }: { data: CityLandingData }) {
  if (data.wards.length === 0 && data.topStations.length === 0) return null;
  return (
    <section
      className="mb-12 border-t border-emerald-100 pt-9"
      aria-labelledby="city-area-heading"
    >
      <h2 id="city-area-heading" className="text-2xl font-bold text-gray-950">
        {data.wards.length > 0 ? '区・駅' : '駅'}から通いやすさを見る
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
        登録されているキャンパス所在地をもとにした件数です。駅の条件は上の絞り込みにも使えます。
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
                  href="#city-school-finder-heading"
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
  const featured = data.rows
    .map(toCardData)
    .filter((row): row is RegionalSchoolCardData => row !== null);
  const others = data.rows.filter((row) => row.tier !== 'a').map(toListData);

  return (
    <div className="min-h-screen bg-[var(--ce-bg)] py-8">
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
          <p className="mb-2 text-sm font-bold text-emerald-700">場所と実際の口コミから比べる</p>
          <h1 className="text-3xl font-bold leading-tight text-gray-950 sm:text-4xl">
            {getCityLandingHeading(municipality)}
          </h1>
          <p className="mt-4 text-base leading-8 text-gray-700">{getCityLandingSubtitle(data)}</p>
          <p className="mt-3 text-sm text-gray-500">
            {countsText(data)}
          </p>
        </header>

        <RegionalSchoolFinder
          targetId="city-school-results"
          prefecture={prefecture}
          reviewRegionLabel={`${prefecture}内の口コミ`}
          totalSchools={data.counts.totalSchools}
          stations={data.finderStations}
          reviewOptions={data.reviewFilterOptions}
        />

        <div id="city-school-results" aria-labelledby="city-comparison-heading">
          <h2 id="city-comparison-heading" className="sr-only">
            {municipality}の通信制高校・サポート校全校一覧
          </h2>

          {featured.length > 0 && (
            <section
              className="mb-12"
              aria-labelledby="city-review-heading"
              data-regional-section
              style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 7200px' }}
            >
              <div className="mb-5 max-w-3xl">
                <h2 id="city-review-heading" className="text-2xl font-bold text-gray-950">
                  口コミを詳しく読める学校
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {municipality}にキャンパスがある学校について、{prefecture}
                  内で実際に通った人の声を学校ごとに紹介します。
                </p>
              </div>
              <ul className="space-y-5">
                {featured.map((school) => (
                  <RegionalSchoolCard
                    key={school.id}
                    school={school}
                    prefecture={prefecture}
                    municipality={municipality}
                  />
                ))}
              </ul>
            </section>
          )}

          {others.length > 0 && (
            <section
              className="mb-10 border-t border-gray-300 pt-9"
              aria-labelledby="city-other-schools-heading"
              data-regional-section
              style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 5200px' }}
            >
              <h2 id="city-other-schools-heading" className="text-2xl font-bold text-gray-950">
                そのほかの学校
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                口コミが少ない学校、まだ口コミがない学校も含め、{municipality}
                内に通えるキャンパスがある学校をすべて掲載しています。
              </p>
              <ul className="mt-4 border-y border-gray-200">
                {others.map((school) => (
                  <RegionalSchoolListRow
                    key={school.id}
                    school={school}
                    municipality={municipality}
                  />
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="mb-10">
          <p className="text-xs leading-relaxed text-gray-500">
            「—」の学費は、公開された金額を当サイトで確認できない学校です。コースや通学頻度で変わる場合もあるため、資料や個別相談で確認してください。
          </p>
          <TuitionDisclaimer className="mt-2" />
        </div>

        <AreaGuide data={data} />

        <section className="mb-12 border-t border-emerald-100 pt-9" aria-labelledby="city-intro-heading">
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
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                  {item.question}
                  <span aria-hidden className="text-emerald-700 transition-transform group-open:rotate-45">
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
    `${counts.campusLocationCount}か所`,
    data.prefectureReviewCount > 0 ? `${prefecture}内の口コミ${data.prefectureReviewCount}件` : null,
  ].filter((part): part is string => Boolean(part));
  return parts.join(' ／ ');
}
