import Link from 'next/link';
import PrefectureSchoolCardTracker from '@/components/PrefectureSchoolCardTracker';
import AdmissionBadgeList from '@/components/AdmissionBadgeList';
import TuitionDisclaimer from '@/components/TuitionDisclaimer';
import RequestNotificationCta from '@/components/RequestNotificationCta';
import { appPath } from '@/lib/base-path';
import { getPrefecturePath } from '@/lib/prefectures';
import {
  buildCityFaqItems,
  getCityLandingHeading,
  getCityLandingSubtitle,
} from '@/lib/regions/city-landing-copy';
import {
  UNSPECIFIED_WARD_LABEL,
  type CityLandingData,
  type CitySchoolRow,
} from '@/lib/schools/getCityLandingData';
import type { TuitionConfirmationState } from '@/lib/schools/getPrefectureLandingData';
import type { SchoolInstitutionType } from '@/lib/types/schools';

interface CityLandingPageProps {
  data: CityLandingData;
  intro: string;
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

function SchoolName({ name, slug }: { name: string; slug: string | null }) {
  if (!slug) return <span className="font-medium text-gray-900">{name}</span>;
  return (
    <Link
      href={appPath(`/schools/${slug}`)}
      className="font-medium text-blue-700 hover:text-blue-900 hover:underline"
    >
      {name}
    </Link>
  );
}

function formatWards(row: CitySchoolRow): string {
  if (row.wards.length === 0) return `市内${row.campusCount}拠点（区の登録なし）`;
  const shown = row.wards.slice(0, 2).join('・');
  return row.wards.length > 2 ? `${shown}ほか` : shown;
}

function SummaryStats({ data }: { data: CityLandingData }) {
  const { counts, municipality, prefecture } = data;
  const stationRate =
    counts.totalSchools > 0 ? Math.round((counts.schoolsWithStation / counts.totalSchools) * 100) : 0;
  const review =
    data.cityReviewCount > 0
      ? {
          label: `${municipality}の口コミ`,
          value: `${data.cityReviewCount}件`,
          hint: `${municipality}のキャンパスと申告された回答 / ${data.cityReviewSchoolCount}校`,
        }
      : {
          label: `${prefecture}内キャンパスの口コミ`,
          value: data.prefectureReviewCount > 0 ? `${data.prefectureReviewCount}件` : '—',
          hint: `${municipality}とは限らない回答です（${data.prefectureReviewSchoolCount}校）`,
        };
  const cards = [
    {
      label: '掲載校数',
      value: `${counts.totalSchools}校`,
      hint: `公立${counts.publicCount} / 私立${counts.privateCount} / サポート校${counts.supportCount}`,
    },
    { label: `${municipality}内の拠点`, value: `${counts.campusLocationCount}拠点`, hint: '試験会場・説明会のみの会場を除く' },
    { label: '拠点がある区', value: `${counts.wardCount}区`, hint: '区まで登録された拠点で集計' },
    { label: '最寄り駅の登録', value: `${stationRate}%`, hint: `${counts.schoolsWithStation}校 / ${counts.stationCount}駅` },
    review,
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
          <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{card.hint}</p>
        </div>
      ))}
    </div>
  );
}

