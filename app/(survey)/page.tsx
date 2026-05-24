import Link from 'next/link';
import PrefectureMapLinks from '@/components/PrefectureMapLinks';
import SchoolCardServer from '@/components/SchoolCardServer';
import ReviewCardServer from '@/components/ReviewCardServer';
import ArticleCardServer from '@/components/ArticleCardServer';
import HomeHero from '@/components/HomeHero';
import HomeCampaignBanner from '@/components/HomeCampaignBanner';
import { getHomeData } from '@/lib/home/getHomeData';
import { appPath } from '@/lib/base-path';

export const revalidate = 300;

export default async function Home() {
  const data = await getHomeData();
  return (
    <div className="min-h-screen bg-gray-50">
      <HomeHero />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-0">
        <HomeCampaignBanner />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {data.popularSchools.length > 0 && (
          <section className="mb-12">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">注目の学校</h2>
                <p className="text-sm text-gray-600">多くの口コミが寄せられている学校</p>
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
              {data.popularSchools.slice(0, 3).map((school) => (
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
          <Link
            href={appPath('/simulator')}
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
          </Link>
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
