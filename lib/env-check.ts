/**
 * 環境変数のチェックと取得
 * 本番環境での誤設定を防ぐ
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceKey: string;
  env: string;
}

export function getSupabaseConfig(): SupabaseConfig {
  const env = process.env.NODE_ENV || process.env.VERCEL_ENV || 'development';
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    throw new Error(
      'Supabase環境変数が設定されていません。\n' +
      'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY を設定してください。'
    );
  }

  // 本番環境では、開発用のURLが設定されていないかチェック
  if (env === 'production') {
    if (supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1')) {
      throw new Error(
        '本番環境で開発用のSupabase URLが設定されています。\n' +
        'NEXT_PUBLIC_SUPABASE_URL を本番環境のURLに変更してください。'
      );
    }
  }

  return {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    serviceKey: supabaseServiceKey,
    env,
  };
}

export function getSiteUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  
  if (!siteUrl || siteUrl === 'https://example.com') {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '⚠️ NEXT_PUBLIC_SITE_URLが設定されていません。\n' +
        '本番環境では必ず設定してください。'
      );
    }
    return siteUrl || 'https://example.com';
  }
  
  return siteUrl;
}
