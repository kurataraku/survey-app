import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getAppBaseUrl, getSiteUrl } from '@/lib/env-check';
import { getPrefecturePath, prefectures } from '@/lib/prefectures';

const PAGE_SIZE = 1000;
const MIN_SCHOOL_REVIEWS_FOR_REVIEWS_SITEMAP = 3;

type SitemapSchool = {
  id: string;
  name: string;
  slug: string | null;
  updated_at: string | null;
};

type SitemapReviewLink = {
  school_id: string | null;
  school_name: string | null;
  schools: { id: string; status: string | null } | { id: string; status: string | null }[] | null;
};

function encodePathSegment(segment: string): string {
  return encodeURIComponent(segment);
}

function addCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function countReviewsBySchool(schools: SitemapSchool[], reviews: SitemapReviewLink[]) {
  const counts = new Map<string, number>();
  const activeSchoolIds = new Set(schools.map((school) => school.id));
  const schoolsByName = new Map<string, SitemapSchool[]>();

  for (const school of schools) {
    const list = schoolsByName.get(school.name) ?? [];
    list.push(school);
    schoolsByName.set(school.name, list);
  }

  for (const review of reviews) {
    const linkedSchool = Array.isArray(review.schools) ? review.schools[0] : review.schools;

    if (review.school_id && activeSchoolIds.has(review.school_id)) {
      addCount(counts, review.school_id);
      continue;
    }

    if (!review.school_name) continue;

    const matchedSchools = schoolsByName.get(review.school_name) ?? [];
    const pointsToInactiveOrMissingSchool =
      review.school_id && (!linkedSchool || linkedSchool.status !== 'active');

    if (!review.school_id || pointsToInactiveOrMissingSchool) {
      for (const school of matchedSchools) {
        addCount(counts, school.id);
      }
    }
  }

  return counts;
}

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
  const allSchools: SitemapSchool[] = [];
  let schoolFrom = 0;
  for (;;) {
    const { data: schools, error } = await supabase
      .from('schools')
      .select('id, name, slug, updated_at')
      .eq('status', 'active')
      .eq('is_public', true)
      .not('slug', 'is', null)
      .order('slug')
      .range(schoolFrom, schoolFrom + PAGE_SIZE - 1);

    if (error || !schools?.length) break;
    allSchools.push(...schools);
    if (schools.length < PAGE_SIZE) break;
    schoolFrom += PAGE_SIZE;
  }

  const allReviewLinks: SitemapReviewLink[] = [];
  let reviewLinkFrom = 0;
  for (;;) {
    const { data: reviews, error } = await supabase
      .from('survey_responses')
      .select('school_id, school_name, schools(id, status)')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(reviewLinkFrom, reviewLinkFrom + PAGE_SIZE - 1);

    if (error || !reviews?.length) break;
    allReviewLinks.push(...reviews);
    if (reviews.length < PAGE_SIZE) break;
    reviewLinkFrom += PAGE_SIZE;
  }

  const reviewCountsBySchool = countReviewsBySchool(allSchools, allReviewLinks);

  for (const school of allSchools) {
    if (!school.slug) continue;
    const slug = encodePathSegment(school.slug);
    const lastModified = school.updated_at ? new Date(school.updated_at) : new Date();

    out.push({
      url: `${baseUrl}/schools/${slug}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    });

    if ((reviewCountsBySchool.get(school.id) ?? 0) >= MIN_SCHOOL_REVIEWS_FOR_REVIEWS_SITEMAP) {
      out.push({
        url: `${baseUrl}/schools/${slug}/reviews`,
        lastModified,
        changeFrequency: 'weekly',
        priority: 0.85,
      });
    }
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
      const slug = encodePathSegment(article.slug);
      out.push({
        url: `${baseUrl}/features/${slug}`,
        lastModified: article.updated_at ? new Date(article.updated_at) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }

    if (articles.length < PAGE_SIZE) break;
    articleFrom += PAGE_SIZE;
  }

  return out;
}
