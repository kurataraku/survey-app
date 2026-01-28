import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { cache } from 'react';

/**
 * サーバー側でSupabaseクライアントを作成
 * Next.js Server ComponentsやAPI Routesで使用
 * cookiesからセッション情報を取得する
 */
export const createServerSupabaseClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
});

/**
 * Service Role Keyを使用するサーバー側クライアント
 * 管理者権限が必要な操作（ユーザー招待など）で使用
 */
export function createAdminSupabaseClient() {
  // Service Role Keyの場合は通常のcreateClientを使用（createServerClientは不要）
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
