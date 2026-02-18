import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';

/**
 * 公開口コミのID一覧を取得（generateStaticParams用）
 */
export const getReviewIds = cache(async (): Promise<{ id: string }[]> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('survey_responses')
    .select('id')
    .eq('is_public', true)
    .not('school_id', 'is', null);

  if (error) {
    console.error('[getReviewIds]', error);
    return [];
  }

  return (data || [])
    .filter((row): row is { id: string } => !!row?.id)
    .map((row) => ({ id: row.id }));
});
