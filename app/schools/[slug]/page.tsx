import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getSchoolWithStats } from '@/lib/schools/getSchoolWithStats';
import SchoolDetailClient from '@/components/SchoolDetailClient';
import type { Metadata } from 'next';

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

  // AI要約のmeta情報があれば優先、なければ既存ロジック
  const title = school.ai_summary?.meta_title || `${school.name}の口コミ・評判`;
  const description =
    school.ai_summary?.meta_description ||
    `${school.name}の口コミ・評判をまとめました。在校生・卒業生・保護者の生の声を掲載しています。`;

  // keywordsメタタグを追加（学校名を含む）
  const keywords = [
    `${school.name} 口コミ`,
    `${school.name} 評判`,
    '通信制高校 口コミ',
    '通信制 口コミ',
  ];

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      type: 'website',
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
        {/* 戻るリンク */}
        <div className="mb-4">
          <Link
            href="/schools"
            className="text-sm text-blue-500 hover:text-blue-600 inline-flex items-center gap-1"
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

        {/* クライアントコンポーネント（タブUIなど） */}
        <SchoolDetailClient school={school} encodedSlug={encodedSlug} />
      </div>
    </div>
  );
}
