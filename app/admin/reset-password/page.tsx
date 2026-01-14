'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getClient } from '@/lib/supabase/client';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    // URLパラメータからトークンとハッシュを取得
    const tokenParam = searchParams.get('token');
    const hashParam = searchParams.get('hash');
    const typeParam = searchParams.get('type');
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:18',message:'Reset password page loaded',data:{hasToken:!!tokenParam,hasHash:!!hashParam,type:typeParam},timestamp:Date.now(),sessionId:'debug-session',runId:'run14',hypothesisId:'N'})}).catch(()=>{});
    // #endregion

    if (tokenParam) {
      setToken(tokenParam);
    }
    if (hashParam) {
      setHash(hashParam);
    }

    // URLフラグメント（#）からトークンを取得してセッションを確立
    if (typeof window !== 'undefined') {
      // まず、URLパラメータ（?token=...）を確認（Supabaseのverifyエンドポイントからリダイレクトされた場合）
      const urlParams = new URLSearchParams(window.location.search);
      const tokenParam = urlParams.get('token');
      const typeParam = urlParams.get('type');
      const redirectToParam = urlParams.get('redirect_to');
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:35',message:'URL params check',data:{hasTokenParam:!!tokenParam,typeParam,hasRedirectToParam:!!redirectToParam,fullUrl:window.location.href},timestamp:Date.now(),sessionId:'debug-session',runId:'run18',hypothesisId:'R'})}).catch(()=>{});
      // #endregion
      
      // URLフラグメント（#）からトークンを取得
      const hashFragment = window.location.hash;
      if (hashFragment) {
        const params = new URLSearchParams(hashFragment.substring(1));
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:45',message:'Hash fragment parsed',data:{hasAccessToken:!!accessToken,hasRefreshToken:!!refreshToken,type,hashFragmentLength:hashFragment.length,fullHash:hashFragment.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run18',hypothesisId:'R'})}).catch(()=>{});
        // #endregion

        if (accessToken && (type === 'recovery' || type === 'magiclink')) {
          // セッションを確立
          const supabase = getClient();
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          }).then((result: { data: { session: any; user: any } | null; error: { message?: string } | null }) => {
            const { data, error }: { data: { session: any; user: any } | null; error: { message?: string } | null } = result;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:54',message:'Session set from hash fragment',data:{hasSession:!!data?.session,hasUser:!!data?.user,userEmail:data?.user?.email||null,error:error?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run18',hypothesisId:'R'})}).catch(()=>{});
            // #endregion
            
            if (error) {
              console.error('セッション確立エラー:', error);
              setError('セッションの確立に失敗しました。パスワードリセットリンクが無効の可能性があります。');
            } else if (data?.session) {
              console.log('セッションが確立されました。パスワードを設定できます。');
            }
          });
          
          // URLフラグメントをクリア（セキュリティのため）
          window.history.replaceState(null, '', window.location.pathname);
        } else if (hashFragment && !accessToken) {
          // フラグメントがあるが、access_tokenがない場合
          console.warn('URLフラグメントにaccess_tokenが含まれていません:', hashFragment.substring(0, 100));
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:69',message:'Hash fragment without access_token',data:{hashFragment:hashFragment.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run18',hypothesisId:'R'})}).catch(()=>{});
          // #endregion
        }
      } else if (tokenParam && (typeParam === 'recovery' || typeParam === 'magiclink')) {
        // URLパラメータにtokenがあるが、フラグメントがない場合
        // Supabaseのverifyエンドポイントからリダイレクトされたが、フラグメントが付与されていない状態
        // トークンを直接検証してセッションを確立する
        console.log('URLパラメータからトークンを検出しました。トークンを検証してセッションを確立します。');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:87',message:'Token param detected, verifying token',data:{hasTokenParam:!!tokenParam,tokenParamLength:tokenParam.length,typeParam,hasRedirectToParam:!!redirectToParam},timestamp:Date.now(),sessionId:'debug-session',runId:'run24',hypothesisId:'X'})}).catch(()=>{});
        // #endregion
        
        // useEffect内でawaitを使用するため、async関数を定義して呼び出す
        (async () => {
          // Supabaseのverifyエンドポイントを直接呼び出してトークンを検証
          const supabase = getClient();
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          
          if (!supabaseUrl) {
            setError('Supabase URLが設定されていません。');
            return;
          }
          
          // verifyエンドポイントを呼び出してトークンを検証
          try {
            const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(tokenParam!)}&type=${typeParam}&redirect_to=${encodeURIComponent(window.location.origin + '/admin/reset-password')}`;
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:100',message:'Calling verify endpoint',data:{verifyUrl:verifyUrl.substring(0,200),typeParam},timestamp:Date.now(),sessionId:'debug-session',runId:'run24',hypothesisId:'X'})}).catch(()=>{});
            // #endregion
            
            // verifyエンドポイントを呼び出すと、リダイレクトが発生するため、
            // 代わりに、トークンから直接セッションを確立する方法を使用
            // SupabaseのverifyOtpメソッドを使用できないため、別の方法を試す
            // 実際には、verifyエンドポイントがリダイレクトする際にフラグメントを付与するはずだが、
            // それが機能していない場合は、トークンを直接使用してセッションを確立する必要がある
            
            // 一時的な解決策: verifyエンドポイントを呼び出して、リダイレクト後のURLからフラグメントを取得
            // しかし、これはCORSの問題がある可能性があるため、別の方法を試す
            
            // 実際には、Supabaseのverifyエンドポイントは、トークンを検証した後、
            // redirect_toにリダイレクトする際に、URLフラグメント（#access_token=...）を付与するはずです。
            // しかし、それが機能していない場合は、トークンを直接使用してセッションを確立する必要があります。
            
            // 代替案: verifyエンドポイントを呼び出して、レスポンスからセッショントークンを取得
            const response = await fetch(verifyUrl, {
              method: 'GET',
              redirect: 'manual', // リダイレクトを手動で処理
            });
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:120',message:'Verify endpoint response',data:{status:response.status,statusText:response.statusText,type:response.type,hasLocation:!!response.headers.get('location')},timestamp:Date.now(),sessionId:'debug-session',runId:'run24',hypothesisId:'X'})}).catch(()=>{});
            // #endregion
            
            if (response.status === 302 || response.status === 301) {
              // リダイレクトが発生した場合、LocationヘッダーからURLを取得
              const location = response.headers.get('location');
              if (location) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:128',message:'Redirect location from verify endpoint',data:{location:location.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run24',hypothesisId:'X'})}).catch(()=>{});
                // #endregion
                
                // LocationヘッダーからURLフラグメントを抽出
                const url = new URL(location, window.location.origin);
                const hash = url.hash;
                
                if (hash) {
                  const params = new URLSearchParams(hash.substring(1));
                  const accessToken = params.get('access_token');
                  const refreshToken = params.get('refresh_token');
                  const type = params.get('type');
                  
                  if (accessToken && (type === 'recovery' || type === 'magiclink')) {
                    // セッションを確立
                    const { data, error }: { data: { session: any; user: any } | null; error: { message?: string } | null } = await supabase.auth.setSession({
                      access_token: accessToken,
                      refresh_token: refreshToken || '',
                    });
                    
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:142',message:'Session set from verify endpoint redirect',data:{hasSession:!!data?.session,hasUser:!!data?.user,userEmail:data?.user?.email||null,error:error?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run24',hypothesisId:'X'})}).catch(()=>{});
                    // #endregion
                    
                    if (error) {
                      console.error('セッション確立エラー:', error);
                      setError('セッションの確立に失敗しました。パスワードリセットリンクが無効の可能性があります。');
                    } else if (data?.session) {
                      console.log('セッションが確立されました。パスワードを設定できます。');
                      // URLパラメータをクリア
                      window.history.replaceState(null, '', window.location.pathname);
                    }
                  } else {
                    setError('トークンの検証に失敗しました。');
                  }
                } else {
                  // フラグメントがない場合、リダイレクト先のURLをそのまま使用
                  window.location.href = location;
                }
              } else {
                setError('リダイレクト先が取得できませんでした。');
              }
            } else {
              setError('トークンの検証に失敗しました。');
            }
          } catch (verifyError) {
            console.error('トークン検証エラー:', verifyError);
            setError('トークンの検証中にエラーが発生しました。');
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:165',message:'Token verification error',data:{error:verifyError instanceof Error ? verifyError.message : String(verifyError)},timestamp:Date.now(),sessionId:'debug-session',runId:'run24',hypothesisId:'X'})}).catch(()=>{});
            // #endregion
          }
        })();
      } else {
        // フラグメントもURLパラメータもない場合、既存のセッションを確認
        const supabase = getClient();
        supabase.auth.getSession().then((result: { data: { session: any } | null; error: { message?: string } | null }) => {
          const { data, error }: { data: { session: any } | null; error: { message?: string } | null } = result;
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:82',message:'Checking existing session',data:{hasSession:!!data?.session,hasUser:!!data?.session?.user,error:error?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run18',hypothesisId:'R'})}).catch(()=>{});
          // #endregion
          
          if (!data?.session) {
            // セッションがない場合、エラーメッセージを表示
            setError('パスワードリセットリンクが無効です。新しいリンクを取得してください。');
          }
        });
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:55',message:'Reset password form submit',data:{passwordLength:password.length,confirmPasswordLength:confirmPassword.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run14',hypothesisId:'N'})}).catch(()=>{});
    // #endregion

    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('パスワードは8文字以上である必要があります');
      setLoading(false);
      return;
    }

    try {
      const supabase = getClient();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:70',message:'Before updateUser',data:{hasSupabaseClient:!!supabase},timestamp:Date.now(),sessionId:'debug-session',runId:'run14',hypothesisId:'N'})}).catch(()=>{});
      // #endregion

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:73',message:'After getUser',data:{hasUser:!!user,userEmail:user?.email||null,userError:userError?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run14',hypothesisId:'N'})}).catch(()=>{});
      // #endregion

      if (userError || !user) {
        setError('セッションが無効です。パスワードリセットリンクを再度取得してください。');
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:84',message:'After updateUser',data:{updateError:updateError?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run14',hypothesisId:'N'})}).catch(()=>{});
      // #endregion

      if (updateError) {
        setError(updateError.message || 'パスワードの更新に失敗しました');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);

      // 3秒後にログインページにリダイレクト
      setTimeout(() => {
        router.push('/admin/login');
      }, 3000);
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/admin/reset-password/page.tsx:95',message:'Reset password exception',data:{errorMessage:err instanceof Error ? err.message : String(err)},timestamp:Date.now(),sessionId:'debug-session',runId:'run14',hypothesisId:'N'})}).catch(()=>{});
      // #endregion
      console.error('Reset password error:', err);
      setError('予期しないエラーが発生しました');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="text-green-600 text-4xl mb-4">✓</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                パスワードを更新しました
              </h2>
              <p className="text-gray-600 mb-4">
                新しいパスワードでログインできます。
              </p>
              <p className="text-sm text-gray-500">
                3秒後にログインページにリダイレクトします...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          パスワードをリセット
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          新しいパスワードを設定してください
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                新しいパスワード
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="8文字以上"
                  minLength={8}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                パスワード（確認）
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="パスワードを再入力"
                  minLength={8}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '更新中...' : 'パスワードを更新'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8"><div className="sm:mx-auto sm:w-full sm:max-w-md"><p className="text-center">読み込み中...</p></div></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
