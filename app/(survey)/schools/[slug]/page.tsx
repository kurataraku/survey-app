import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSchoolWithStats } from '@/lib/schools/getSchoolWithStats';
import { getSchoolSlugs } from '@/lib/schools/getSchoolSlugs';
import SchoolDetailClient from '@/components/SchoolDetailClient';
import type { Metadata } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';
import { appPath } from '@/lib/base-path';

// ISR: 60秒ごとに再検証（LCP改善のためキャッシュを活用）
export const revalidate = 60;

/** ビルド時に学校個別ページを静的生成し、初期HTMLに本文を含める */
export async function generateStaticParams() {
  const slugs = await getSchoolSlugs();
  return slugs;
}

interface PageProps {
  params: Promise<{ slug: string }> | { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = params instanceof Promise ? await params : params;
  const encodedSlug = resolvedParams.slug;
  let decodedSlug = encodedSlug;
  if (encodedSlug.includes('%')) {
    try {
      decodedSlug = decodeURIComponent(encodedSlug);
    } catch (e) {
      // デコードに失敗した場合はそのまま使用
    }
  }

  const school = await getSchoolWithStats(decodedSlug);

  if (!school) {
    return {
      title: '学校が見つかりません',
    };
  }

  const title = school.ai_summary?.meta_title || `${school.name}の口コミ・評判`;
  const description =
    school.ai_summary?.meta_description ||
    `${school.name}の口コミ・評判をまとめました。在校生・卒業生・保護者の生の声を掲載しています。`;

  const keywords = [
    `${school.name} 口コミ`,
    `${school.name} 評判`,
    '通信制高校 口コミ',
    '通信制 口コミ',
  ];

  const appBaseUrl = getAppBaseUrl();
  const pathname = `/schools/${resolvedParams.slug}`;
  const canonical = `${appBaseUrl}${pathname}`;

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function SchoolDetailPage({ params }: PageProps) {
  const resolvedParams = params instanceof Promise ? await params : params;
  const encodedSlug = resolvedParams.slug;
  let decodedSlug = encodedSlug;
  if (encodedSlug.includes('%')) {
    try {
      decodedSlug = decodeURIComponent(encodedSlug);
    } catch (e) {
      // デコードに失敗した場合はそのまま使用
    }
  }

  const school = await getSchoolWithStats(decodedSlug);

  if (!school) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-blue-50/30 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-4">
          <Link
            href={appPath('/schools')}
            className="text-sm text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            学校一覧に戻る
          </Link>
        </div>

        <SchoolDetailClient school={school} encodedSlug={encodedSlug} />
      </div>
    </div>
  );
}
