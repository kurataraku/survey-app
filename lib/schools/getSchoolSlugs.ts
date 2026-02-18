import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';

/**
 * 公開学校のslug一覧を取得（generateStaticParams用）
 */
export const getSchoolSlugs = cache(async (): Promise<{ slug: string }[]> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('schools')
    .select('slug')
    .eq('is_public', true)
    .eq('status', 'active');

  if (error) {
    console.error('[getSchoolSlugs]', error);
    return [];
  }

  return (data || [])
    .filter((row): row is { slug: string } => !!row?.slug)
    .map((row) => ({ slug: row.slug }));
});
