import Link from 'next/link';
import SchoolCardServer from '@/components/SchoolCardServer';
import ReviewCardServer from '@/components/ReviewCardServer';
import ArticleCardServer from '@/components/ArticleCardServer';
import HomeHero from '@/components/HomeHero';
import { getHomeData } from '@/lib/home/getHomeData';
import { appPath } from '@/lib/base-path';

export const revalidate = 300;

const majorPrefectures = [
  '東京都',
  '神奈川県',
  '埼玉県',
  '千葉県',
  '大阪府',
  '兵庫県',
  '京都府',
  '愛知県',
];

export default async function Home() {
  const data = await getHomeData();
  return (
    <div className="min-h-screen bg-gray-50">
      <HomeHero />
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
                  prefectures={school.prefectures || undefined}
                  slug={school.slug}
                  reviewCount={school.review_count}
                  overallAvg={school.overall_avg}
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
        <section className="bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">都道府県別で探す</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {majorPrefectures.map((pref) => (
              <Link
                key={pref}
                href={appPath(`/schools/prefecture/${encodeURIComponent(pref)}`)}
                className="px-4 py-2 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-lg text-center text-sm font-medium text-gray-700 hover:text-blue-600 hover:border-blue-300 transition-colors"
              >
                {pref.replace(/[都道府県]$/, '')}
              </Link>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link
              href={appPath('/schools')}
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center justify-center gap-1"
            >
              すべての都道府県を見る
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
