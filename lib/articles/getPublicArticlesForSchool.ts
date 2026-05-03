import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { ArticleCategory } from '@/lib/types/articles';

export type ArticleCardFields = {
  id: string;
  title: string;
  slug: string;
  category: ArticleCategory;
  excerpt: string | null;
  featured_image_url: string | null;
  published_at: string | null;
};

/**
 * 学校に紐づく公開記事（article_schools → articles）を display_order 順で最大 limit 件
 */
export const getPublicArticlesForSchool = cache(
  async (schoolId: string, limit = 6): Promise<ArticleCardFields[]> => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return [];

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: links, error: linksError } = await supabase
      .from('article_schools')
      .select('article_id, display_order')
      .eq('school_id', schoolId)
      .order('display_order', { ascending: true });

    if (linksError || !links?.length) return [];

    const articleIds = [...new Set(links.map((l) => l.article_id))];
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id, title, slug, category, excerpt, featured_image_url, published_at')
      .in('id', articleIds)
      .eq('is_public', true);

    if (articlesError || !articles?.length) return [];

    const order = new Map(links.map((l, i) => [l.article_id, l.display_order * 1000 + i]));
    const sorted = [...articles].sort(
      (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
    );

    return sorted.slice(0, limit).map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      category: a.category as ArticleCategory,
      excerpt: a.excerpt,
      featured_image_url: a.featured_image_url,
      published_at: a.published_at,
    }));
  }
);
