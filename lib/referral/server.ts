import { createHmac, randomInt } from 'crypto';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BASE_PATH } from '@/lib/base-path';
import {
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  REFERRAL_QUERY_PARAM,
  type ReferralShareInfo,
} from './shared';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://careeressence.jp';

export interface ReferralCodeRow {
  id: string;
  code: string;
  referrer_email: string;
  is_active: boolean;
}

export interface ReferralCampaign {
  id: string;
  rewardAmount: number;
  referrerRewardAmount: number;
  endsAt: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** ilike で完全一致させるためにワイルドカードをエスケープする */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function generateReferralCode(): string {
  let code = '';
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += REFERRAL_CODE_ALPHABET[randomInt(REFERRAL_CODE_ALPHABET.length)];
  }
  return code;
}

export function buildReferralUrl(code: string): string {
  return `${SITE_URL}${BASE_PATH}/survey?${REFERRAL_QUERY_PARAM}=${code}`;
}

export function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || null;
  return request.headers.get('x-real-ip');
}

export function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  const secret = process.env.REFERRAL_HASH_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createHmac('sha256', secret).update(ip).digest('hex');
}

/** 有効期間中かつ紹介制度がオンのキャンペーン */
export async function getActiveReferralCampaign(
  supabase: SupabaseClient
): Promise<ReferralCampaign | null> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('campaigns')
    .select('id, reward_amount, referral_reward_amount, ends_at')
    .eq('is_active', true)
    .eq('referral_enabled', true)
    .lte('starts_at', now)
    .gte('ends_at', now)
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    rewardAmount: data.reward_amount,
    referrerRewardAmount: data.referral_reward_amount ?? data.reward_amount,
    endsAt: data.ends_at,
  };
}

export async function findReferralCode(
  supabase: SupabaseClient,
  code: string
): Promise<ReferralCodeRow | null> {
  const { data } = await supabase
    .from('referral_codes')
    .select('id, code, referrer_email, is_active')
    .eq('code', code)
    .maybeSingle();
  return data ?? null;
}

/** メールアドレスに紐づく紹介コードを返す。なければ発行する */
export async function getOrCreateReferralCode(
  supabase: SupabaseClient,
  email: string,
  surveyResponseId: string | null
): Promise<ReferralCodeRow | null> {
  const referrerEmail = normalizeEmail(email);
  if (!referrerEmail) return null;

  const selectExisting = async () => {
    const { data } = await supabase
      .from('referral_codes')
      .select('id, code, referrer_email, is_active')
      .eq('referrer_email', referrerEmail)
      .maybeSingle();
    return (data as ReferralCodeRow | null) ?? null;
  };

  const existing = await selectExisting();
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await supabase
      .from('referral_codes')
      .insert({
        code: generateReferralCode(),
        referrer_email: referrerEmail,
        first_survey_response_id: surveyResponseId,
      })
      .select('id, code, referrer_email, is_active')
      .single();

    if (!error && data) return data as ReferralCodeRow;
    if (error?.code !== '23505') {
      console.error('[referral] 紹介コード発行エラー:', error);
      return null;
    }
    // 同じメールで同時に発行された場合は既存を返す。コード衝突なら再生成する
    const raced = await selectExisting();
    if (raced) return raced;
  }
  return null;
}

/** 紹介の案内メールを配信停止しているか */
export async function isEmailUnsubscribed(
  supabase: SupabaseClient,
  email: string
): Promise<boolean> {
  const { data } = await supabase
    .from('email_unsubscribes')
    .select('email')
    .eq('email', normalizeEmail(email))
    .maybeSingle();
  return !!data;
}

/**
 * 紹介制度が有効なときだけ、回答者向けの紹介 URL 情報を返す。
 * forEmail のときは配信停止した人には返さない（メールに紹介の案内を載せない）。
 */
export async function getReferralShareInfo(
  supabase: SupabaseClient,
  email: string,
  surveyResponseId: string | null,
  options: { forEmail?: boolean } = {}
): Promise<ReferralShareInfo | null> {
  const campaign = await getActiveReferralCampaign(supabase);
  if (!campaign) return null;

  if (options.forEmail && (await isEmailUnsubscribed(supabase, email))) return null;

  const referralCode = await getOrCreateReferralCode(supabase, email, surveyResponseId);
  if (!referralCode || !referralCode.is_active) return null;

  return {
    code: referralCode.code,
    url: buildReferralUrl(referralCode.code),
    respondentRewardAmount: campaign.rewardAmount,
    referrerRewardAmount: campaign.referrerRewardAmount,
  };
}
