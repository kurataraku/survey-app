import Link from 'next/link';
import { appPath } from '@/lib/base-path';
import { getAppBaseUrl } from '@/lib/env-check';
import StructuredData from '@/components/StructuredData';
import { SCHOOL_REVIEWS_LIST_BREADCRUMB_JSONLD_NAME } from '@/lib/schools/school-reviews-list-copy';

type Variant = 'hub' | 'reviews';

interface SchoolPageBreadcrumbsProps {
  schoolName: string;
  encodedSlug: string;
  variant: Variant;
}

export default function SchoolPageBreadcrumbs({
  schoolName,
  encodedSlug,
  variant,
}: SchoolPageBreadcrumbsProps) {
  const base = getAppBaseUrl();
  const hubPath = `/schools/${encodedSlug}`;
  const hubUrl = `${base}${hubPath}`;
  const listUrl = `${base}${hubPath}/reviews`;

  const hubLabel = `${schoolName}の口コミ・評判`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'トップ',
        item: `${base}/`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '学校一覧',
        item: `${base}/schools`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: hubLabel,
        item: hubUrl,
      },
      ...(variant === 'reviews'
        ? [
            {
              '@type': 'ListItem' as const,
              position: 4,
              name: SCHOOL_REVIEWS_LIST_BREADCRUMB_JSONLD_NAME,
              item: listUrl,
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <StructuredData data={jsonLd} />
      <nav aria-label="パンくず" className="mb-3 text-sm text-gray-600">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-1">
          <li>
            <Link href={appPath('/')} className="text-blue-600 hover:underline">
              トップ
            </Link>
          </li>
          <li aria-hidden className="text-gray-400">
            /
          </li>
          <li>
            <Link href={appPath('/schools')} className="text-blue-600 hover:underline">
              学校一覧
            </Link>
          </li>
          <li aria-hidden className="text-gray-400">
            /
          </li>
          <li>
            {variant === 'hub' ? (
              <span className="text-gray-800 font-medium">{hubLabel}</span>
            ) : (
              <Link href={appPath(hubPath)} className="text-blue-600 hover:underline">
                {hubLabel}
              </Link>
            )}
          </li>
          {variant === 'reviews' && (
            <>
              <li aria-hidden className="text-gray-400">
                /
              </li>
              <li>
                <span className="text-gray-800 font-medium">口コミ一覧</span>
              </li>
            </>
          )}
        </ol>
      </nav>
    </>
  );
}
