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
import type { CityLandingData, CityReviewExcerpt } from '@/lib/schools/getCityLandingData';
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

function SummaryStats({ data }: { data: CityLandingData }) {
  const { counts, municipality, prefecture } = data;
  const reviewCount = data.cityReviewCount > 0 ? data.cityReviewCount : data.prefectureReviewCount;
  const cards = [
    {
      label: '掲載校数',
      value: `${counts.totalSchools}校`,
      hint: `公立${counts.publicCount} / 私立${counts.privateCount} / サポート校${counts.supportCount}`,
    },
    {
      label: `${municipality}内のキャンパス`,
      value: `${counts.campusLocationCount}か所`,
      hint: 'キャンパス・学習センター',
    },
    {
      label: data.cityReviewCount > 0 ? `${municipality}のキャンパスの口コミ` : `${prefecture}内キャンパスの口コミ`,
      value: reviewCount > 0 ? `${reviewCount}件` : '—',
      hint: '実際に通った人の声',
    },
    {
      label: '掲載校の総合満足度',
      value: data.averageOverallSatisfaction != null ? `${data.averageOverallSatisfaction.toFixed(1)} / 5` : '—',
      hint: `口コミ${data.totalReviewCount}件の平均`,
    },
  ];
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        {municipality}にキャンパスがある通信制高校・サポート校を一覧で比較
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        最寄り駅、初年度納入金の目安、口コミ件数を並べています。「{prefecture}内の口コミ」は{prefecture}内のキャンパスに通った人の口コミ、
        「全体」は他県のキャンパスも含めた学校全体の口コミです。
      </p>
      <PrefectureSchoolCardTracker prefecture={prefecture} block="city_list">
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-[44rem] w-full text-sm">
            <caption className="sr-only">{municipality}の通信制高校・サポート校の比較一覧</caption>
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">学校名</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">種別</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">最寄り駅</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">初年度納入金の目安</th>
                {showCityReviews && (
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">{municipality}の口コミ</th>
                )}
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">{prefecture}内の口コミ</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">口コミ（全体）</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">総合</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-blue-50/40">
                  <th scope="row" className="px-3 py-2.5 text-left font-normal">
                    <SchoolName name={row.name} slug={row.slug} />
                    {row.headquartersPrefecture !== prefecture && row.headquartersPrefecture !== '不明' && (
                      <span className="block text-[11px] text-gray-500">本校: {row.headquartersPrefecture}</span>
                    )}
                    <AdmissionBadgeList badges={row.admissionBadges} />
                  </th>
                  <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                    {row.institutionType ? institutionTypeLabels[row.institutionType] : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">
                    {row.stations.length > 0
                      ? row.stations.join('・')
                      : row.wards.length > 0
                        ? `${municipality}${row.wards[0]}`
                        : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-gray-700">
                    {row.tuition ? (
                      <>
                        <span className="whitespace-nowrap">{row.tuition.value}</span>
                        {row.tuition.basisLabel && (
                          <span className="block text-[11px] text-gray-500">{row.tuition.basisLabel}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
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
      <p className="mt-2 text-xs text-gray-500">
        「—」の学費は、学校が金額を公開していないか、コースや通学頻度によって大きく変わる学校です。資料請求や個別相談で確認できます。
      </p>
      <TuitionDisclaimer className="mt-2" />
    </section>
  );
}

function StarRating({ value }: { value: number }) {
  return (
    <span className="text-amber-500" aria-label={`総合満足度 ${value} / 5`}>
      {'★'.repeat(value)}
      <span className="text-gray-300">{'★'.repeat(5 - value)}</span>
    </span>
  );
}

function ReviewExcerptCard({ review, municipality, prefecture }: { review: CityReviewExcerpt; municipality: string; prefecture: string }) {
  return (
    <li className="flex flex-col rounded-lg border border-gray-100 bg-gray-50/70 p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mb-2">
        <SchoolName name={review.schoolName} slug={review.schoolSlug} />
        <span className="rounded bg-white px-1.5 py-0.5 text-[11px] text-gray-600 border border-gray-200">
          {review.isCityCampus ? `${municipality}のキャンパス` : `${prefecture}内のキャンパス`}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 text-xs text-gray-500 mb-2">
        {review.overall != null && <StarRating value={review.overall} />}
        {review.attendance && <span>通学: {review.attendance}</span>}
      </div>
      {review.good && (
        <p className="text-sm text-gray-700 leading-relaxed">
          <span className="mr-1 font-semibold text-emerald-700">良かった点</span>
          {review.good}
        </p>
      )}
      {review.bad && (
        <p className="mt-1.5 text-sm text-gray-700 leading-relaxed">
          <span className="mr-1 font-semibold text-rose-700">気になった点</span>
          {review.bad}
        </p>
      )}
      <Link
        href={appPath(`/reviews/${review.id}`)}
        className="mt-auto pt-3 text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
      >
        この口コミを全文で読む
      </Link>
    </li>
  );
}

function ReviewSection({ data }: { data: CityLandingData }) {
  if (data.reviewExcerpts.length === 0) return null;
  const { municipality, prefecture } = data;
  return (
    <section
      className="mb-8 rounded-xl border border-amber-100 bg-white p-5 md:p-6"
      aria-labelledby="city-review-heading"
    >
      <h2 id="city-review-heading" className="text-xl font-bold text-gray-900 mb-2">
        {prefecture}内のキャンパスに通った人の口コミ
      </h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-5 max-w-4xl">
        {municipality}にキャンパスがある学校について、{prefecture}内のキャンパスに通った在校生・卒業生・保護者の口コミを抜粋しています。
        {municipality}のキャンパスに通ったと回答した口コミには「{municipality}のキャンパス」と表示しています。
      </p>
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.reviewExcerpts.map((review) => (
          <ReviewExcerptCard key={review.id} review={review} municipality={municipality} prefecture={prefecture} />
        ))}
      </ul>
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
        {data.municipality}の区から通信制高校を探す
      </h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-5 max-w-4xl">
        キャンパス・学習センターがある区ごとに学校をまとめています。複数の区にキャンパスがある学校は、それぞれの区に表示しています。
      </p>
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data.wards.map((ward) => (
          <li key={ward.name} className="rounded-lg border border-gray-100 bg-gray-50/70 p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-1">
              {data.municipality}
              {ward.name}の通信制高校
              <span className="ml-2 text-xs font-normal text-gray-500">{ward.schoolCount}校</span>
            </h3>
            <ul className="mt-2 space-y-1 text-xs">
              {ward.schools.map((school) => (
                <li key={school.id}>
                  <SchoolName name={school.name} slug={school.slug} />
                  {school.stations.length > 0 && (
                    <span className="ml-1 text-gray-500">（{school.stations[0]}）</span>
                  )}
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
        {data.municipality}の主な駅から探す
      </h2>
      <p className="text-sm text-gray-600 leading-relaxed mb-4 max-w-4xl">
        キャンパスの最寄り駅ごとに、通える学校の数をまとめています。
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

function AboutNote({ data }: { data: CityLandingData }) {
  const { municipality, prefecture, counts } = data;
  return (
    <section
      className="mb-8 rounded-xl border border-gray-200 bg-white p-4 md:p-5"
      aria-labelledby="city-about-heading"
    >
      <h2 id="city-about-heading" className="text-base font-bold text-gray-900 mb-2">
        このページに掲載している情報について
      </h2>
      <ul className="space-y-1.5 text-xs text-gray-600 leading-relaxed">
        <li>
          {municipality}内に通えるキャンパス・学習センターがある学校を掲載しています。入試や説明会だけに使う会場は含みません。
          {prefecture}のほかの市町村の学校は{prefecture}の一覧ページで比較できます。
        </li>
        <li>
          口コミは、当サイトのアンケートに回答した在校生・卒業生・保護者の声です。主に通っていたキャンパスが{prefecture}内だった口コミを「{prefecture}内の口コミ」、
          {municipality}だった口コミを「{municipality}の口コミ」として表示しています。
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
            {data.reviewExcerpts.length > 0 && (
              <li>
                <Link href="#city-review-heading" className="text-blue-600 hover:text-blue-800 hover:underline">
                  通った人の口コミを読む
                </Link>
              </li>
            )}
            <li>
              <Link href="#city-ward-heading" className="text-blue-600 hover:text-blue-800 hover:underline">
                区から探す
              </Link>
            </li>
            <li>
              <Link href="#city-station-heading" className="text-blue-600 hover:text-blue-800 hover:underline">
                駅から探す
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

        <ReviewSection data={data} />

        <WardSection data={data} />

        <StationSection data={data} />

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

        <AboutNote data={data} />

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
                  {municipality}以外の市町村のキャンパス、公立通信制高校、{prefecture}内の口コミをまとめて比較できます。
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
