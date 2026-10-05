import type { SupabaseClient } from '@supabase/supabase-js';
import { escapeLikePattern, normalizeEmail } from './server';

const UNIQUE_VIOLATION = '23505';

interface ApprovedReview {
  id: string;
  email: string;
  ip_hash: string | null;
  referral_code_id: string | null;
}

interface GrantCampaign {
  id: string;
  reward_amount: number;
  referral_enabled: boolean;
  referral_reward_amount: number | null;
  referral_max_per_referrer: number | null;
}

interface ReferralCode {
  id: string;
  referrer_email: string;
  is_active: boolean;
}

export type ReferrerGrantResult =
  | { created: true; flagReason: string | null }
  | { created: false; reason: 'not_referred' | 'invalid_code' | 'cap_reached' | 'already_exists' | 'error' };

async function resolveReferralCode(
  supabase: SupabaseClient,
  review: ApprovedReview,
  campaign: GrantCampaign
): Promise<ReferralCode | null> {
  if (!campaign.referral_enabled || !review.referral_code_id) return null;
  const { data } = await supabase
    .from('referral_codes')
    .select('id, referrer_email, is_active')
    .eq('id', review.referral_code_id)
    .maybeSingle();
  if (!data?.is_active) return null;
  if (data.referrer_email === normalizeEmail(review.email)) return null;
  return data as ReferralCode;
}

/** 紹介者と被紹介者が同一人物と疑われる理由を集める（自動では却下せず管理者確認に回す） */
async function collectReferrerFlags(
  supabase: SupabaseClient,
  review: ApprovedReview,
  referralCode: ReferralCode
): Promise<string[]> {
  const flags: string[] = [];

  const { data: referrerResponses } = await supabase
    .from('survey_responses')
    .select('id, moderation_status, ip_hash')
    .ilike('email', escapeLikePattern(referralCode.referrer_email));
  const responses = referrerResponses ?? [];

  if (!responses.some((r) => r.moderation_status === 'approved')) {
    flags.push('紹介者本人の口コミが未承認');
  }
  if (review.ip_hash && responses.some((r) => r.ip_hash === review.ip_hash)) {
    flags.push('紹介者と同じ送信元IP');
  }

  const { data: moderation } = await supabase
    .from('review_moderation_results')
    .select('similar_response_ids')
    .eq('survey_response_id', review.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const similarIds: string[] = moderation?.similar_response_ids ?? [];
  if (similarIds.some((id) => responses.some((r) => r.id === id))) {
    flags.push('紹介者の口コミと文面が類似');
  }

  return flags;
}

/**
 * 口コミ承認時に謝礼レコードを作る。
 *
 * 1 回答につき回答者本人の謝礼は必ず 1 件だけ（review か referee のどちらか）で、
 * 紹介経由でも「通常謝礼＋紹介謝礼」の二重付与はしない。
 *   回答者本人 : campaign.reward_amount（紹介経由なら grant_type='referee'）
 *   紹介者     : campaign.referral_reward_amount ?? reward_amount（grant_type='referrer'）
 * 金額は承認時点のキャンペーン設定を reward_amount に保存し、後の設定変更の影響を受けない。
 */
export async function createGrantsOnApproval({
  supabase,
  review,
  campaign,
  giftUrl,
}: {
  supabase: SupabaseClient;
  review: ApprovedReview;
  campaign: GrantCampaign;
  giftUrl?: string;
}): Promise<{ referrer: ReferrerGrantResult }> {
  const referralCode = await resolveReferralCode(supabase, review, campaign);
  const referrerAmount = campaign.referral_reward_amount ?? campaign.reward_amount;

  const { error: ownGrantError } = await supabase.from('campaign_grants').insert({
    campaign_id: campaign.id,
    survey_response_id: review.id,
    email: review.email,
    gift_code: giftUrl ?? null,
    sent_at: giftUrl ? new Date().toISOString() : null,
    status: giftUrl ? 'sent' : 'pending',
    error_message: null,
    grant_type: referralCode ? 'referee' : 'review',
    reward_amount: campaign.reward_amount,
    referral_code_id: referralCode?.id ?? null,
  });
  if (ownGrantError && ownGrantError.code !== UNIQUE_VIOLATION) {
    console.error('[grants] 謝礼レコード作成エラー:', ownGrantError);
  }

  if (!review.referral_code_id) return { referrer: { created: false, reason: 'not_referred' } };
  if (!referralCode) return { referrer: { created: false, reason: 'invalid_code' } };

  // 上限は NULL（無制限）が既定。値が設定されたキャンペーンだけ件数を数える
  const max = campaign.referral_max_per_referrer;
  if (max != null) {
    const { count } = await supabase
      .from('campaign_grants')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('referral_code_id', referralCode.id)
      .eq('grant_type', 'referrer')
      .neq('status', 'cancelled');
    if ((count ?? 0) >= max) return { referrer: { created: false, reason: 'cap_reached' } };
  }

  const flags = await collectReferrerFlags(supabase, review, referralCode);
  const flagReason = flags.length > 0 ? flags.join(' / ') : null;

  const { error } = await supabase.from('campaign_grants').insert({
    campaign_id: campaign.id,
    survey_response_id: review.id,
    email: referralCode.referrer_email,
    gift_code: null,
    sent_at: null,
    status: 'pending',
    error_message: null,
    grant_type: 'referrer',
    reward_amount: referrerAmount,
    referral_code_id: referralCode.id,
    flag_reason: flagReason,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { referrer: { created: false, reason: 'already_exists' } };
    console.error('[grants] 紹介者謝礼レコード作成エラー:', error);
    return { referrer: { created: false, reason: 'error' } };
  }
  return { referrer: { created: true, flagReason } };
}
