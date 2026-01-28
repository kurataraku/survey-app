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
    // サイトURLを取得: 環境変数 > Vercel環境変数 > リクエストヘッダー > リクエストのオリジン > localhost
    // Vercelでは、VERCEL_URLが自動的に設定される（例: real-review.vercel.app）
    // また、x-forwarded-hostとx-forwarded-protoからも本番URLを取得できる
    const vercelUrl = process.env.VERCEL_URL; // Vercelが自動設定（例: real-review.vercel.app）
    const hostHeader = request.headers.get('host');
    const forwardedHostHeader = request.headers.get('x-forwarded-host');
    const forwardedProtoHeader = request.headers.get('x-forwarded-proto');
    
    // 優先順位: x-forwarded-host > host > VERCEL_URL
    const host = forwardedHostHeader || hostHeader || (vercelUrl ? vercelUrl : null);
    // 優先順位: x-forwarded-proto > https (Vercelは常にhttps) > http
    const protocol = forwardedProtoHeader || (vercelUrl ? 'https' : (request.nextUrl.protocol === 'https:' ? 'https' : 'http'));
    
    // ヘッダーから取得したURLを構築
    const originFromHeaders = host ? `${protocol}://${host}` : null;
    
    // 最終的なsiteUrlの決定（優先順位: NEXT_PUBLIC_SITE_URL > ヘッダーから取得 > VERCEL_URL > request.nextUrl.origin > localhost）
    let siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      if (originFromHeaders) {
        siteUrl = originFromHeaders;
      } else if (vercelUrl) {
        siteUrl = `https://${vercelUrl}`;
      } else {
        siteUrl = request.nextUrl.origin || 'http://localhost:3000';
      }
    }
    
    // localhostが含まれている場合は警告（本番環境では発生すべきでない）
    if (siteUrl.includes('localhost')) {
      console.warn('[Admin Users API] WARNING: siteUrl contains localhost in production!', {
        siteUrl,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
        VERCEL_URL: vercelUrl,
        hostHeader,
        forwardedHostHeader,
        forwardedProtoHeader,
        requestOrigin: request.nextUrl.origin,
      });
    }
    
    const redirectTo = `${siteUrl}/admin/reset-password`;    
    // デバッグログ（本番環境でも確認できるように）
    console.log('[Admin Users API] Site URL determination:', {
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'not set',
      VERCEL_URL: vercelUrl || 'not set',
      hostHeader,
      forwardedHostHeader,
      forwardedProtoHeader,
      host,
      protocol,
      originFromHeaders,
      requestOrigin: request.nextUrl.origin,
      requestUrl: request.nextUrl.toString(),
      finalSiteUrl: siteUrl,
      redirectTo,
      containsLocalhost: siteUrl.includes('localhost'),
    });    
    // まず、既存ユーザーかどうかを確認
    let userExists = false;
    let existingAuthUser = null;
    try {
      // getUserByEmailは型定義にないが、実際には存在する可能性があるため、anyでキャスト
      const { data: authUserData, error: getUserError } = await (adminSupabase.auth.admin as any).getUserByEmail(normalizedEmail);
      userExists = !!authUserData?.user;
      existingAuthUser = authUserData?.user;      
      if (getUserError && (getUserError as any).code !== 'user_not_found') {
        // user_not_found以外のエラーはログに記録
        console.error('getUserByEmailエラー:', getUserError);
      }
    } catch (checkError) {
      console.log('既存ユーザーチェックでエラー（無視）:', checkError);    }
    
    let inviteData = null;
    let inviteError = null;
    let emailSent = false;
    
    if (userExists) {
      // 既存ユーザーの場合、パスワードリセットメールを送信
      console.log('既存ユーザーを検出しました。パスワードリセットメールを送信します。');
      // 既存ユーザーの場合、パスワードリセットリンクを生成
      const { data: resetData, error: resetError } = await adminSupabase.auth.admin.generateLink({
        type: 'recovery',
        email: normalizedEmail,
        options: {
          redirectTo: redirectTo,
        },
      });
      if (resetError) {
        console.error('パスワードリセットリンク生成エラー:', resetError);
        inviteError = resetError;
        emailSent = false;
      } else if (resetData?.properties?.action_link) {
        // パスワードリセットリンクが生成された場合、Resendを使用してメールを送信
        const actionLink = resetData.properties.action_link;
        console.log('[Admin Users API] Generated reset link:', {
          actionLink,
          redirectTo,
          containsRedirectTo: actionLink.includes(redirectTo),
          containsResetPassword: actionLink.includes('/admin/reset-password'),
        });
        try {
          await sendPasswordResetEmail({
            to: normalizedEmail,
            resetLink: actionLink,
            role: role,
          });
          emailSent = true;
          inviteError = null;
          console.log('既存ユーザーへのパスワードリセットメールを送信しました。');
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
      // まず、ユーザーを作成（パスワードなし、メール確認済み）
      const { data: createUserResult, error: createUserError } = await adminSupabase.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true, // メール確認をスキップ
        user_metadata: {
          role: role,
        },
      });      
      if (createUserError) {
        console.error('ユーザー作成エラー:', createUserError);
        const createUserErrorCode = (createUserError as any)?.code;
        const isEmailExistsError = createUserErrorCode === 'email_exists' || createUserErrorCode === 'user_already_registered';
        // createUserが失敗した場合、既存ユーザーの可能性がある
        // email_existsエラーの場合、既存ユーザーとして扱う
        // 既存ユーザーの場合はrecoveryを使用、新規ユーザーの場合はinviteUserByEmailを使用
        if (userExists || isEmailExistsError) {
          // 既存ユーザーの場合、パスワードリセットリンクを生成
          console.log(`既存ユーザーとして判定されました（userExists: ${userExists}, isEmailExistsError: ${isEmailExistsError}）。パスワードリセットリンクを生成します。`);          const { data: fallbackLinkData, error: fallbackLinkError } = await adminSupabase.auth.admin.generateLink({
            type: 'recovery',
            email: normalizedEmail,
            options: {
              redirectTo: redirectTo,
            },
          });
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
          if (inviteErr) {
            inviteError = inviteErr;
            emailSent = false;
            console.error('inviteUserByEmailも失敗しました:', inviteErr);
          } else {
            // inviteUserByEmailは成功したが、action_linkは取得できない
            // 再度magiclinkを生成して、Resendで送信する
            console.log('inviteUserByEmailは成功しました。再度magiclinkを生成してResendで送信します。');            const { data: retryLinkData, error: retryLinkError } = await adminSupabase.auth.admin.generateLink({
              type: 'magiclink',
              email: normalizedEmail,
              options: {
                redirectTo: redirectTo,
              },
            });
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
        if (resetLinkError) {
          console.error('パスワード設定リンク生成エラー（magiclink）:', resetLinkError);
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
    return NextResponse.json(
      {
        message: message,
        adminUser: newAdminUser,
        emailSent: finalEmailSent,
        userExists: userExists,
        redirectTo: redirectTo, // デバッグ用：実際に使用されたredirectToを返す
        siteUrl: siteUrl, // デバッグ用：実際に使用されたsiteUrlを返す
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
