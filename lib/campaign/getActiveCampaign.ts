import { createClient } from '@supabase/supabase-js';

export interface ActiveCampaign {
  id: string;
  title: string;
  description: string | null;
  reward_amount: number;
  ends_at: string;
}

/** 現在有効なキャンペーンを1件取得（なければ null） */
export async function getActiveCampaign(): Promise<ActiveCampaign | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key);
  const { data } = await supabase
    .from('campaigns')
    .select('id, title, description, reward_amount, ends_at')
    .eq('is_active', true)
    .lte('starts_at', new Date().toISOString())
    .gte('ends_at', new Date().toISOString())
    .limit(1)
    .single();

  return data ?? null;
}

export function formatRewardAmount(amount: number): string {
  return `${amount.toLocaleString('ja-JP')}円分`;
}

export function getDaysLeft(endsAt: string): number {
  const end = new Date(endsAt);
  return Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}
