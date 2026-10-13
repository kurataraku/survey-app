import type { SupabaseClient } from '@supabase/supabase-js';
import { giftUrlToken, isSameGiftUrl } from './giftUrl';

/** ギフトURLは1人にしか使えないため、他の配布記録（キャンペーン・状態を問わず）に同じURLがないか調べる */
export async function findGrantWithSameGiftUrl(
  supabase: SupabaseClient,
  giftUrl: string,
  excludeGrantId?: string
): Promise<{ grant: { id: string; email: string } | null; error?: string }> {
  const token = giftUrlToken(giftUrl);
  if (!token) return { grant: null };
  const pattern = `%${token.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  let query = supabase.from('campaign_grants').select('id, email, gift_code').like('gift_code', pattern);
  if (excludeGrantId) query = query.neq('id', excludeGrantId);
  const { data, error } = await query;
  if (error) return { grant: null, error: error.message };

  const hit = (data ?? []).find((row) => isSameGiftUrl(row.gift_code, giftUrl));
  return { grant: hit ? { id: hit.id, email: hit.email } : null };
}

export function duplicateGiftUrlMessage(email: string): string {
  return `このURLは既に別の配布記録（${email}）で使われています。新しいQUOカードPayのURLを発行して入力してください。`;
}
