import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BASE_PATH } from '@/lib/base-path';

const APEX_ORIGIN = 'https://careeressence.jp';

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const pathname = request.nextUrl.pathname;
  const isVercelApp = host.endsWith('.vercel.app');
  const isWww = host === 'www.careeressence.jp';
  // 本番では必ず vercel.app → apex にリダイレクトする（SEO・社内利用のため vercel ドメインを実質クローズ）
  const isProduction = process.env.VERCEL_ENV === 'production';
  const skipVercelRedirect =
    !isProduction &&
    (process.env.SKIP_VERCEL_APP_REDIRECT === '1' || process.env.SKIP_VERCEL_APP_REDIRECT === 'true');

  // 1. ホスト正規化（最優先）: www / vercel.app → apex に恒久リダイレクト
  // / は会社トップ、/tsushin-kuchikomi はアプリトップ。パスはそのまま転送。
  if (isWww || (isVercelApp && !skipVercelRedirect)) {
    const path = pathname + request.nextUrl.search;
    const redirectUrl = new URL(path, APEX_ORIGIN);
    const res = NextResponse.redirect(redirectUrl, { status: 308 });
    if (isVercelApp) {
      res.headers.set('X-Robots-Tag', 'noindex');
    }
    return res;
  }

  // 2. /tsushin-kuchikomi/admin/* を保護（rewrites で path は /tsushin-kuchikomi 始まり）
  const adminPrefix = `${BASE_PATH}/admin`;
  if (pathname.startsWith(adminPrefix)) {
    if (pathname === `${BASE_PATH}/admin/login` || pathname === `${BASE_PATH}/admin/reset-password`) {
      return NextResponse.next();
    }

    // エージェント API は Bearer 認証を使うため middleware の Cookie チェックをスキップ
    if (pathname.startsWith(`${BASE_PATH}/api/admin/agent/`)) {
      return NextResponse.next();
    }

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

    // セッション確認
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user || !user.email) {
      const url = request.nextUrl.clone();
      url.pathname = `${BASE_PATH}/admin/login`;
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    // admin_usersテーブルで権限確認
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: adminUser, error: adminError } = await adminSupabase
      .from('admin_users')
      .select('*')
      .eq('email', user.email)
      .eq('is_active', true)
      .single();

    if (adminError || !adminUser) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/403';
      return NextResponse.rewrite(url);
    }

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
