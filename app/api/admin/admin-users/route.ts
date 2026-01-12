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
  const emailBody = `
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
      subject: '【通信制高校リアルレビュー】管理者アカウントのパスワードリセット',
      text: emailBody,
    };

    console.log('[Email] Resend API リクエスト送信（パスワードリセット）:', {
      url: 'https://api.resend.com/emails',
      from: requestBody.from,
      to: requestBody.to,
      subject: requestBody.subject,
      hasApiKey: !!emailApiKey,
    });

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
      console.error('[Email] Resend API エラーレスポンス（パスワードリセット）:', errorData);
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
    const redirectTo = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000/admin/login';
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:99',message:'Before checking existing user',data:{email:normalizedEmail,role,redirectTo,hasServiceKey:!!process.env.SUPABASE_SERVICE_ROLE_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'run9',hypothesisId:'I'})}).catch(()=>{});
    // #endregion
    
    // まず、既存ユーザーかどうかを確認
    let userExists = false;
    let existingAuthUser = null;
    try {
      const { data: authUserData, error: getUserError } = await adminSupabase.auth.admin.getUserByEmail(normalizedEmail);
      userExists = !!authUserData?.user;
      existingAuthUser = authUserData?.user;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:107',message:'After getUserByEmail check',data:{email:normalizedEmail,userExists,hasUser:!!authUserData?.user,getUserError:getUserError?.message||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run9',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
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
      // 新規ユーザーの場合、招待メールを送信
      console.log('新規ユーザーです。招待メールを送信します。');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:145',message:'Inviting new user',data:{email:normalizedEmail,role,redirectTo},timestamp:Date.now(),sessionId:'debug-session',runId:'run9',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
      
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
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:157',message:'After inviteUserByEmail for new user',data:{email:normalizedEmail,hasInviteData:!!inviteResult,hasInviteError:!!inviteErr,inviteErrorCode:inviteErr?.code||null,inviteErrorMessage:inviteErr?.message||null,inviteErrorStatus:inviteErr?.status||null,inviteDataProperties:inviteResult?.properties||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run9',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
      
      inviteData = inviteResult;
      inviteError = inviteErr;
      
      if (!inviteError) {
        emailSent = true;
      }
    }
    
    // 既存ユーザーエラーかどうかを判定（スコープ外でも使用できるように）
    let isExistingUserError = false;
    
    if (inviteError) {
      console.error('ユーザー招待/パスワードリセットエラー:', inviteError);
      console.error('エラー詳細:', JSON.stringify(inviteError, null, 2));
      console.error('エラーコード:', inviteError.code);
      console.error('エラーメッセージ:', inviteError.message);
      console.error('エラーステータス:', inviteError.status);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:220',message:'inviteUserByEmail/generateLink error details',data:{errorCode:inviteError.code,errorMessage:inviteError.message,errorStatus:inviteError.status,errorString:JSON.stringify(inviteError)},timestamp:Date.now(),sessionId:'debug-session',runId:'run11',hypothesisId:'K'})}).catch(()=>{});
      // #endregion
      
      // ユーザーが既に存在する場合でも、admin_usersに登録するだけでもOK
      // より包括的なエラーパターンチェック（email_existsも含める）
      const errorMessage = inviteError.message?.toLowerCase() || '';
      const errorCode = inviteError.code?.toLowerCase() || '';
      
      isExistingUserError = 
        errorMessage.includes('already registered') || 
        errorMessage.includes('already exists') ||
        errorMessage.includes('user already registered') ||
        errorMessage.includes('duplicate') ||
        errorCode.includes('user_exists') ||
        errorCode === 'email_exists' || // email_existsエラーコードを追加
        inviteError.status === 422; // 422は通常、既存ユーザーエラー
      
      if (isExistingUserError) {
        // ユーザーは既に存在するので、admin_usersにのみ登録
        // 既存ユーザーの場合、inviteUserByEmailはメールを送信しない
        // そのため、generateLinkでパスワードリセットリンクを生成してメール送信を試みる
        console.log('ユーザーは既にSupabase Authに存在します。パスワードリセットリンクを生成してメール送信を試みます。');
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:245',message:'Existing user detected, generating password reset link',data:{email:normalizedEmail,errorCode:inviteError.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run12',hypothesisId:'L'})}).catch(()=>{});
        // #endregion
        
        // 既存ユーザーの場合、パスワードリセットリンクを生成
        // 注意: generateLinkはメールを送信しないため、手動でメール送信が必要
        // しかし、Supabase Admin APIには直接メール送信機能がないため、
        // ここではリンクを生成するだけにする
        const { data: resetLinkData, error: resetLinkError } = await adminSupabase.auth.admin.generateLink({
          type: 'recovery',
          email: normalizedEmail,
          options: {
            redirectTo: redirectTo,
          },
        });
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:260',message:'After generateLink for existing user',data:{email:normalizedEmail,hasResetLinkData:!!resetLinkData,hasResetLinkError:!!resetLinkError,resetLinkErrorCode:resetLinkError?.code||null,resetLinkErrorMessage:resetLinkError?.message||null,resetLinkProperties:resetLinkData?.properties||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run12',hypothesisId:'L'})}).catch(()=>{});
        // #endregion
        
        if (resetLinkError) {
          console.error('パスワードリセットリンク生成エラー:', resetLinkError);
          emailSent = false; // リンク生成に失敗した場合、メール送信失敗
        } else if (resetLinkData?.properties?.action_link) {
          // パスワードリセットリンクが生成された場合、Resendを使用してメールを送信
          try {
            await sendPasswordResetEmail({
              to: normalizedEmail,
              resetLink: resetLinkData.properties.action_link,
              role: role,
            });
            emailSent = true;
            inviteError = null; // 既存ユーザーエラーは無視
            console.log('既存ユーザーへのパスワードリセットメールを送信しました。');
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/admin/admin-users/route.ts:280',message:'Password reset email sent successfully for existing user error case',data:{email:normalizedEmail,hasResetLink:!!resetLinkData.properties.action_link},timestamp:Date.now(),sessionId:'debug-session',runId:'run12',hypothesisId:'L'})}).catch(()=>{});
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
          inviteError = null; // 既存ユーザーエラーは無視（リンク生成失敗は別エラー）
        }
      } else {
        // その他のエラー（メール設定の問題など）はエラーを返す
        console.error('予期しないユーザー招待/パスワードリセットエラー:', {
          code: inviteError.code,
          message: inviteError.message,
          status: inviteError.status,
        });
        return NextResponse.json(
          { 
            error: 'ユーザー招待/パスワードリセットに失敗しました', 
            details: inviteError.message || '不明なエラーが発生しました',
            code: inviteError.code,
          },
          { status: 500 }
        );
      }
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
        : '管理者を追加しました。招待メールが送信されました。';
    } else if (isExistingUserError) {
      // 既存ユーザーの場合、メール送信機能が実装されていないため、手動でパスワードリセットメールを送信する必要がある
      message = '管理者を追加しました。既存ユーザーのため、パスワードリセットメールを手動で送信してください。';
    } else {
      message = '管理者を追加しましたが、メール送信に失敗した可能性があります。';
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
          code: inviteError.code,
          message: inviteError.message,
          status: inviteError.status,
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
