'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getClient } from '@/lib/supabase/client';

let schoolClient: ReturnType<typeof createBrowserClient> | undefined;

export function getPartnershipAuth(scope: 'school' | 'operator') {
  if (scope === 'operator') return getClient();
  const url = process.env.NEXT_PUBLIC_SCHOOL_AUTH_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SCHOOL_AUTH_SUPABASE_ANON_KEY;
  const main = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !key || !main || new URL(url).origin === new URL(main).origin) throw new Error('学校向け認証の準備中です。');
  schoolClient ??= createBrowserClient(url, key, { isSingleton: false });
  return schoolClient;
}
