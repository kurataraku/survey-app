import { MetadataRoute } from 'next';
import { getAppBaseUrl } from '@/lib/env-check';
import { BASE_PATH } from '@/lib/base-path';

export default function robots(): MetadataRoute.Robots {
  const appBaseUrl = getAppBaseUrl().replace(/\/$/, '');

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
    sitemap: `${appBaseUrl}/sitemap.xml`,
  };
}
