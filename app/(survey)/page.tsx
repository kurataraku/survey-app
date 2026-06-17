import Link from 'next/link';
import PrefectureMapLinks from '@/components/PrefectureMapLinks';
import SchoolCardServer from '@/components/SchoolCardServer';
import ReviewCardServer from '@/components/ReviewCardServer';
import ArticleCardServer from '@/components/ArticleCardServer';
import HomeHero from '@/components/HomeHero';
import HomeCampaignBanner from '@/components/HomeCampaignBanner';
import DiagnosisStartLink from '@/components/DiagnosisStartLink';
import { getHomeData, HOME_TOP_RATED_MIN_REVIEWS } from '@/lib/home/getHomeData';
import { appPath } from '@/lib/base-path';
import { getAppBaseUrl } from '@/lib/env-check';
import {
  HOME_FEATURED_SCHOOL_LINKS,
  HOME_PRIORITY_PREFECTURES,
} from '@/lib/seo/gsc-priority-schools';
import { getPrefecturePath } from '@/lib/prefectures';
import type { Metadata } from 'next';

export const revalidate = 300;

const HOME_TITLE = '通信制高校の口コミ・評判｜在校生・保護者のリアルレビューで学校選び';
const HOME_DESCRIPTION =
  '通信制高校の在校生・卒業生・保護者による口コミを掲載。学校ごとの評判、良かった点、気になる点、合う人・合わない人をリアルな声から確認できます。';

export const metadata: Metadata = {
  title: {
    absolute: HOME_TITLE,
  },
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: getAppBaseUrl(),
  },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: getAppBaseUrl(),
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
};

