import { notFound, permanentRedirect, redirect } from 'next/navigation';

import Link from 'next/link';

import PrefectureLandingPage from '@/components/PrefectureLandingPage';

import SchoolCardServer from '@/components/SchoolCardServer';

import { searchSchools } from '@/lib/schools/searchSchools';

import { getPrefectureLandingHighlights } from '@/lib/schools/getPrefectureLandingHighlights';

import { getCachedGlobalAverages } from '@/lib/schools/getSchoolWithStats';

import { getPrefectureIntroLead } from '@/lib/regions/prefecture-intros';

import { getPrefecturePath, getPrefectureSlug, prefectures, resolvePrefectureParam } from '@/lib/prefectures';

import { appPath } from '@/lib/base-path';

import type { Metadata } from 'next';

import { getAppBaseUrl } from '@/lib/env-check';

import StructuredData from '@/components/StructuredData';

import TuitionDisclaimer from '@/components/TuitionDisclaimer';

import { buildPrefectureLandingJsonLd } from '@/lib/prefectures/prefecture-landing-schema';

import {
  getPrefectureLandingMetaDescription,
  getPrefectureLandingTitle,
} from '@/lib/prefectures/prefecture-landing-copy';
import { PREFECTURE_LANDING_PAGE_SIZE } from '@/lib/schools/prefecture-landing-constants';



export const revalidate = 3600;



/** ビルド時に都道府県別学校一覧を静的生成し、初期HTMLに本文を含める */

export async function generateStaticParams() {

  return prefectures.map((prefecture) => ({ prefecture: getPrefectureSlug(prefecture) }));

}



interface PageProps {

  params: Promise<{ prefecture: string }> | { prefecture: string };

  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;

}



function getStr(v: string | string[] | undefined): string {

  if (v === undefined) return '';

  return Array.isArray(v) ? v[0] ?? '' : v;

}



function parsePositivePage(v: string | string[] | undefined): number {

  const raw = parseInt(getStr(v) || '1', 10);

  return Number.isFinite(raw) && raw >= 1 ? raw : 1;

}



export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {

  const resolved = params instanceof Promise ? await params : params;

  const resolvedSearch = searchParams instanceof Promise ? await searchParams : searchParams ?? {};

  const { prefecture } = resolvePrefectureParam(resolved.prefecture);

  if (!prefecture) {

    return { title: 'ページが見つかりません' };

  }

  const page = parsePositivePage(resolvedSearch.page);

  const highlights = await getPrefectureLandingHighlights(prefecture);

  const title = getPrefectureLandingTitle(prefecture);

  const description = getPrefectureLandingMetaDescription(

    prefecture,

    highlights.totalReviewCount

  );

  const base = `${getAppBaseUrl()}${getPrefecturePath(prefecture)}`;

  const canonical = page > 1 ? `${base}?page=${page}` : base;

  return {

    title,

    description,

    alternates: { canonical },

    openGraph: {

      title,

      description,

      url: canonical,

    },

  };

}



