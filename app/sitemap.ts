import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getAppBaseUrl, getSiteUrl } from '@/lib/env-check';
import { prefectures } from '@/lib/prefectures';

const REVIEW_FETCH_PAGE = 2000;

export async function generateSitemaps(): Promise<{ id: number }[]> {
  return [{ id: 0 }, { id: 1 }];
}

function buildStaticCore(baseUrl: string, apexUrl: string): MetadataRoute.Sitemap {
  return [
    { url: apexUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 0.95 },
    { url: `${baseUrl}/schools`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
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
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getAppBaseUrl();
  const apexUrl = getSiteUrl().replace(/\/$/, '');

  if (id === 0) {
    const out: MetadataRoute.Sitemap = [...buildStaticCore(baseUrl, apexUrl)];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return out;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: schools } = await supabase
      .from('schools')
      .select('slug, updated_at')
      .eq('status', 'active')
      .not('slug', 'is', null);

    if (schools) {
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
    }

    const { data: articles } = await supabase
      .from('articles')
      .select('slug, updated_at')
      .eq('is_public', true);

    if (articles) {
      for (const article of articles) {
        out.push({
          url: `${baseUrl}/features/${article.slug}`,
          lastModified: article.updated_at ? new Date(article.updated_at) : new Date(),
          changeFrequency: 'weekly',
          priority: 0.8,
        });
      }
    }

    return out;
  }

  if (id === 1) {
    const out: MetadataRoute.Sitemap = [];
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      return out;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let from = 0;

    while (true) {
      const { data: reviews, error } = await supabase
        .from('survey_responses')
        .select('id, created_at')
        .eq('is_public', true)
        .not('school_id', 'is', null)
        .order('created_at', { ascending: false })
        .range(from, from + REVIEW_FETCH_PAGE - 1);

      if (error) {
        console.error('Sitemap reviews fetch error:', error);
        break;
      }
      if (!reviews?.length) break;

      for (const review of reviews) {
        out.push({
          url: `${baseUrl}/reviews/${review.id}`,
          lastModified: new Date(review.created_at),
          changeFrequency: 'monthly',
          priority: 0.7,
        });
      }

      if (reviews.length < REVIEW_FETCH_PAGE) break;
      from += REVIEW_FETCH_PAGE;
    }

    return out;
  }

  return [];
}
