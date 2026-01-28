'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getClient } from '@/lib/supabase/client';
import { checkAdminAccess } from '@/lib/auth/client';
import type { AdminUser } from '@/lib/auth/client';
import { apiPath, appPath } from '@/lib/base-path';

export default function AdminHeader() {
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAccess().then((user) => {
      setAdminUser(user);
      setLoading(false);
    }).catch((error) => {
      console.error('[AdminHeader] checkAdminAccess error:', error);
      setLoading(false);
    });
  }, []);

  const handleLogout = async () => {
    if (!confirm('ログアウトしますか？')) {
      return;
    }

    try {
      const response = await fetch(apiPath('/api/auth/logout'), {
        method: 'POST',
      });

      if (response.ok) {
        const supabase = getClient();
        await supabase.auth.signOut();
        router.push(appPath('/admin/login'));
        router.refresh();
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('ログアウトに失敗しました');
    }
  };

  if (loading) {
    return null;
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href={appPath('/admin')} className="text-xl font-bold text-gray-900">
              管理画面
            </Link>
            <nav className="flex space-x-4">
              <Link
                href={appPath('/admin/schools')}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                高校管理
              </Link>
              <Link
                href={appPath('/admin/articles')}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                記事管理
              </Link>
              <Link
                href={appPath('/admin/contacts')}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                お問い合わせ
              </Link>
              {adminUser?.role === 'owner' && (
                <Link
                  href={appPath('/admin/admin-users')}
                  className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  管理者管理
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            {adminUser && (
              <span className="text-sm text-gray-600">
                {adminUser.email} ({adminUser.role === 'owner' ? 'オーナー' : '管理者'})
              </span>
            )}
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
