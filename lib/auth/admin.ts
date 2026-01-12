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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/auth/admin.ts:27',message:'getAdminUser entry',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  try {
    const supabase = await createServerSupabaseClient();
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/auth/admin.ts:34',message:'Before getUser call',data:{hasSupabaseClient:!!supabase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    // セッション確認
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/auth/admin.ts:40',message:'After getUser call',data:{hasUser:!!user,hasEmail:!!user?.email,userEmail:user?.email||null,authError:authError?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    if (authError || !user || !user.email) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/auth/admin.ts:43',message:'Auth failed, returning null',data:{authError:authError?.message||null,hasUser:!!user,hasEmail:!!user?.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return null;
    }

    // admin_usersテーブルで権限確認
    const adminSupabase = createAdminSupabaseClient();
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/auth/admin.ts:48',message:'Before admin_users query',data:{userEmail:user.email,hasAdminSupabase:!!adminSupabase},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    
    const { data: adminUser, error: adminError } = await adminSupabase
      .from('admin_users')
      .select('*')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/auth/admin.ts:54',message:'After admin_users query',data:{hasAdminUser:!!adminUser,adminError:adminError?.message||null,adminErrorCode:adminError?.code||null,adminUserRole:adminUser?.role||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    if (adminError || !adminUser) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/auth/admin.ts:57',message:'Admin user not found, returning null',data:{adminError:adminError?.message||null,adminErrorCode:adminError?.code||null,hasAdminUser:!!adminUser},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return null;
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/auth/admin.ts:63',message:'getAdminUser success',data:{userId:user.id,userEmail:user.email,adminUserRole:adminUser.role},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      adminUser: adminUser as AdminUser,
    };
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/auth/admin.ts:66',message:'getAdminUser exception',data:{errorMessage:error instanceof Error ? error.message : String(error),errorStack:error instanceof Error ? error.stack : undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
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
