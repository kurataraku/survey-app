import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';

export type ArticleTitleEntry = {
  title: string;
  excerpt: string | null;
};

/** テーマハブ用に slug 一覧から公開記事のタイトル・抜粋をまとめて取得 */
export const getArticleTitlesBySlugs = cache(
  async (slugs: string[]): Promise<Map<string, ArticleTitleEntry>> => {
    const unique = [...new Set(slugs.filter(Boolean))];
    const result = new Map<string, ArticleTitleEntry>();
    if (unique.length === 0) return result;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return result;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase
      .from('articles')
      .select('slug, title, excerpt')
      .eq('is_public', true)
      .in('slug', unique);

    if (error) {
      console.error('[getArticleTitlesBySlugs]', error);
      return result;
    }

    for (const row of data ?? []) {
      if (row.slug && row.title) {
        result.set(row.slug, {
          title: row.title,
          excerpt: row.excerpt ?? null,
        });
      }
    }

    return result;
  }
);
