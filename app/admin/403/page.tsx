'use client';

import Link from 'next/link';
import { appPath } from '@/lib/base-path';

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-9xl font-bold text-gray-300">403</h1>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            アクセス権限がありません
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            このページにアクセスするには管理者権限が必要です。
          </p>
        </div>
        <div className="space-y-4">
          <Link
            href={appPath('/admin/login')}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            ログインページに戻る
          </Link>
          <Link
            href={appPath('/')}
            className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            トップページに戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