function ComparisonTable({ data }: { data: CityLandingData }) {
  const { municipality, prefecture, rows } = data;
  const showCityReviews = data.cityReviewCount > 0;
  return (
    <section className="mb-8" aria-labelledby="city-comparison-heading">
      <h2 id="city-comparison-heading" className="text-xl font-bold text-gray-900 mb-2">
        {municipality}に拠点がある通信制高校・サポート校を一覧で比較
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        学校種別、市内の区、最寄り駅、学費の確認状態、口コミ件数を同じ条件で並べています。
        口コミは「{showCityReviews ? `${municipality}のキャンパスと申告された回答` : `${prefecture}内キャンパスの回答`}」と
        「他県を含む学校全体」を分けて表示しています。
      </p>
      <PrefectureSchoolCardTracker prefecture={prefecture} block="city_list">
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-[48rem] w-full text-sm">
            <caption className="sr-only">{municipality}の通信制高校・サポート校の比較一覧</caption>
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">学校名</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">種別</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">市内の区</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">最寄り駅</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">学費</th>
                {showCityReviews && (
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">{municipality}の口コミ</th>
                )}
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">{prefecture}内の口コミ</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">学校全体の口コミ</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">総合</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-blue-50/40">
                  <th scope="row" className="px-3 py-2.5 text-left font-normal">
                    <SchoolName name={row.name} slug={row.slug} />
                    {row.headquartersPrefecture !== prefecture && (
                      <span className="block text-[11px] text-gray-500">本校: {row.headquartersPrefecture}</span>
                    )}
                    <AdmissionBadgeList badges={row.admissionBadges} />
                  </th>
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                    {row.institutionType ? institutionTypeLabels[row.institutionType] : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">{formatWards(row)}</td>
                  <td className="px-3 py-2.5 text-gray-700">
                    {row.stations.length > 0 ? row.stations.join('・') : '—'}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                    {tuitionStateLabels[row.tuitionState]}
                  </td>
                  {showCityReviews && (
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {row.cityReviewCount > 0 ? (
                        <span className="font-semibold text-gray-900">{row.cityReviewCount}件</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2.5 text-right whitespace-nowrap text-gray-700">
                    {row.prefectureReviewCount > 0 ? `${row.prefectureReviewCount}件` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap text-gray-500">
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

function WardSection({ data }: { data: CityLandingData }) {
  if (data.wards.length === 0) return null;
  return (
    <section
      className="mb-8 rounded-xl border border-blue-100 bg-white p-5 md:p-6"
      aria-labelledby="city-ward-heading"
    >
      <h2 id="city-ward-heading" className="text-xl font-bold text-gray-900 mb-2">
        {data.municipality}の区ごとの通信制高校
      </h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-5 max-w-4xl">
        キャンパス・学習センターの所在区ごとに学校をまとめています。1校が複数の区に拠点を持つ場合は、それぞれの区に表示しています。
        「{UNSPECIFIED_WARD_LABEL}」は、{data.municipality}内であることは確認できているものの、区まで登録されていない拠点です。
      </p>
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.wards.map((ward) => (
          <li key={ward.name} className="rounded-lg border border-gray-100 bg-gray-50/70 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-1">
              {ward.name === UNSPECIFIED_WARD_LABEL ? ward.name : `${data.municipality}${ward.name}`}
              <span className="ml-2 text-xs font-normal text-gray-500">
                {ward.schoolCount}校 / {ward.campusCount}拠点
              </span>
            </h3>
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {ward.schools.map((school) => (
                <li key={school.id}>
                  <SchoolName name={school.name} slug={school.slug} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StationSection({ data }: { data: CityLandingData }) {
  if (data.topStations.length === 0) return null;
  return (
    <section
      className="mb-8 rounded-xl border border-gray-200 bg-white p-5 md:p-6"
      aria-labelledby="city-station-heading"
    >
      <h2 id="city-station-heading" className="text-xl font-bold text-gray-900 mb-2">
        {data.municipality}の主な最寄り駅から探す
      </h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-4 max-w-4xl">
        市内の拠点で登録されている最寄り駅を、駅ごとの学校数で並べています。路線が複数ある駅は同じ駅としてまとめています。
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.topStations.map((station) => (
          <li key={station.name} className="rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2">
            <Link
              href="#city-comparison-heading"
              className="text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
            >
              {station.name}から通える{station.schoolCount}校
            </Link>
            {station.lines.length > 0 && (
              <span className="block text-[11px] text-gray-500 leading-relaxed">{station.lines.join('・')}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function MethodologyNote({ data }: { data: CityLandingData }) {
  const { municipality, prefecture, counts } = data;
  return (
    <section
      className="mb-8 rounded-xl border border-gray-200 bg-white p-4 md:p-5"
      aria-labelledby="city-methodology-heading"
    >
      <h2 id="city-methodology-heading" className="text-base font-bold text-gray-900 mb-2">
        このページの数え方と調査方法
      </h2>
      <ul className="space-y-1.5 text-xs text-gray-600 leading-relaxed">
        <li>
          掲載校は、{municipality}内に常設のキャンパス・学習センターの登録がある{counts.totalSchools}校です。
          試験会場や説明会だけの会場、{municipality}外の拠点しかない学校は含めていません。{prefecture}全体は
          {prefecture}の一覧ページで比較できます。
        </li>
        <li>
          口コミは公開済みのアンケート回答だけを集計しています。回答者が申告したキャンパスの市区町村が{municipality}のものだけを
          {municipality}の口コミとして数え、都道府県までしか申告されていない回答は「{prefecture}内の口コミ」として区別しています。
        </li>
        <li>
          学費は各学校の公開情報で確認できた範囲のみ「目安あり」と表示し、確認できない場合は「要確認」としています。未確認は安い・無料という意味ではありません。
        </li>
        {counts.admissionVerifiedCount > 0 && (
          <li>
            「全国から出願可」「スクーリング会場」などの表示は、学校公式サイト・募集要項・教育委員会の公表資料で確認できた
            {counts.admissionVerifiedCount}校のみです。確認日から12か月を過ぎた情報は表示しません。
          </li>
        )}
        <li>
          所在地・最寄り駅は学校公式サイト等で確認できた範囲の登録情報です（公開条件の確認日: {data.config.gateVerifiedAt}）。最新情報は各学校の公式情報で確認してください。
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="text-sm text-gray-500 mb-4" aria-label="パンくず">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link href={appPath('/')} className="hover:text-blue-600">トップ</Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href={appPath('/schools')} className="hover:text-blue-600">学校一覧</Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href={prefecturePath} className="hover:text-blue-600">{prefecture}の通信制高校</Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-gray-800 font-medium">{municipality}の通信制高校</li>
          </ol>
        </nav>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{getCityLandingHeading(municipality)}</h1>
          <p className="text-sm text-gray-600 mt-2 leading-relaxed max-w-4xl">{getCityLandingSubtitle(data)}</p>
        </div>

        <SummaryStats data={data} />

        <nav
          className="mb-6 rounded-xl border border-blue-100 bg-white px-4 py-3 sm:px-5 sm:py-4"
          aria-label={`${municipality}の通信制高校比較で次に見るページ`}
        >
          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <li>
              <Link href="#city-comparison-heading" className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                全掲載校の比較表を見る
              </Link>
            </li>
            <li>
              <Link href="#city-ward-heading" className="text-blue-600 hover:text-blue-800 hover:underline">
                区から探す
              </Link>
            </li>
            <li>
              <Link href="#city-station-heading" className="text-blue-600 hover:text-blue-800 hover:underline">
                最寄り駅から探す
              </Link>
            </li>
            <li>
              <Link href={prefecturePath} className="text-blue-600 hover:text-blue-800 hover:underline">
                {prefecture}全体の通信制高校を比較する
              </Link>
            </li>
          </ul>
        </nav>

        <ComparisonTable data={data} />

        <WardSection data={data} />

        <StationSection data={data} />

        <MethodologyNote data={data} />

        <section
          className="mb-8 rounded-xl border border-gray-200 bg-white p-5 md:p-6"
          aria-labelledby="city-intro-heading"
        >
          <h2 id="city-intro-heading" className="text-xl font-bold text-gray-900 mb-3">
            {municipality}で通信制高校を選ぶときのポイント
          </h2>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed max-w-4xl">{intro}</p>
        </section>

        <section className="mt-12 mb-8 rounded-xl border border-gray-200 bg-white p-6 md:p-8" aria-labelledby="city-faq-heading">
          <h2 id="city-faq-heading" className="text-xl font-bold text-gray-900 mb-4">
            {municipality}の通信制高校でよくある質問
          </h2>
          <dl className="space-y-6">
            {faqItems.map((item) => (
              <div key={item.question}>
                <dt className="font-semibold text-gray-900 mb-2">{item.question}</dt>
                <dd className="text-gray-700 text-sm leading-relaxed">{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <RequestNotificationCta source="prefecture_landing" prefecture={prefecture} className="mb-8" />

        <nav className="mb-8 rounded-xl border border-gray-200 bg-white p-5 md:p-6" aria-label="関連ページ">
          <p className="text-lg font-bold text-gray-900 mb-4">{municipality}周辺の通信制高校をさらに探す</p>
          <ul className="grid gap-3 md:grid-cols-2">
            <li>
              <Link
                href={prefecturePath}
                className="block h-full rounded-lg border border-gray-100 bg-gray-50/70 p-4 hover:border-blue-300 hover:bg-blue-50/70 transition-colors"
              >
                <span className="block text-sm font-bold text-blue-700 mb-1">{prefecture}の通信制高校一覧</span>
                <span className="block text-xs text-gray-600 leading-relaxed">
                  {municipality}以外の市町村の拠点、公立通信制高校、{prefecture}内の口コミをまとめて比較できます。
                </span>
              </Link>
            </li>
            <li>
              <Link
                href={appPath(`/reviews?prefecture=${encodeURIComponent(prefecture)}`)}
                rel="nofollow"
                className="block h-full rounded-lg border border-gray-100 bg-gray-50/70 p-4 hover:border-blue-300 hover:bg-blue-50/70 transition-colors"
              >
                <span className="block text-sm font-bold text-blue-700 mb-1">{prefecture}の口コミを一覧で見る</span>
                <span className="block text-xs text-gray-600 leading-relaxed">地域を絞った口コミを新着順で確認できます。</span>
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
