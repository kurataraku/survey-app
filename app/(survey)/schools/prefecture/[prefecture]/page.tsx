import { notFound, permanentRedirect } from 'next/navigation';

import PrefectureLandingPage from '@/components/PrefectureLandingPage';

import { getPrefectureLandingData } from '@/lib/schools/getPrefectureLandingData';

import { getCachedGlobalAverages } from '@/lib/schools/getSchoolWithStats';

import { buildPrefectureIntroLead } from '@/lib/regions/prefecture-intros';

import { getPrefecturePath, getPrefectureSlug, prefectures, resolvePrefectureParam } from '@/lib/prefectures';

import { appPath } from '@/lib/base-path';

import type { Metadata } from 'next';

import { getAppBaseUrl } from '@/lib/env-check';

import StructuredData from '@/components/StructuredData';

import { buildPrefectureLandingJsonLd } from '@/lib/prefectures/prefecture-landing-schema';

import {
  getPrefectureLandingMetaDescription,
  getPrefectureLandingTitle,
} from '@/lib/prefectures/prefecture-landing-copy';

export const revalidate = 3600;

/**
 * ビルド時に都道府県別学校一覧を静的生成し、初期HTMLに本文を含める。
 *
 * このページでは searchParams を読まない。読むと Next.js が動的レンダリングへ切り替え、
 * generateStaticParams と revalidate が無効化されてCDNキャッシュに載らなくなる。
 */
export async function generateStaticParams() {
  return prefectures.map((prefecture) => ({ prefecture: getPrefectureSlug(prefecture) }));
}

interface PageProps {
  params: Promise<{ prefecture: string }> | { prefecture: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolved = params instanceof Promise ? await params : params;

  const { prefecture } = resolvePrefectureParam(resolved.prefecture);

  if (!prefecture) {
    return { title: 'ページが見つかりません' };
  }

  const data = await getPrefectureLandingData(prefecture);

  const title = getPrefectureLandingTitle(prefecture);

  const description = getPrefectureLandingMetaDescription(prefecture, data.copyStats);

  const canonical = `${getAppBaseUrl()}${getPrefecturePath(prefecture)}`;

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

export default async function PrefectureSchoolsPage({ params }: PageProps) {
  const resolvedParams = params instanceof Promise ? await params : params;

  const { prefecture, isLegacyParam } = resolvePrefectureParam(resolvedParams.prefecture);

  if (!prefecture) {
    notFound();
  }

  if (isLegacyParam) {
    permanentRedirect(appPath(getPrefecturePath(prefecture)));
  }

  const [data, globalAverages] = await Promise.all([
    getPrefectureLandingData(prefecture),
    getCachedGlobalAverages(),
  ]);

  const introLead = buildPrefectureIntroLead(prefecture, {
    totalSchools: data.counts.totalSchools,
    publicCount: data.counts.publicCount,
    privateCount: data.counts.privateCount,
    supportCount: data.counts.supportCount,
    localCampusLocationCount: data.counts.localCampusLocationCount,
    cityCount: data.locationInsights.cityCount,
    topCities: data.locationInsights.topCities,
    topStations: data.locationInsights.topStations,
    localReviewCount: data.localReviewCount,
    localReviewSchoolCount: data.localReviewSchoolCount,
    topAttendance: data.regionalReviewSummary.attendanceFrequencies[0] ?? null,
    topEnrollment: data.regionalReviewSummary.enrollmentTypes[0] ?? null,
    tuitionConfirmed: data.tuitionCoverage.confirmed,
  });
  const hasSchools = data.rows.length > 0;

  const prefectureJsonLd = hasSchools
    ? buildPrefectureLandingJsonLd({
        prefecture,
        schools: data.itemListSchools,
        total: data.counts.totalSchools,
        stats: {
          totalSchools: data.counts.totalSchools,
          schoolsWithReviewsCount: data.schoolsWithReviewsCount,
          totalReviewCount: data.totalReviewCount,
          localReviewCount: data.localReviewCount,
          localReviewSchoolCount: data.localReviewSchoolCount,
          averageOverallSatisfaction: data.averageOverallSatisfaction,
        },
      })
    : null;

  return (
    <>
      {prefectureJsonLd && <StructuredData data={prefectureJsonLd} />}

      <PrefectureLandingPage
        data={data}
        introLead={introLead}
        globalAverages={globalAverages}
        hasSchools={hasSchools}
      />
    </>
  );
}