export default async function PrefectureSchoolsPage({ params, searchParams }: PageProps) {

  const resolvedParams = params instanceof Promise ? await params : params;

  const resolvedSearch = searchParams instanceof Promise ? await searchParams : searchParams ?? {};

  const { prefecture, isLegacyParam } = resolvePrefectureParam(resolvedParams.prefecture);

  const page = parsePositivePage(resolvedSearch.page);



  if (!prefecture) {

    notFound();

  }

  if (isLegacyParam) {

    const suffix = page > 1 ? `?page=${page}` : '';

    permanentRedirect(appPath(`${getPrefecturePath(prefecture)}${suffix}`));

  }



  const [highlights, data, globalAverages] = await Promise.all([

    getPrefectureLandingHighlights(prefecture),

    searchSchools({ prefecture, page, limit: PREFECTURE_LANDING_PAGE_SIZE }),

    getCachedGlobalAverages(),

  ]);



  const totalPages = data.total_pages;

  if (data.total > 0) {

    const outOfRange = !Number.isFinite(page) || page < 1 || page > totalPages;

    if (outOfRange) {

      const targetPage = Math.max(1, totalPages);

      const suffix = targetPage > 1 ? `?page=${targetPage}` : '';

      redirect(appPath(`${getPrefecturePath(prefecture)}${suffix}`));

    }

  }



  const introLead = getPrefectureIntroLead(prefecture);

  const hasSchools = data.total > 0;



  const faqStats = {

    totalSchools: data.total,

    schoolsWithReviewsCount: highlights.schoolsWithReviewsCount,

    totalReviewCount: highlights.totalReviewCount,

    averageOverallSatisfaction: highlights.averageOverallSatisfaction,

  };



  const prefectureJsonLd =

    hasSchools

      ? buildPrefectureLandingJsonLd({

          prefecture,

          page,

          schools: data.schools.map((s) => ({ id: s.id, name: s.name, slug: s.slug })),

          total: data.total,

          stats: faqStats,

        })

      : null;



  return (

    <>

      {prefectureJsonLd && <StructuredData data={prefectureJsonLd} />}

      <PrefectureLandingPage

        prefecture={prefecture}

        introLead={introLead}

        totalSchools={data.total}

        schoolsWithReviewsCount={highlights.schoolsWithReviewsCount}

        totalReviewCount={highlights.totalReviewCount}

        averageOverallSatisfaction={highlights.averageOverallSatisfaction}

        averageTuitionSatisfaction={highlights.averageTuitionSatisfaction}

        topByReviewCount={highlights.topByReviewCount}

        topByRating={highlights.topByRating}

        topBySupport={highlights.topBySupport}

        topByTuition={highlights.topByTuition}

        schoolsByInstitutionType={highlights.schoolsByInstitutionType}

        attendanceFrequencyLinks={highlights.attendanceFrequencyLinks}

        globalAverages={globalAverages}

        hasSchools={hasSchools}

      >

        {!hasSchools ? (

          <div className="text-center py-12">

            <p className="text-gray-600">{prefecture}の通信制高校が見つかりませんでした</p>

            <Link href={appPath('/schools')} className="mt-4 inline-block text-blue-600 hover:text-blue-700">

              学校検索へ戻る

            </Link>

          </div>

        ) : (

          <>

            <p className="text-gray-600 mb-4">全{data.total}校（{page}ページ目）</p>

            {data.schools.some((school) => school.tuition_estimate) && (
              <TuitionDisclaimer className="mb-4" />
            )}

            <div className="space-y-4 mb-8">

              {data.schools.map((school) => (

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

                  highlights={school.highlights}

                  intro={school.intro}

                  reviewCount={school.review_count}

                  overallAvg={school.overall_avg}

                  latestGoodComment={school.latest_good_comment}

                  latestBadComment={school.latest_bad_comment}

                  reviewExcerpts={school.review_excerpts}

                  globalAverages={globalAverages}

                  flexibilityAvg={school.flexibility_avg}

                  staffAvg={school.staff_avg}

                  supportAvg={school.support_avg}

                  atmosphereAvg={school.atmosphere_avg}

                  creditAvg={school.credit_avg}

                  uniqueCourseAvg={school.unique_course_avg}

                  careerSupportAvg={school.career_support_avg}

                  campusLifeAvg={school.campus_life_avg}

                  tuitionAvg={school.tuition_avg}

                  tuitionEstimate={school.tuition_estimate}

                  courseListing={school.course_listing}

                  reviewTendency={school.review_tendency}

                />

              ))}

            </div>



            {data.total_pages > 1 && (

              <div className="flex justify-center gap-2">

                {page > 1 ? (

                  <Link

                    href={

                      page === 2

                        ? appPath(getPrefecturePath(prefecture))

                        : appPath(`${getPrefecturePath(prefecture)}?page=${page - 1}`)

                    }

                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"

                  >

                    前へ

                  </Link>

                ) : (

                  <span className="px-4 py-2 border border-gray-300 rounded-lg opacity-50 cursor-not-allowed">前へ</span>

                )}

                <span className="px-4 py-2 text-gray-600">

                  {page} / {data.total_pages}

                </span>

                {page < data.total_pages ? (

                  <Link

                    href={appPath(`${getPrefecturePath(prefecture)}?page=${page + 1}`)}

                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"

                  >

                    次へ

                  </Link>

                ) : (

                  <span className="px-4 py-2 border border-gray-300 rounded-lg opacity-50 cursor-not-allowed">次へ</span>

                )}

              </div>

            )}

          </>

        )}

      </PrefectureLandingPage>

    </>

  );

}

