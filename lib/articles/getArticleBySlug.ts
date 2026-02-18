import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Article, ArticleSchool } from '@/lib/types/articles';

/**
 * スラッグで記事1件を取得（Server Component / API 共通）
 * cache() により同一リクエスト内での重複取得を防ぐ
 */
export const getArticleBySlug = cache(
  async (slug: string): Promise<Article | null> => {
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
      .select(`
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
      `)
      .eq('article_id', article.id)
      .order('display_order', { ascending: true });

    const schoolsWithStats = await Promise.all(
      (articleSchools || []).map(async (articleSchool: {
        id: string;
        article_id: string;
        school_id: string;
        display_order: number;
        note: string | null;
        schools: { id: string; name: string; prefecture: string; slug: string | null } | { id: string; name: string; prefecture: string; slug: string | null }[] | null;
      }) => {
        const rawSchools = articleSchool.schools;
        const school = Array.isArray(rawSchools) ? rawSchools[0] ?? null : rawSchools;
        if (!school) return null;

        const { count: reviewCount } = await supabase
          .from('survey_responses')
          .select('*', { count: 'exact', head: true })
          .eq('school_id', school.id)
          .eq('is_public', true);

        const { data: reviews } = await supabase
          .from('survey_responses')
          .select('overall_satisfaction')
          .eq('school_id', school.id)
          .eq('is_public', true)
          .not('overall_satisfaction', 'is', null);

        const overallAvg =
          reviews && reviews.length > 0
            ? reviews.reduce((sum, r) => sum + r.overall_satisfaction, 0) /
              reviews.length
            : null;

        return {
          id: articleSchool.id,
          article_id: articleSchool.article_id,
          school_id: articleSchool.school_id,
          display_order: articleSchool.display_order,
          note: articleSchool.note,
          school: {
            id: school.id,
            name: school.name,
            prefecture: school.prefecture,
            slug: school.slug,
            review_count: reviewCount || 0,
            overall_avg: overallAvg ? parseFloat(overallAvg.toFixed(2)) : null,
          },
        } as ArticleSchool;
      })
    );

    return {
      ...article,
      schools: schoolsWithStats.filter((s): s is ArticleSchool => s !== null),
    } as Article;
  }
);
