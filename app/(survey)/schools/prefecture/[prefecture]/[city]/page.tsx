import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import CityLandingPage from '@/components/CityLandingPage';
import StructuredData from '@/components/StructuredData';
import { getAppBaseUrl } from '@/lib/env-check';
import { getPrefectureSlug } from '@/lib/prefectures';
import {
  CITY_LANDINGS,
  findCityLanding,
  getCityLandingPath,
} from '@/lib/regions/city-landing';
import {
  buildCityLandingIntro,
  buildCityLandingJsonLd,
  getCityLandingMetaDescription,
  getCityLandingTitle,
} from '@/lib/regions/city-landing-copy';
import { getCityLandingData } from '@/lib/schools/getCityLandingData';

export const revalidate = 3600;

/** 登録簿（lib/regions/city-landing.ts）にある都市だけを生成し、それ以外は404にする */
export const dynamicParams = false;

export async function generateStaticParams() {
  return CITY_LANDINGS.map((config) => ({
    prefecture: getPrefectureSlug(config.prefecture),
    city: config.slug,
  }));
}

interface PageProps {
  params: Promise<{ prefecture: string; city: string }> | { prefecture: string; city: string };
}

async function resolveConfig(params: PageProps['params']) {
  const resolved = params instanceof Promise ? await params : params;
  return findCityLanding(decodeURIComponent(resolved.prefecture), decodeURIComponent(resolved.city));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const config = await resolveConfig(params);
  if (!config) return { title: 'ページが見つかりません' };

  const data = await getCityLandingData(config);
  const title = getCityLandingTitle(config.municipality);
  const description = getCityLandingMetaDescription(data);
  const canonical = `${getAppBaseUrl()}${getCityLandingPath(config)}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
  };
}

export default async function CityLandingRoute({ params }: PageProps) {
  const config = await resolveConfig(params);
  if (!config) notFound();

  const data = await getCityLandingData(config);
  if (data.rows.length === 0) notFound();

  return (
    <>
      <StructuredData data={buildCityLandingJsonLd(data)} />
      <CityLandingPage data={data} intro={buildCityLandingIntro(data)} />
    </>
  );
}
