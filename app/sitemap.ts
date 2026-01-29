import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getAppBaseUrl, getSiteUrl } from '@/lib/env-check';
import { prefectures } from '@/lib/prefectures';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getAppBaseUrl();
  const apexUrl = getSiteUrl().replace(/\/$/, '');

  // 静的ページ
  const staticPages: MetadataRoute.Sitemap = [
    { url: apexUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${baseUrl}/schools`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...prefectures.map((pref) => ({
      url: `${baseUrl}/schools/prefecture/${encodeURIComponent(pref)}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    {
      url: `${baseUrl}/reviews`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/rankings`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    ...(['overall', 'review-count', 'staff', 'atmosphere', 'credit', 'tuition'] as const).map(
      (type) => ({
        url: `${baseUrl}/rankings/${type}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      })
    ),
    {
      url: `${baseUrl}/features`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/survey`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];

  // 動的ページ（学校詳細、口コミ詳細、特集記事）
  const dynamicPages: MetadataRoute.Sitemap = [];

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // 学校詳細ページ
      const { data: schools } = await supabase
        .from('schools')
        .select('slug, updated_at')
        .eq('status', 'active')
        .not('slug', 'is', null);

      if (schools) {
        schools.forEach((school) => {
          if (school.slug) {
            dynamicPages.push({
              url: `${baseUrl}/schools/${school.slug}`,
              lastModified: school.updated_at ? new Date(school.updated_at) : new Date(),
              changeFrequency: 'weekly',
              priority: 0.9,
            });
            dynamicPages.push({
              url: `${baseUrl}/schools/${school.slug}/reviews`,
              lastModified: school.updated_at ? new Date(school.updated_at) : new Date(),
              changeFrequency: 'weekly',
              priority: 0.85,
            });
          }
        });
      }

      // 口コミ詳細ページ（公開されているもののみ）
      // パフォーマンス向上のため、最新500件に制限
      const { data: reviews } = await supabase
        .from('survey_responses')
        .select('id, created_at')
        .eq('is_public', true)
        .not('school_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500); // 最新500件のみ（パフォーマンス向上）

      if (reviews) {
        reviews.forEach((review) => {
          dynamicPages.push({
            url: `${baseUrl}/reviews/${review.id}`,
            lastModified: new Date(review.created_at),
            changeFrequency: 'monthly',
            priority: 0.7,
          });
        });
      }

      // 特集記事
      const { data: articles } = await supabase
        .from('articles')
        .select('slug, updated_at')
        .eq('is_public', true);

      if (articles) {
        articles.forEach((article) => {
          dynamicPages.push({
            url: `${baseUrl}/features/${article.slug}`,
            lastModified: article.updated_at ? new Date(article.updated_at) : new Date(),
            changeFrequency: 'weekly',
            priority: 0.8,
          });
        });
      }
    }
  } catch (error) {
    console.error('Sitemap generation error:', error);
  }

  return [...staticPages, ...dynamicPages];
}
