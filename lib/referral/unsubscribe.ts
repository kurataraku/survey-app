import { createHmac, timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BASE_PATH } from '@/lib/base-path';
import { normalizeEmail } from './server';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://careeressence.jp';

function secret(): string {
  return process.env.REFERRAL_HASH_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

function sign(email: string): string {
  return createHmac('sha256', secret()).update(`unsubscribe:${email}`).digest('hex').slice(0, 32);
}

function encodeEmail(email: string): string {
  return Buffer.from(email, 'utf8').toString('base64url');
}

/** e（base64url のメール）と t（署名）を検証し、正しければ正規化済みメールを返す */
export function verifyUnsubscribeToken(e: unknown, t: unknown): string | null {
  if (typeof e !== 'string' || typeof t !== 'string' || !e || !t) return null;
  let email: string;
  try {
    email = normalizeEmail(Buffer.from(e, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!email.includes('@')) return null;
  const expected = Buffer.from(sign(email));
  const actual = Buffer.from(t);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return email;
}

function query(email: string): string {
  const normalized = normalizeEmail(email);
  return `e=${encodeEmail(normalized)}&t=${sign(normalized)}`;
}

/** メール本文に載せる配信停止ページ（確認ボタンを押して停止する） */
export function buildUnsubscribePageUrl(email: string): string {
  return `${SITE_URL}${BASE_PATH}/unsubscribe?${query(email)}`;
}

/** List-Unsubscribe ヘッダー用（RFC 8058 のワンクリック停止で POST される） */
export function buildUnsubscribeApiUrl(email: string): string {
  return `${SITE_URL}${BASE_PATH}/api/unsubscribe?${query(email)}`;
}

export async function recordUnsubscribe(supabase: SupabaseClient, email: string): Promise<boolean> {
  const { error } = await supabase
    .from('email_unsubscribes')
    .upsert({ email: normalizeEmail(email) }, { onConflict: 'email', ignoreDuplicates: true });
  if (error) console.error('[unsubscribe] 配信停止の保存に失敗:', error);
  return !error;
}
