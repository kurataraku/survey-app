import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/env-check';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/export',
          '/survey', // フォームページはインデックス不要
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
