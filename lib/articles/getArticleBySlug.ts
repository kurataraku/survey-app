import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getSearchSchoolsByIds, type SearchSchool } from '@/lib/schools/searchSchools';
import type { Article, ArticleSchool } from '@/lib/types/articles';

function searchSchoolFallback(
  school: { id: string; name: string; prefecture: string; slug: string | null }
): SearchSchool {
  return {
    id: school.id,
    name: school.name,
    prefecture: school.prefecture,
    prefectures: null,
    slug: school.slug,
    highlights: null,
    intro: null,
    review_count: 0,
    overall_avg: null,
    latest_good_comment: null,
    latest_bad_comment: null,
    staff_avg: null,
    atmosphere_avg: null,
    credit_avg: null,
    tuition_avg: null,
    review_tendency: null,
  };
}

/**
 * スラッグで記事1件を取得（Server Component / API 共通）
 * cache() により同一リクエスト内での重複取得を防ぐ
 */
export const getArticleBySlug = cache(async (slug: string): Promise<Article | null> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: article, error: articleError } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (articleError || !article) {
    return null;
  }

  const { data: articleSchools } = await supabase
    .from('article_schools')
    .select(
      `
        id,
        article_id,
        school_id,
        display_order,
        note,
        schools (
          id,
          name,
          prefecture,
          slug
        )
      `
    )
    .eq('article_id', article.id)
    .order('display_order', { ascending: true });

  type JoinRow = {
    id: string;
    article_id: string;
    school_id: string;
    display_order: number;
    note: string | null;
    schools:
      | { id: string; name: string; prefecture: string; slug: string | null }
      | { id: string; name: string; prefecture: string; slug: string | null }[]
      | null;
  };

  const rows = (articleSchools || []) as JoinRow[];
  const orderedIds: string[] = [];
  for (const row of rows) {
    const rawSchools = row.schools;
    const school = Array.isArray(rawSchools) ? rawSchools[0] ?? null : rawSchools;
    if (school?.id) orderedIds.push(school.id);
  }

  const snapshots = await getSearchSchoolsByIds(orderedIds);

  const schoolsWithStats: ArticleSchool[] = rows
    .map((articleSchool) => {
      const rawSchools = articleSchool.schools;
      const school = Array.isArray(rawSchools) ? rawSchools[0] ?? null : rawSchools;
      if (!school) return null;

      const snap = snapshots.get(school.id);
      const fullSchool = snap ?? searchSchoolFallback(school);

      return {
        id: articleSchool.id,
        article_id: articleSchool.article_id,
        school_id: articleSchool.school_id,
        display_order: articleSchool.display_order,
        note: articleSchool.note,
        school: fullSchool,
      } as ArticleSchool;
    })
    .filter((s): s is ArticleSchool => s !== null);

  return {
    ...article,
    schools: schoolsWithStats,
  } as Article;
});
