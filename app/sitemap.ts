import { MetadataRoute } from 'next';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAppBaseUrl, getSiteUrl } from '@/lib/env-check';
import { getPrefecturePath, prefectures } from '@/lib/prefectures';
import { isThinSchoolPage } from '@/lib/seo/thin-school-page';
import {
  countReviewsBySchool,
  type ReviewSchoolLink,
} from '@/lib/seo/school-review-counts';

const PAGE_SIZE = 1000;
/** .in() のURL長を抑えるためのIDチャンクサイズ */
const ID_CHUNK_SIZE = 150;

type SitemapSchool = {
  id: string;
  name: string;
  slug: string | null;
  intro: string | null;
  updated_at: string | null;
};

function encodePathSegment(segment: string): string {
  return encodeURIComponent(segment);
}

/**
 * 指定テーブルで published 行を持つ school_id の集合を返す。
 * 1件でも取得に失敗したら null を返す。不完全な集合で薄いページ判定をすると
 * 中身のある学校URLをサイトマップから落としてしまうため。
 */
async function fetchPublishedSchoolIds(
  supabase: SupabaseClient,
  table: string,
  schoolIds: string[]
): Promise<Set<string> | null> {
  const out = new Set<string>();

  for (let i = 0; i < schoolIds.length; i += ID_CHUNK_SIZE) {
    const slice = schoolIds.slice(i, i + ID_CHUNK_SIZE);
    const { data, error } = await supabase
      .from(table)
      .select('school_id')
      .in('school_id', slice)
      .eq('status', 'published');

    if (error) {
      console.error(`[sitemap] ${table}:`, error);
      return null;
    }

    for (const row of (data as { school_id: string | null }[] | null) ?? []) {
      if (row.school_id) out.add(row.school_id);
    }
  }

  return out;
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
      .select('id, name, slug, intro, updated_at')
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

  const allReviewLinks: ReviewSchoolLink[] = [];
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

  // 実質空の学校ページをサイトマップから除くための公開コンテンツ状況
  const allSchoolIds = allSchools.map((school) => school.id);
  const [aiContentSchoolIds, tuitionSchoolIds, courseSchoolIds] = await Promise.all([
    fetchPublishedSchoolIds(supabase, 'school_ai_summaries', allSchoolIds),
    fetchPublishedSchoolIds(supabase, 'school_tuition_estimates', allSchoolIds),
    fetchPublishedSchoolIds(supabase, 'school_course_listings', allSchoolIds),
  ]);
  // 取得に失敗した場合は誤除外を避けるため、薄いページの絞り込み自体を行わない
  const canFilterThinSchools =
    aiContentSchoolIds !== null && tuitionSchoolIds !== null && courseSchoolIds !== null;

  for (const school of allSchools) {
    if (!school.slug) continue;

    const reviewCount = reviewCountsBySchool.get(school.id) ?? 0;
    if (
      canFilterThinSchools &&
      isThinSchoolPage({
        reviewCount,
        intro: school.intro,
        hasPublishedAiContent: aiContentSchoolIds!.has(school.id),
        hasTuitionEstimate: tuitionSchoolIds!.has(school.id),
        hasCourseListing: courseSchoolIds!.has(school.id),
      })
    ) {
      continue;
    }

    const slug = encodePathSegment(school.slug);
    const lastModified = school.updated_at ? new Date(school.updated_at) : new Date();

    out.push({
      url: `${baseUrl}/schools/${slug}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    });
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
