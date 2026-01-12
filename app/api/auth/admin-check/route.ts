import { NextRequest, NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/admin';

/**
 * クライアント側でadmin権限をチェックするためのAPI
 */
export async function GET(request: NextRequest) {
  const result = await getAdminUser(request);

  if (!result) {
    return NextResponse.json(
      { error: '認証が必要です。管理者権限がありません。' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    adminUser: result.adminUser,
  });
}
