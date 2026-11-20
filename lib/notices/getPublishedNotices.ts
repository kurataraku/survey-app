import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';

export interface SiteNotice {
  id: string;
  title: string;
  body: string | null;
  link_url: string | null;
  published_at: string;
}

/** リンク先として許可する形式（javascript: 等を弾く） */
export function isSafeNoticeLink(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^(https?:\/\/|\/(?!\/))/.test(url);
}

/** 公開中のお知らせを新しい順に取得する。失敗・未設定時は空配列。 */
export const getPublishedNotices = cache(async (limit?: number): Promise<SiteNotice[]> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];

  let query = createClient(url, key)
    .from('site_notices')
    .select('id, title, body, link_url, published_at')
    .eq('is_published', true)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false });
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) {
    console.error('[notices] 取得失敗:', error.message);
    return [];
  }
  return (data as SiteNotice[]) ?? [];
});
