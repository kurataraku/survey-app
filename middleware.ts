import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BASE_PATH } from '@/lib/base-path';

const APEX_ORIGIN = 'https://careeressence.jp';

export async function middleware(request: NextRequest) {
  // 1. ホスト正規化（最優先）: www / vercel.app → apex に恒久リダイレクト
  const host = request.headers.get('host') ?? '';
  const isVercelApp = host.endsWith('.vercel.app');
  const isWww = host === 'www.careeressence.jp';
  const skipVercelRedirect = process.env.SKIP_VERCEL_APP_REDIRECT === '1' || process.env.SKIP_VERCEL_APP_REDIRECT === 'true';

  if (isWww || (isVercelApp && !skipVercelRedirect)) {
    const p = request.nextUrl.pathname;
    // / のみ BASE_PATH に。それ以外は path をそのまま使う（重ねて /tsushin-kuchikomi/tsushin-kuchikomi にしない）
    const destPath = p === '/' ? BASE_PATH : p;
    const path = destPath + request.nextUrl.search;
    const redirectUrl = new URL(path, APEX_ORIGIN);
    const res = NextResponse.redirect(redirectUrl, { status: 308 });
    if (isVercelApp) {
      res.headers.set('X-Robots-Tag', 'noindex');
    }
    return res;
  }

  // 2. /tsushin-kuchikomi/admin/* を保護（rewrites で path は /tsushin-kuchikomi 始まり）
  const adminPrefix = `${BASE_PATH}/admin`;
  if (request.nextUrl.pathname.startsWith(adminPrefix)) {
    if (request.nextUrl.pathname === `${BASE_PATH}/admin/login` || request.nextUrl.pathname === `${BASE_PATH}/admin/reset-password`) {
      return NextResponse.next();
    }

    // #region agent log
    const logData = { pathname: request.nextUrl.pathname, cookieCount: request.cookies.getAll().length };
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:7',message:'Middleware entry',data:logData,timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    // クライアントを作成（cookiesを読み書きできるようにする）
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:44',message:'Before getUser call',data:{hasSupabaseClient:!!supabase,hasUrl:!!process.env.NEXT_PUBLIC_SUPABASE_URL,hasAnonKey:!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // セッション確認
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:49',message:'After getUser call',data:{hasUser:!!user,hasEmail:!!user?.email,userEmail:user?.email||null,authError:authError?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    if (authError || !user || !user.email) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:52',message:'Auth failed, redirecting to login',data:{authError:authError?.message||null,hasUser:!!user,hasEmail:!!user?.email},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const url = request.nextUrl.clone();
      url.pathname = `${BASE_PATH}/admin/login`;
      url.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    // admin_usersテーブルで権限確認
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:64',message:'Before admin_users query',data:{userEmail:user.email,hasAdminSupabase:!!adminSupabase,hasServiceKey:!!process.env.SUPABASE_SERVICE_ROLE_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    const { data: adminUser, error: adminError } = await adminSupabase
      .from('admin_users')
      .select('*')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:70',message:'After admin_users query',data:{hasAdminUser:!!adminUser,adminError:adminError?.message||null,adminErrorCode:adminError?.code||null,adminUserRole:adminUser?.role||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    if (adminError || !adminUser) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:73',message:'Admin user not found, showing 403',data:{adminError:adminError?.message||null,adminErrorCode:adminError?.code||null,hasAdminUser:!!adminUser},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const url = request.nextUrl.clone();
      url.pathname = '/admin/403';
      return NextResponse.rewrite(url);
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'middleware.ts:78',message:'Middleware auth success',data:{userEmail:user.email,adminUserRole:adminUser.role},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // 認証・権限OK: 続行
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
