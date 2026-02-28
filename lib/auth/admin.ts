import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase/server';

export interface AdminUser {
  id: string;
  email: string;
  role: 'owner' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface AdminAuthResult {
  user: AuthUser;
  adminUser: AdminUser;
}

/**
 * API route用: セッション確認とadmin_users照会
 * 未認証または権限なしの場合はnullを返す（エラーは投げない）
 */
export async function getAdminUser(
  request: NextRequest
): Promise<AdminAuthResult | null> {
  try {
    const supabase = await createServerSupabaseClient();

    // セッション確認
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      return null;
    }

    // admin_usersテーブルで権限確認
    const adminSupabase = createAdminSupabaseClient();
    const { data: adminUser, error: adminError } = await adminSupabase
      .from('admin_users')
      .select('*')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (adminError || !adminUser) {
      return null;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      adminUser: adminUser as AdminUser,
    };
  } catch (error) {
    console.error('[getAdminUser] Error:', error);
    return null;
  }
}

/**
 * API route用: 管理者権限を要求
 * 権限なしの場合は403エラーを返す
 */
export async function requireAdmin(
  request: NextRequest
): Promise<AdminAuthResult | NextResponse> {
  const result = await getAdminUser(request);

  if (!result) {
    return NextResponse.json(
      { error: '認証が必要です。管理者権限がありません。' },
      { status: 403 }
    );
  }

  return result;
}

/**
 * API route用: 管理者権限 または エージェント API Key を要求
 * AGENT_API_KEY による Bearer 認証を優先的にチェックし、
 * 一致しなければ従来の Cookie ベース認証にフォールバックする
 */
export async function requireAdminOrAgent(
  request: NextRequest
): Promise<AdminAuthResult | NextResponse> {
  const authHeader = request.headers.get('authorization');
  const agentKey = process.env.AGENT_API_KEY;

  if (agentKey && authHeader === `Bearer ${agentKey}`) {
    return {
      user: { id: 'agent', email: 'agent@system' },
      adminUser: {
        id: 'agent',
        email: 'agent@system',
        role: 'owner',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };
  }

  return requireAdmin(request);
}

/**
 * API route用: owner権限を要求
 * owner以外の場合は403エラーを返す
 */
export async function requireOwner(
  request: NextRequest
): Promise<(AdminAuthResult & { adminUser: AdminUser & { role: 'owner' } }) | NextResponse> {
  const result = await requireAdmin(request);

  if (result instanceof NextResponse) {
    return result;
  }

  if (result.adminUser.role !== 'owner') {
    return NextResponse.json(
      { error: 'owner権限が必要です。' },
      { status: 403 }
    );
  }

  return result as AdminAuthResult & { adminUser: AdminUser & { role: 'owner' } };
}
