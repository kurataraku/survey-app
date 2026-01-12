'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useMemo } from 'react';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// シングルトンインスタンス（クライアントコンポーネント内でのみ使用）
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function getClient() {
  if (typeof window === 'undefined') {
    throw new Error('getClient() should only be called in client components');
  }

  if (!browserClient) {
    browserClient = createClient();
  }

  return browserClient;
}
