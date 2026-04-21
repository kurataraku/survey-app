import StructuredData from '@/components/StructuredData';
import { getAppBaseUrl } from '@/lib/env-check';
import type { SchoolWithStats } from '@/lib/schools/getSchoolWithStats';

interface Props {
  school: Pick<SchoolWithStats, 'name' | 'overall_avg' | 'review_count'>;
  encodedSlug: string;
}

export default function SchoolEducationalOrganizationJsonLd({ school, encodedSlug }: Props) {
  const base = getAppBaseUrl();
  const url = `${base}/schools/${encodedSlug}`;

  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: school.name,
    url,
  };

  if (school.review_count > 0 && school.overall_avg != null) {
    data.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(school.overall_avg.toFixed(1)),
      bestRating: 5,
      worstRating: 1,
      ratingCount: school.review_count,
    };
  }

  return <StructuredData data={data} />;
}
