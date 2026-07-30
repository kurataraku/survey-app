import type { SupabaseClient } from '@supabase/supabase-js';

export type SlugHistorySupabase = SupabaseClient;

export function normalizeSlugValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function recordSchoolSlugHistory(
  supabase: SlugHistorySupabase,
  input: {
    schoolId: string;
    oldSlug: unknown;
    reason?: 'manual_update' | 'merge';
  }
): Promise<void> {
  const oldSlug = normalizeSlugValue(input.oldSlug);
  if (!oldSlug) return;

  const { error } = await supabase.from('school_slug_history').upsert(
    {
      school_id: input.schoolId,
      old_slug: oldSlug,
      reason: input.reason ?? 'manual_update',
    },
    { onConflict: 'old_slug' }
  );

  if (error) {
    // 履歴保存の失敗で本体更新や統合を止めない。マイグレーション未適用環境でも動作を維持する。
    console.error('[slug-history] failed to record slug history:', error);
  }
}
