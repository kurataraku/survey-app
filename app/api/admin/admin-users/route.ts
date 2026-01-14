import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/admin';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

/**
 * パスワードリセットメールを送信（既存ユーザー用）
 */
async function sendPasswordResetEmail({
  to,
  resetLink,
  role,
}: {
  to: string;
  resetLink: string;
  role: string;
}) {
  return sendPasswordSetupEmail({ to, resetLink, role, isNewUser: false });
}

/**
 * パスワード設定メールを送信（新規ユーザー・既存ユーザー共通）
 */
async function sendPasswordSetupEmail({
  to,
  resetLink,
  role,
  isNewUser = false,
}: {
  to: string;
  resetLink: string;
  role: string;
  isNewUser?: boolean;
}) {
  const emailService = process.env.EMAIL_SERVICE || 'resend';
  const emailApiKey = process.env.EMAIL_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  if (!emailApiKey) {
    throw new Error('メール送信APIキー（EMAIL_API_KEY）が設定されていません。.env.localに設定してください。');
  }

  if (!emailFrom) {
    throw new Error('送信元メールアドレス（EMAIL_FROM）が設定されていません。.env.localに設定してください。');
  }

  const roleLabel = role === 'owner' ? 'オーナー' : '管理者';
  const emailSubject = isNewUser 
    ? '【通信制高校リアルレビュー】管理者アカウントの初期パスワード設定'
    : '【通信制高校リアルレビュー】管理者アカウントのパスワードリセット';
  
  const emailBody = isNewUser
    ? `
管理者アカウントの初期パスワード設定

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【アカウント情報】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

メールアドレス: ${to}
権限: ${roleLabel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

管理者アカウントが作成されました。
以下のリンクをクリックして、初期パスワードを設定してください。

${resetLink}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

このリンクは24時間有効です。
このメールに心当たりがない場合は、無視してください。

管理画面: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/admin/login
`
    : `
管理者アカウントのパスワードリセット

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【アカウント情報】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

メールアドレス: ${to}
権限: ${roleLabel}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

以下のリンクをクリックして、パスワードをリセットしてください。

${resetLink}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

このリンクは24時間有効です。
このメールに心当たりがない場合は、無視してください。

管理画面: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/admin/login
`;

  if (emailService === 'resend') {
    const requestBody = {
      from: emailFrom,
      to: [to],
      subject: emailSubject,
      text: emailBody,
    };

    console.log('[Email] Resend API リクエスト送信（パスワードリセット）:', {
      url: 'https://api.resend.com/emails',
      from: requestBody.from,
      to: requestBody.to,
      subject: requestBody.subject,
      hasApiKey: !!emailApiKey,
      apiKeyPrefix: emailApiKey?.substring(0, 3) || 'N/A',
      emailService: emailService,
    });
    
    // onboarding@resend.devを使用している場合の警告
    if (emailFrom === 'onboarding@resend.dev') {
      console.warn('[Email] 警告: onboarding@resend.devを使用しています。送信先はResendアカウントのメールアドレスである必要があります。');
      console.warn('[Email] 送信先メールアドレス:', to);
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${emailApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[Email] Resend API レスポンス（パスワードリセット）:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'レスポンスの解析に失敗しました' }));
      console.error('[Email] Resend API エラーレスポンス（パスワードリセット）:', {
        status: response.status,
        statusText: response.statusText,
        errorData: errorData,
        requestInfo: {
          from: requestBody.from,
          to: requestBody.to,
        },
      });
      
      // 403エラーの場合、詳細なヘルプメッセージを表示
      if (response.status === 403) {
        console.error('[Email] 403エラーの原因:');
        if (emailFrom === 'onboarding@resend.dev') {
          console.error('[Email] - onboarding@resend.devはResendアカウントのメールアドレスにのみ送信可能です');
          console.error('[Email] - 送信先メールアドレスがResendアカウントのメールアドレスと一致しているか確認してください');
        } else {
          console.error('[Email] - カスタムドメインが検証されていない可能性があります');
          console.error('[Email] - Resendダッシュボードでドメインの検証状況を確認してください');
        }
      }
      
      throw new Error(`Resend API error (${response.status}): ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    console.log('[Email] Resend API 成功レスポンス（パスワードリセット）:', result);
    return result;
  } else {
    throw new Error(`未対応のメールサービス: ${emailService}`);
  }
}

/**
 * 管理者一覧を取得（ownerのみ）
 */
export async function GET(request: NextRequest) {
  const authResult = await requireOwner(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const adminSupabase = createAdminSupabaseClient();
    const { data: adminUsers, error } = await adminSupabase
      .from('admin_users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('管理者一覧取得エラー:', error);
      return NextResponse.json(
        { error: '管理者一覧の取得に失敗しました', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      adminUsers: adminUsers || [],
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

/**
 * 新規管理者を追加（Supabase Auth招待 + admin_users登録）
 */
export async function POST(request: NextRequest) {
  const authResult = await requireOwner(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const adminSupabase = createAdminSupabaseClient();
    const body = await request.json();
    const { email, role } = body;

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'メールアドレスは必須です' },
        { status: 400 }
      );
    }

    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json(
        { error: 'roleはownerまたはadminである必要があります' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 既存ユーザーのチェック（admin_usersテーブル）- すべてのユーザーをチェック
    const { data: existingAdmin, error: checkError } = await adminSupabase
      .from('admin_users')
      .select('id, is_active')
      .eq('email', normalizedEmail)
      .maybeSingle();

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:72',message:'Existing admin check',data:{email:normalizedEmail,hasExistingAdmin:!!existingAdmin,existingAdminId:existingAdmin?.id||null,existingAdminIsActive:existingAdmin?.is_active,checkError:checkError?.message||null,checkErrorCode:checkError?.code||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run5',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116は「結果が見つからない」エラーなので無視
      console.error('既存ユーザーチェックエラー:', checkError);
      return NextResponse.json(
        { error: '既存ユーザーの確認に失敗しました', details: checkError.message },
        { status: 500 }
      );
    }

    if (existingAdmin && existingAdmin.is_active) {
      return NextResponse.json(
        { error: 'このメールアドレスは既にアクティブな管理者として登録されています' },
        { status: 400 }
      );
    }

    // Supabase Authでユーザーを招待
    // 注意: auth.admin.inviteUserByEmail()はSupabase Admin APIを使用
    // @supabase/supabase-jsのバージョンによっては異なる方法が必要な場合があります
    // サイトURLを取得: 環境変数 > リクエストのオリジン > localhost
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin || 'http://localhost:3000';
    const redirectTo = `${siteUrl}/admin/reset-password`;
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:99',message:'Before checking existing user',data:{email:normalizedEmail,role,redirectTo,hasServiceKey:!!process.env.SUPABASE_SERVICE_ROLE_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'run9',hypothesisId:'I'})}).catch(()=>{});
    // #endregion
    
    // まず、既存ユーザーかどうかを確認
    let userExists = false;
    let existingAuthUser = null;
    try {
      // getUserByEmailは型定義にないが、実際には存在する可能性があるため、anyでキャスト
      const { data: authUserData, error: getUserError } = await (adminSupabase.auth.admin as any).getUserByEmail(normalizedEmail);
      userExists = !!authUserData?.user;
      existingAuthUser = authUserData?.user;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:285',message:'After getUserByEmail check',data:{email:normalizedEmail,userExists,hasUser:!!authUserData?.user,getUserError:getUserError?.message||null,getUserErrorCode:(getUserError as any)?.code||null,userId:authUserData?.user?.id||null,userEmail:authUserData?.user?.email||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run22',hypothesisId:'V'})}).catch(()=>{});
      // #endregion
      
      if (getUserError && (getUserError as any).code !== 'user_not_found') {
        // user_not_found以外のエラーはログに記録
        console.error('getUserByEmailエラー:', getUserError);
      }
    } catch (checkError) {
      console.log('既存ユーザーチェックでエラー（無視）:', checkError);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:112',message:'getUserByEmail check error',data:{email:normalizedEmail,error:checkError instanceof Error ? checkError.message : String(checkError)},timestamp:Date.now(),sessionId:'debug-session',runId:'run9',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
    }
    
    let inviteData = null;
    let inviteError = null;
    let emailSent = false;
    
    if (userExists) {
      // 既存ユーザーの場合、パスワードリセットメールを送信
      console.log('既存ユーザーを検出しました。パスワードリセットメールを送信します。');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:128',message:'Sending password reset email for existing user',data:{email:normalizedEmail,redirectTo},timestamp:Date.now(),sessionId:'debug-session',runId:'run10',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      
      // 既存ユーザーの場合、パスワードリセットリンクを生成
      const { data: resetData, error: resetError } = await adminSupabase.auth.admin.generateLink({
        type: 'recovery',
        email: normalizedEmail,
        options: {
          redirectTo: redirectTo,
        },
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:140',message:'After generateLink for existing user',data:{email:normalizedEmail,hasResetData:!!resetData,hasResetError:!!resetError,resetErrorCode:resetError?.code||null,resetErrorMessage:resetError?.message||null,resetDataProperties:resetData?.properties||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run10',hypothesisId:'J'})}).catch(()=>{});
      // #endregion
      
      if (resetError) {
        console.error('パスワードリセットリンク生成エラー:', resetError);
        inviteError = resetError;
        emailSent = false;
      } else if (resetData?.properties?.action_link) {
        // パスワードリセットリンクが生成された場合、Resendを使用してメールを送信
        try {
          await sendPasswordResetEmail({
            to: normalizedEmail,
            resetLink: resetData.properties.action_link,
            role: role,
          });
          emailSent = true;
          inviteError = null;
          console.log('既存ユーザーへのパスワードリセットメールを送信しました。');
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:155',message:'Password reset email sent successfully',data:{email:normalizedEmail,hasResetLink:!!resetData.properties.action_link},timestamp:Date.now(),sessionId:'debug-session',runId:'run10',hypothesisId:'J'})}).catch(()=>{});
          // #endregion
        } catch (emailError) {
          console.error('パスワードリセットメール送信エラー:', emailError);
          emailSent = false;
          inviteError = emailError instanceof Error ? emailError : new Error(String(emailError));
          // メール送信に失敗しても、admin_usersには登録する
        }
      } else {
        console.error('パスワードリセットリンクが生成されませんでした。');
        emailSent = false;
        inviteError = new Error('パスワードリセットリンクの生成に失敗しました');
      }
    } else {
      // 新規ユーザーの場合、ユーザーを作成してからパスワード設定リンクを生成
      console.log('新規ユーザーです。ユーザーを作成してパスワード設定メールを送信します。');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:346',message:'Creating new user and sending password setup email',data:{email:normalizedEmail,role,redirectTo},timestamp:Date.now(),sessionId:'debug-session',runId:'run16',hypothesisId:'P'})}).catch(()=>{});
      // #endregion
      
      // まず、ユーザーを作成（パスワードなし、メール確認済み）
      const { data: createUserResult, error: createUserError } = await adminSupabase.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true, // メール確認をスキップ
        user_metadata: {
          role: role,
        },
      });
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:356',message:'After createUser for new user',data:{email:normalizedEmail,hasCreateUserResult:!!createUserResult,hasCreateUserError:!!createUserError,createUserErrorCode:createUserError?.code||null,createUserErrorMessage:createUserError?.message||null,hasUser:!!createUserResult?.user},timestamp:Date.now(),sessionId:'debug-session',runId:'run16',hypothesisId:'P'})}).catch(()=>{});
      // #endregion
      
      if (createUserError) {
        console.error('ユーザー作成エラー:', createUserError);
        const createUserErrorCode = (createUserError as any)?.code;
        const isEmailExistsError = createUserErrorCode === 'email_exists' || createUserErrorCode === 'user_already_registered';
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:372',message:'createUser failed',data:{email:normalizedEmail,createUserErrorCode,createUserErrorMessage:createUserError?.message||null,createUserErrorStatus:(createUserError as any)?.status||null,userExists,isEmailExistsError},timestamp:Date.now(),sessionId:'debug-session',runId:'run23',hypothesisId:'W'})}).catch(()=>{});
        // #endregion
        
        // createUserが失敗した場合、既存ユーザーの可能性がある
        // email_existsエラーの場合、既存ユーザーとして扱う
        // 既存ユーザーの場合はrecoveryを使用、新規ユーザーの場合はinviteUserByEmailを使用
        if (userExists || isEmailExistsError) {
          // 既存ユーザーの場合、パスワードリセットリンクを生成
          console.log(`既存ユーザーとして判定されました（userExists: ${userExists}, isEmailExistsError: ${isEmailExistsError}）。パスワードリセットリンクを生成します。`);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:380',message:'Treating as existing user, generating recovery link',data:{email:normalizedEmail,userExists,isEmailExistsError,createUserErrorCode},timestamp:Date.now(),sessionId:'debug-session',runId:'run23',hypothesisId:'W'})}).catch(()=>{});
          // #endregion
          const { data: fallbackLinkData, error: fallbackLinkError } = await adminSupabase.auth.admin.generateLink({
            type: 'recovery',
            email: normalizedEmail,
            options: {
              redirectTo: redirectTo,
            },
          });
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:375',message:'After generateLink (recovery) for existing user fallback',data:{email:normalizedEmail,hasFallbackLinkData:!!fallbackLinkData,hasFallbackLinkError:!!fallbackLinkError,fallbackLinkErrorCode:(fallbackLinkError as any)?.code||null,fallbackLinkProperties:fallbackLinkData?.properties||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run22',hypothesisId:'V'})}).catch(()=>{});
          // #endregion
          
          if (fallbackLinkError) {
            console.error('パスワードリセットリンク生成エラー（既存ユーザー）:', fallbackLinkError);
            inviteError = fallbackLinkError;
            emailSent = false;
          } else if (fallbackLinkData?.properties?.action_link) {
            // パスワードリセットリンクが生成された場合、Resendを使用してメールを送信
            try {
              await sendPasswordResetEmail({
                to: normalizedEmail,
                resetLink: fallbackLinkData.properties.action_link,
                role: role,
              });
              emailSent = true;
              inviteError = null;
              console.log('既存ユーザーへのパスワードリセットメールを送信しました（フォールバック）。');
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:395',message:'Password reset email sent successfully (existing user fallback)',data:{email:normalizedEmail,hasFallbackLink:!!fallbackLinkData.properties.action_link},timestamp:Date.now(),sessionId:'debug-session',runId:'run22',hypothesisId:'V'})}).catch(()=>{});
              // #endregion
            } catch (emailError) {
              console.error('パスワードリセットメール送信エラー（既存ユーザー）:', emailError);
              emailSent = false;
              inviteError = emailError instanceof Error ? emailError : new Error(String(emailError));
            }
          } else {
            inviteError = createUserError;
            emailSent = false;
          }
        } else {
          // 新規ユーザーの可能性があるが、createUserが失敗した場合
          // inviteUserByEmailを使用（新規ユーザーに対してrecoveryは使えない）
          console.log('新規ユーザーの可能性があります。inviteUserByEmailを使用します（recoveryは使用しません）。');
          const { data: inviteResult, error: inviteErr } = await adminSupabase.auth.admin.inviteUserByEmail(
            normalizedEmail,
            {
              data: {
                role: role,
              },
              redirectTo: redirectTo,
            }
          );
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:415',message:'After inviteUserByEmail for new user (createUser failed)',data:{email:normalizedEmail,hasInviteResult:!!inviteResult,hasInviteError:!!inviteErr,inviteErrorCode:(inviteErr as any)?.code||null,inviteErrorMessage:inviteErr?.message||null,hasUser:!!inviteResult?.user},timestamp:Date.now(),sessionId:'debug-session',runId:'run22',hypothesisId:'V'})}).catch(()=>{});
          // #endregion
          
          if (inviteErr) {
            inviteError = inviteErr;
            emailSent = false;
            console.error('inviteUserByEmailも失敗しました:', inviteErr);
          } else {
            // inviteUserByEmailは成功したが、action_linkは取得できない
            // 再度magiclinkを生成して、Resendで送信する
            console.log('inviteUserByEmailは成功しました。再度magiclinkを生成してResendで送信します。');
            const { data: retryLinkData, error: retryLinkError } = await adminSupabase.auth.admin.generateLink({
              type: 'magiclink',
              email: normalizedEmail,
              options: {
                redirectTo: redirectTo,
              },
            });
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:430',message:'After retry generateLink (magiclink) after inviteUserByEmail (createUser failed)',data:{email:normalizedEmail,hasRetryLinkData:!!retryLinkData,hasRetryLinkError:!!retryLinkError,retryLinkErrorCode:(retryLinkError as any)?.code||null,retryLinkErrorMessage:retryLinkError?.message||null,hasActionLink:!!(retryLinkData as any)?.properties?.action_link},timestamp:Date.now(),sessionId:'debug-session',runId:'run22',hypothesisId:'V'})}).catch(()=>{});
            // #endregion
            
            if (retryLinkError || !(retryLinkData as any)?.properties?.action_link) {
              // 再試行も失敗した場合、Supabaseが自動的にメールを送信するため、emailSentはtrue
              emailSent = true;
              inviteData = inviteResult;
              inviteError = null;
              console.log('magiclinkの再生成に失敗しましたが、Supabaseが自動的にメールを送信します。');
            } else {
              // 再生成が成功した場合、Resendを使用してカスタムメールを送信
              try {
                await sendPasswordSetupEmail({
                  to: normalizedEmail,
                  resetLink: (retryLinkData as any).properties.action_link,
                  role: role,
                  isNewUser: true,
                });
                emailSent = true;
                inviteError = null;
                inviteData = inviteResult;
                console.log('新規ユーザーへのパスワード設定メールを送信しました（createUser失敗 + inviteUserByEmail + magiclink再生成）。');
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:448',message:'Password setup email sent successfully (createUser failed + inviteUserByEmail + magiclink retry)',data:{email:normalizedEmail,hasRetryLink:!!(retryLinkData as any).properties.action_link},timestamp:Date.now(),sessionId:'debug-session',runId:'run22',hypothesisId:'V'})}).catch(()=>{});
                // #endregion
              } catch (emailError) {
                console.error('パスワード設定メール送信エラー:', emailError);
                // Supabaseが自動的にメールを送信するため、emailSentはtrue
                emailSent = true;
                console.log('Resendでのメール送信に失敗しましたが、Supabaseが自動的にメールを送信します。');
              }
            }
          }
        }
      } else {
        // ユーザー作成が成功した場合、パスワード設定リンクを生成
        // 新規ユーザーの場合、type: 'magiclink' を使用（パスワード設定用）
        // 注意: magiclinkはパスワード設定画面にリダイレクトし、そこでパスワードを設定できる
        const { data: resetLinkData, error: resetLinkError } = await adminSupabase.auth.admin.generateLink({
          type: 'magiclink',
          email: normalizedEmail,
          options: {
            redirectTo: redirectTo,
          },
        });
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:417',message:'After generateLink (magiclink) for new user',data:{email:normalizedEmail,hasResetLinkData:!!resetLinkData,hasResetLinkError:!!resetLinkError,resetLinkErrorCode:resetLinkError?.code||null,resetLinkErrorMessage:resetLinkError?.message||null,resetLinkProperties:resetLinkData?.properties||null,actionLinkPreview:resetLinkData?.properties?.action_link?.substring(0,100)||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run19',hypothesisId:'S'})}).catch(()=>{});
        // #endregion
        
        if (resetLinkError) {
          console.error('パスワード設定リンク生成エラー（magiclink）:', resetLinkError);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:432',message:'magiclink generation failed',data:{email:normalizedEmail,resetLinkErrorCode:(resetLinkError as any)?.code||null,resetLinkErrorMessage:resetLinkError?.message||null,resetLinkErrorStatus:(resetLinkError as any)?.status||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run20',hypothesisId:'T'})}).catch(()=>{});
          // #endregion
          
          // 新規ユーザーに対してrecoveryは使えない（otp_expiredエラーが発生する）
          // 代わりに、inviteUserByEmailを使用して、Supabaseが自動的にメールを送信する
          console.log('magiclinkの生成に失敗しました。inviteUserByEmailを使用します。');
          const { data: inviteResult, error: inviteErr } = await adminSupabase.auth.admin.inviteUserByEmail(
            normalizedEmail,
            {
              data: {
                role: role,
              },
              redirectTo: redirectTo,
            }
          );
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:444',message:'After inviteUserByEmail fallback',data:{email:normalizedEmail,hasInviteResult:!!inviteResult,hasInviteError:!!inviteErr,inviteErrorCode:(inviteErr as any)?.code||null,inviteErrorMessage:inviteErr?.message||null,hasUser:!!inviteResult?.user},timestamp:Date.now(),sessionId:'debug-session',runId:'run20',hypothesisId:'T'})}).catch(()=>{});
          // #endregion
          
          if (inviteErr) {
            inviteError = inviteErr;
            emailSent = false;
            console.error('inviteUserByEmailも失敗しました:', inviteErr);
          } else {
            // inviteUserByEmailは成功したが、action_linkは取得できない
            // Supabaseが自動的にメールを送信するが、redirectToが正しく設定されない可能性がある
            // そのため、再度generateLinkでmagiclinkを生成して、Resendで送信する
            console.log('inviteUserByEmailは成功しました。再度magiclinkを生成してResendで送信します。');
            const { data: retryLinkData, error: retryLinkError } = await adminSupabase.auth.admin.generateLink({
              type: 'magiclink',
              email: normalizedEmail,
              options: {
                redirectTo: redirectTo,
              },
            });
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:450',message:'After retry generateLink (magiclink) after inviteUserByEmail',data:{email:normalizedEmail,hasRetryLinkData:!!retryLinkData,hasRetryLinkError:!!retryLinkError,retryLinkErrorCode:(retryLinkError as any)?.code||null,retryLinkErrorMessage:retryLinkError?.message||null,hasActionLink:!!(retryLinkData as any)?.properties?.action_link},timestamp:Date.now(),sessionId:'debug-session',runId:'run20',hypothesisId:'T'})}).catch(()=>{});
            // #endregion
            
            if (retryLinkError || !(retryLinkData as any)?.properties?.action_link) {
              // 再試行も失敗した場合、Supabaseが自動的にメールを送信するため、emailSentはtrue
              emailSent = true;
              inviteData = inviteResult;
              inviteError = null;
              console.log('magiclinkの再生成に失敗しましたが、Supabaseが自動的にメールを送信します。');
            } else {
              // 再生成が成功した場合、Resendを使用してカスタムメールを送信
              try {
                await sendPasswordSetupEmail({
                  to: normalizedEmail,
                  resetLink: (retryLinkData as any).properties.action_link,
                  role: role,
                  isNewUser: true,
                });
                emailSent = true;
                inviteError = null;
                inviteData = inviteResult;
                console.log('新規ユーザーへのパスワード設定メールを送信しました（inviteUserByEmail + magiclink再生成）。');
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:468',message:'Password setup email sent successfully (inviteUserByEmail + magiclink retry)',data:{email:normalizedEmail,hasRetryLink:!!(retryLinkData as any).properties.action_link},timestamp:Date.now(),sessionId:'debug-session',runId:'run20',hypothesisId:'T'})}).catch(()=>{});
                // #endregion
              } catch (emailError) {
                console.error('パスワード設定メール送信エラー:', emailError);
                // Supabaseが自動的にメールを送信するため、emailSentはtrue
                emailSent = true;
                console.log('Resendでのメール送信に失敗しましたが、Supabaseが自動的にメールを送信します。');
              }
            }
          }
        } else if (resetLinkData?.properties?.action_link) {
          // パスワード設定リンクが生成された場合、Resendを使用してメールを送信
          try {
            await sendPasswordSetupEmail({
              to: normalizedEmail,
              resetLink: resetLinkData.properties.action_link,
              role: role,
              isNewUser: true,
            });
            emailSent = true;
            inviteError = null;
            inviteData = createUserResult;
            console.log('新規ユーザーへのパスワード設定メールを送信しました（magiclink）。');
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:456',message:'Password setup email sent successfully (magiclink)',data:{email:normalizedEmail,hasResetLink:!!resetLinkData.properties.action_link},timestamp:Date.now(),sessionId:'debug-session',runId:'run19',hypothesisId:'S'})}).catch(()=>{});
            // #endregion
          } catch (emailError) {
            console.error('パスワード設定メール送信エラー:', emailError);
            emailSent = false;
            inviteError = emailError instanceof Error ? emailError : new Error(String(emailError));
            // メール送信に失敗しても、admin_usersには登録する
          }
        } else {
          console.error('パスワード設定リンクが生成されませんでした。');
          emailSent = false;
          inviteError = new Error('パスワード設定リンクの生成に失敗しました');
        }
      }
    }
    
    // 既存ユーザーエラーかどうかを判定（メッセージ生成用）
    let isExistingUserError = false;
    
    if (inviteError && !emailSent) {
      // エラーが残っている場合のみチェック
      const errorMessage = inviteError.message?.toLowerCase() || '';
      const errorCode = ((inviteError as any).code || '').toLowerCase();
      const errorStatus = (inviteError as any).status;
      
      isExistingUserError = 
        errorMessage.includes('already registered') || 
        errorMessage.includes('already exists') ||
        errorMessage.includes('user already registered') ||
        errorMessage.includes('duplicate') ||
        errorCode.includes('user_exists') ||
        errorCode === 'email_exists' ||
        errorStatus === 422;
    }

    // admin_usersテーブルに登録（既に非アクティブなレコードがある場合は更新、ない場合は新規作成）
    let newAdminUser;
    let insertError;
    
    if (existingAdmin && !existingAdmin.is_active) {
      // 非アクティブなレコードが存在する場合は更新
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:142',message:'Updating inactive admin user',data:{existingAdminId:existingAdmin.id,email:normalizedEmail,role},timestamp:Date.now(),sessionId:'debug-session',runId:'run5',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      const { data: updatedAdmin, error: updateError } = await adminSupabase
        .from('admin_users')
        .update({
          role: role,
          is_active: true,
        })
        .eq('id', existingAdmin.id)
        .select()
        .single();
      
      newAdminUser = updatedAdmin;
      insertError = updateError;
    } else {
      // 新規作成
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:157',message:'Inserting new admin user',data:{email:normalizedEmail,role,hasExistingAdmin:!!existingAdmin},timestamp:Date.now(),sessionId:'debug-session',runId:'run5',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      const { data: insertedAdmin, error: insertErr } = await adminSupabase
        .from('admin_users')
        .insert({
          email: normalizedEmail,
          role: role,
          is_active: true,
        })
        .select()
        .single();
      
      newAdminUser = insertedAdmin;
      insertError = insertErr;
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:175',message:'After admin_users insert/update',data:{hasNewAdminUser:!!newAdminUser,hasInsertError:!!insertError,insertErrorCode:insertError?.code||null,insertErrorMessage:insertError?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run5',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    if (insertError) {
      console.error('admin_users登録エラー:', insertError);
      console.error('エラー詳細:', JSON.stringify(insertError, null, 2));
      
      // ユーザー招待は成功したが、admin_users登録に失敗した場合
      // これはデータ不整合を引き起こす可能性があるが、ここではエラーを返す
      return NextResponse.json(
        { error: '管理者の登録に失敗しました', details: insertError.message },
        { status: 500 }
      );
    }

    // メール送信の成功/失敗を判定
    const finalEmailSent = emailSent;
    let message = '';
    if (finalEmailSent) {
      message = userExists 
        ? '管理者を追加しました。パスワードリセットメールが送信されました。'
        : '管理者を追加しました。パスワード設定メールが送信されました。';
    } else {
      // メール送信に失敗した場合でも、エラーメッセージを詳細に表示
      const errorDetails = inviteError 
        ? `エラー: ${inviteError.message || '不明なエラー'}`
        : 'メール送信に失敗しました。';
      message = `管理者を追加しましたが、${errorDetails}`;
      console.error('メール送信失敗の詳細:', {
        email: normalizedEmail,
        userExists,
        inviteError,
        emailSent,
      });
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:295',message:'Admin user added successfully',data:{email:normalizedEmail,emailSent:finalEmailSent,userExists,hasInviteError:!!inviteError,isExistingUserError},timestamp:Date.now(),sessionId:'debug-session',runId:'run9',hypothesisId:'I'})}).catch(()=>{});
    // #endregion

    return NextResponse.json(
      {
        message: message,
        adminUser: newAdminUser,
        emailSent: finalEmailSent,
        userExists: userExists,
        inviteError: inviteError ? {
          code: (inviteError as any).code || null,
          message: inviteError.message || String(inviteError),
          status: (inviteError as any).status || null,
        } : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
