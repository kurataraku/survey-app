import { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/env-check';
import { BASE_PATH } from '@/lib/base-path';

export default function robots(): MetadataRoute.Robots {
  const apexUrl = getSiteUrl().replace(/\/$/, '');

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          `${BASE_PATH}/admin/`,
          `${BASE_PATH}/api/`,
          `${BASE_PATH}/export`,
          `${BASE_PATH}/survey`, // フォームページはインデックス不要
        ],
      },
    ],
    sitemap: `${apexUrl}/sitemap.xml`,
  };
}
