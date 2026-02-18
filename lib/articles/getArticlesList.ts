import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';

export interface ArticleListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string | null;
  published_at: string | null;
  featured_image_url: string | null;
  [key: string]: unknown;
}

export interface GetArticlesListParams {
  page?: number;
  limit?: number;
  category?: 'interview' | 'useful_info' | '';
}

export interface GetArticlesListResult {
  articles: ArticleListItem[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export const getArticlesList = cache(async (
  params: GetArticlesListParams = {}
): Promise<GetArticlesListResult> => {
  const { page = 1, limit = 12, category = '' } = params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { articles: [], total: 0, page, totalPages: 0, limit };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const offset = (page - 1) * limit;

  let query = supabase
    .from('articles')
    .select('*', { count: 'exact' })
    .eq('is_public', true);

  if (category && (category === 'interview' || category === 'useful_info')) {
    query = query.eq('category', category);
  }

  const { data: articles, error, count } = await query
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[getArticlesList]', error);
    return { articles: [], total: 0, page, totalPages: 0, limit };
  }

  const articlesList = (articles || []) as ArticleListItem[];
  const totalCount = count ?? 0;
  return {
    articles: articlesList,
    total: totalCount,
    page,
    totalPages: Math.ceil(totalCount / limit),
    limit,
  };
});
