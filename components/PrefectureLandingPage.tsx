import Link from 'next/link';
import type { ComponentProps } from 'react';
import SchoolCardServer from '@/components/SchoolCardServer';
import PrefectureLandingFaq from '@/components/PrefectureLandingFaq';
import { appPath } from '@/lib/base-path';
import type { SearchSchool } from '@/lib/schools/searchSchools';
import { PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING } from '@/lib/schools/prefecture-landing-constants';

type SchoolCardGlobalAverages = NonNullable<
  ComponentProps<typeof SchoolCardServer>['globalAverages']
>;

interface PrefectureLandingPageProps {
  prefecture: string;
  introLead: string;
  topByReviews: SearchSchool[];
  topByRating: SearchSchool[];
  /** 項目別評価のサイト平均との差表示用（トップの注目の学校と同様） */
  globalAverages: SchoolCardGlobalAverages | null;
  /** 一覧＋ページネーション */
  children: React.ReactNode;
  hasSchools: boolean;
}

function InternalLinks({ prefecture }: { prefecture: string }) {
  const prefParam = encodeURIComponent(prefecture);
  const links: { href: string; label: string }[] = [
    { href: appPath(`/schools?prefecture=${prefParam}`), label: '条件を変えて検索' },
    { href: appPath('/rankings'), label: 'ランキング一覧' },
    { href: appPath('/rankings/overall'), label: '総合評判' },
    { href: appPath('/rankings/review-count'), label: '口コミ数' },
    { href: appPath('/rankings/tuition'), label: '学費満足度' },
    { href: appPath('/reviews'), label: '最新口コミ' },
  ];
  return (
    <nav className="mb-8 rounded-lg border border-gray-200 bg-white px-4 py-3" aria-label="関連ページ">
      <p className="text-sm font-medium text-gray-700 mb-2">関連リンク</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link href={href} className="text-blue-600 hover:text-blue-800 hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function PrefectureLandingPage({
  prefecture,
  introLead,
  topByReviews,
  topByRating,
  globalAverages,
  children,
  hasSchools,
}: PrefectureLandingPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href={appPath('/schools')} className="text-blue-600 hover:text-blue-700 mb-4 inline-block text-sm">
            ← 学校検索に戻る
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">{prefecture}の通信制高校</h1>
        </div>

        {hasSchools && (
          <>
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed max-w-3xl mb-8">{introLead}</p>

            <section className="mb-10" aria-labelledby="pref-highlights-reviews">
              <h2 id="pref-highlights-reviews" className="text-xl font-bold text-gray-900 mb-4">
                口コミが多い通信制高校
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                {prefecture}で回答件数が多く、参考になりやすい学校です。
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {topByReviews.map((school) => (
                  <SchoolCardServer
                    key={school.id}
                    id={school.id}
                    name={school.name}
                    prefecture={school.prefecture}
                    hidePrefectureUnderFilter
                    slug={school.slug}
                    reviewCount={school.review_count}
                    overallAvg={school.overall_avg}
                    staffAvg={school.staff_avg ?? undefined}
                    atmosphereAvg={school.atmosphere_avg ?? undefined}
                    creditAvg={school.credit_avg ?? undefined}
                    tuitionAvg={school.tuition_avg ?? undefined}
                    latestGoodComment={school.latest_good_comment ?? undefined}
                    latestBadComment={school.latest_bad_comment ?? undefined}
                    globalAverages={globalAverages ?? undefined}
                  />
                ))}
              </div>
            </section>

            <section className="mb-10" aria-labelledby="pref-highlights-rating">
              <h2 id="pref-highlights-rating" className="text-xl font-bold text-gray-900 mb-4">
                評判が高い通信制高校
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                口コミが{PREFECTURE_LANDING_MIN_REVIEWS_FOR_RATING}件以上あり、総合満足度の平均が高い順です。
              </p>
              {topByRating.length === 0 ? (
                <p className="text-sm text-gray-500">条件を満たす学校がまだありません。</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {topByRating.map((school) => (
                    <SchoolCardServer
                      key={school.id}
                      id={school.id}
                      name={school.name}
                      prefecture={school.prefecture}
                      hidePrefectureUnderFilter
                      slug={school.slug}
                      reviewCount={school.review_count}
                      overallAvg={school.overall_avg}
                      staffAvg={school.staff_avg ?? undefined}
                      atmosphereAvg={school.atmosphere_avg ?? undefined}
                      creditAvg={school.credit_avg ?? undefined}
                      tuitionAvg={school.tuition_avg ?? undefined}
                      latestGoodComment={school.latest_good_comment ?? undefined}
                      latestBadComment={school.latest_bad_comment ?? undefined}
                      globalAverages={globalAverages ?? undefined}
                    />
                  ))}
                </div>
              )}
            </section>

            <InternalLinks prefecture={prefecture} />

            <h2 className="text-xl font-bold text-gray-900 mb-4">{prefecture}の通信制高校一覧</h2>
          </>
        )}

        {children}

        {hasSchools && <PrefectureLandingFaq prefecture={prefecture} />}
      </div>
    </div>
  );
}
