'use client';

import { getClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPath, appPath } from '@/lib/base-path';

export interface AdminUser {
  id: string;
  email: string;
  role: 'owner' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * クライアント側で現在のセッションを取得
 */
export async function getSession() {
  const supabase = getClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

/**
 * クライアント側で現在のユーザーを取得
 */
export async function getUser() {
  const supabase = getClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * クライアント側でadmin権限をチェック
 * UI制御用（API routeでの認証チェックとは別）
 */
export async function checkAdminAccess(): Promise<AdminUser | null> {
  try {
    const user = await getUser();
    if (!user || !user.email) {
      return null;
    }

    const response = await fetch(apiPath('/api/auth/admin-check'));
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.adminUser || null;
  } catch (error) {
    console.error('[checkAdminAccess] Error:', error);
    return null;
  }
}

/**
 * React Hook: 管理者権限をチェック
 */
export function useAdminAccess() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAdminAccess()
      .then((user) => {
        setAdminUser(user);
        if (!user) {
          router.push(appPath('/admin/login'));
        }
      })
      .catch(() => {
        router.push(appPath('/admin/login'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  return { adminUser, loading };
}
