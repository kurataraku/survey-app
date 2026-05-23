import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getAppBaseUrl, getSiteUrl } from '@/lib/env-check';
import { getPrefecturePath, prefectures } from '@/lib/prefectures';

const PAGE_SIZE = 1000;
const REVIEW_LIMIT = 1000;

function buildStaticCore(baseUrl: string, apexUrl: string): MetadataRoute.Sitemap {
  return [
    { url: apexUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 0.95 },
    { url: `${baseUrl}/schools`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    ...prefectures.map((pref) => ({
      url: `${baseUrl}${getPrefecturePath(pref)}`,
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
    ...(['overall', 'review-count', 'staff', 'atmosphere', 'credit', 'tuition'] as const).map((type) => ({
      url: `${baseUrl}/rankings/${type}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
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
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getAppBaseUrl();
  const apexUrl = getSiteUrl().replace(/\/$/, '');
  const out: MetadataRoute.Sitemap = [...buildStaticCore(baseUrl, apexUrl)];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return out;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 学校: 全件取得（ページネーション）
  let schoolFrom = 0;
  for (;;) {
    const { data: schools, error } = await supabase
      .from('schools')
      .select('slug, updated_at')
      .eq('status', 'active')
      .not('slug', 'is', null)
      .order('slug')
      .range(schoolFrom, schoolFrom + PAGE_SIZE - 1);

    if (error || !schools?.length) break;

    for (const school of schools) {
      if (!school.slug) continue;
      out.push({
        url: `${baseUrl}/schools/${school.slug}`,
        lastModified: school.updated_at ? new Date(school.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.9,
      });
      out.push({
        url: `${baseUrl}/schools/${school.slug}/reviews`,
        lastModified: school.updated_at ? new Date(school.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.85,
      });
    }

    if (schools.length < PAGE_SIZE) break;
    schoolFrom += PAGE_SIZE;
  }

  // 記事: 全件取得（ページネーション）
  let articleFrom = 0;
  for (;;) {
    const { data: articles, error } = await supabase
      .from('articles')
      .select('slug, updated_at')
      .eq('is_public', true)
      .order('slug')
      .range(articleFrom, articleFrom + PAGE_SIZE - 1);

    if (error || !articles?.length) break;

    for (const article of articles) {
      out.push({
        url: `${baseUrl}/features/${article.slug}`,
        lastModified: article.updated_at ? new Date(article.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }

    if (articles.length < PAGE_SIZE) break;
    articleFrom += PAGE_SIZE;
  }

  // 口コミ詳細: 最新 REVIEW_LIMIT 件のみ
  const { data: reviews, error: reviewError } = await supabase
    .from('survey_responses')
    .select('id, created_at')
    .eq('is_public', true)
    .not('school_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(REVIEW_LIMIT);

  if (!reviewError && reviews?.length) {
    for (const review of reviews) {
      out.push({
        url: `${baseUrl}/reviews/${review.id}`,
        lastModified: new Date(review.created_at),
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
  }

  return out;
}