export default async function Home() {
  const data = await getHomeData();
  return (
    <div className="min-h-screen bg-gray-50">
      <HomeHero
        totalSchoolCount={data.totalSchoolCount}
        totalReviewCount={data.totalReviewCount}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-0">
        <HomeCampaignBanner />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <section className="mb-10" aria-labelledby="home-shortcuts-heading">
          <div className="mb-4">
            <h2 id="home-shortcuts-heading" className="text-2xl font-bold text-gray-900 mb-1">
              口コミを探す
            </h2>
            <p className="text-sm text-gray-600">
              エリアや学校名から、通信制高校の口コミ・評判ページへ移動できます。
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    都道府県から探す
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    主要エリアの通信制高校を比較
                  </p>
                </div>
                <Link
                  href={appPath('/schools')}
                  className="hidden sm:inline-flex text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  学校一覧
                </Link>
              </div>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5">
                {HOME_PRIORITY_PREFECTURES.map((prefecture) => (
                  <li key={prefecture}>
                    <Link
                      href={appPath(getPrefecturePath(prefecture))}
                      className="flex h-10 items-center justify-center rounded-full border border-blue-100 bg-blue-50/60 px-2 text-sm font-semibold text-blue-700 hover:border-blue-300 hover:bg-blue-100 transition-colors"
                    >
                      {prefecture}
                      <span className="sr-only">の通信制高校の口コミ</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm">
              <h3 className="text-base font-bold text-gray-900">
                学校名で探す
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">
                主な学校の口コミ・評判ページ
              </p>
              <ul className="grid gap-1.5">
                {HOME_FEATURED_SCHOOL_LINKS.map(({ slug, anchorText }) => (
                  <li key={slug}>
                    <Link
                      href={appPath(`/schools/${slug}`)}
                      className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2 text-sm font-medium text-blue-700 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <span className="truncate">
                        {anchorText.replace('の口コミ・評判', '')}
                        <span className="sr-only">の口コミ・評判</span>
                      </span>
                      <svg className="h-3.5 w-3.5 flex-shrink-0 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {data.popularSchools.length > 0 && (
          <section className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">口コミが多い学校</h2>
                <p className="text-sm text-gray-600">公開口コミが多い順。評判の傾向を確認できます</p>
              </div>
              <Link
                href={appPath('/schools')}
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                もっと見る
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.popularSchools.map((school) => (
                <SchoolCardServer
                  key={school.id}
                  id={school.id}
                  name={school.name}
                  prefecture={school.prefecture}
                  institutionType={school.institution_type}
                  campusLocations={school.campus_locations}
                  prefectures={school.prefectures || undefined}
                  slug={school.slug}
                  highlights={school.highlights ?? undefined}
                  intro={school.intro ?? undefined}
                  reviewCount={school.review_count}
                  overallAvg={school.overall_avg}
                  staffAvg={school.staff_avg ?? undefined}
                  atmosphereAvg={school.atmosphere_avg ?? undefined}
                  creditAvg={school.credit_avg ?? undefined}
                  tuitionAvg={school.tuition_avg ?? undefined}
                  latestGoodComment={school.latest_good_comment ?? undefined}
                  latestBadComment={school.latest_bad_comment ?? undefined}
                  reviewTendency={school.review_tendency ?? undefined}
                  globalAverages={data.schoolCardGlobalAverages ?? undefined}
                  primaryMetric="reviews"
                />
              ))}
            </div>
          </section>
        )}

        {data.topRankedSchools.length > 0 && (
          <section className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">総合満足度が高い学校</h2>
                <p className="text-sm text-gray-600">
                  公開口コミが{HOME_TOP_RATED_MIN_REVIEWS}件以上あり、総合満足度の平均が高い順です
                </p>
              </div>
              <Link
                href={appPath('/rankings/overall')}
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                もっと見る
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.topRankedSchools.map((school) => (
                <SchoolCardServer
                  key={school.id}
                  id={school.id}
                  name={school.name}
                  prefecture={school.prefecture}
                  institutionType={school.institution_type}
                  campusLocations={school.campus_locations}
                  prefectures={school.prefectures || undefined}
                  slug={school.slug}
                  highlights={school.highlights ?? undefined}
                  intro={school.intro ?? undefined}
                  reviewCount={school.review_count}
                  overallAvg={school.overall_avg}
                  staffAvg={school.staff_avg ?? undefined}
                  atmosphereAvg={school.atmosphere_avg ?? undefined}
                  creditAvg={school.credit_avg ?? undefined}
                  tuitionAvg={school.tuition_avg ?? undefined}
                  latestGoodComment={school.latest_good_comment ?? undefined}
                  latestBadComment={school.latest_bad_comment ?? undefined}
                  reviewTendency={school.review_tendency ?? undefined}
                  globalAverages={data.schoolCardGlobalAverages ?? undefined}
                  primaryMetric="overall"
                />
              ))}
            </div>
          </section>
        )}
        {data.latestReviews.length > 0 && (
          <section className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">注目の口コミ</h2>
                <p className="text-sm text-gray-600">多くのいいねが寄せられている口コミ</p>
              </div>
              <Link
                href={appPath('/reviews')}
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                もっと見る
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.latestReviews.map((review) => (
                <ReviewCardServer
                  key={review.id}
                  id={review.id}
                  schoolName={review.schools?.name || review.school_name}
                  schoolSlug={review.schools?.slug || null}
                  overallSatisfaction={review.overall_satisfaction}
                  goodComment={review.good_comment}
                  badComment={review.bad_comment}
                  enrollmentYear={null}
                  attendanceFrequency={null}
                  likeCount={review.like_count}
                  createdAt={review.created_at}
                  reasonForChoosing={review.reason_for_choosing}
                  attendanceFrequencyProp={review.attendance_frequency}
                  campusPrefecture={review.campus_prefecture}
                />
              ))}
            </div>
          </section>
        )}
        {/* シミュレーターバナー */}
        <section className="mb-12">
          <DiagnosisStartLink
            href={appPath('/simulator')}
            source="home_simulator_banner"
            className="group block relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 p-8 md:p-10 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
          >
            {/* 装飾円 */}
            <div className="pointer-events-none absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/10" />

            <div className="relative flex flex-col md:flex-row md:items-center gap-6">
              {/* テキスト */}
              <div className="flex-1 min-w-0">
                <div className="inline-flex items-center gap-1.5 bg-white/20 text-white text-xs font-black px-3 py-1 rounded-full mb-3 tracking-wide">
                  <span>🎮</span>
                  <span>通信制高校えらび診断ナビ</span>
                </div>
                <h2 className="text-white font-black text-2xl md:text-3xl leading-snug mb-2">
                  選ぶだけで、<br className="hidden sm:block" />
                  合う学校へナビゲート。
                </h2>
                <p className="text-white/85 text-sm md:text-base font-medium mb-4 leading-relaxed">
                  7つの場面でA/Bを選んで進めるだけ。<br className="hidden sm:block" />
                  ゲーム感覚で進むうちに、お子さんに合う学校タイプへたどり着きます。
                </p>
                <div className="flex flex-wrap gap-2">
                  {['🎮 A/B選ぶだけ', '✅ 無料・登録不要', '⏱ 約5分'].map(tag => (
                    <span key={tag} className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* CTAボタン */}
              <div className="shrink-0">
                <div className="inline-flex items-center gap-2 bg-white text-sky-600 font-black text-base px-7 py-4 rounded-2xl shadow-md group-hover:shadow-lg group-hover:scale-105 transition-all duration-200">
                  <span>無料で診断スタート</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </DiagnosisStartLink>
        </section>

        {data.latestArticles.length > 0 && (
          <section className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">特集記事</h2>
                <p className="text-sm text-gray-600">通信制高校に関する役立つ情報</p>
              </div>
              <Link
                href={appPath('/features')}
                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
              >
                もっと見る
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.latestArticles.map((article) => (
                <ArticleCardServer
                  key={article.id}
                  id={article.id}
                  title={article.title}
                  slug={article.slug}
                  category={article.category}
                  excerpt={article.excerpt}
                  featured_image_url={article.featured_image_url}
                  published_at={article.published_at}
                />
              ))}
            </div>
          </section>
        )}
        <PrefectureMapLinks />
      </div>
    </div>
  );
}
