import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 簡易レート制限（メモリベース）
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 60秒
const RATE_LIMIT_MAX = 1; // 60秒に1回まで

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  return forwarded?.split(',')[0] || realIP || 'unknown';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // レート制限チェック
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: '送信頻度が高すぎます。しばらく時間をおいてから再度お試しください。' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { name, email, subject, message, page_url } = body;

    // バリデーション
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: '有効なメールアドレスを入力してください' },
        { status: 400 }
      );
    }

    if (!subject || subject.trim().length === 0) {
      return NextResponse.json(
        { error: '件名は必須です' },
        { status: 400 }
      );
    }

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'お問い合わせ内容は必須です' },
        { status: 400 }
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: 'お問い合わせ内容は2000文字以内で入力してください' },
        { status: 400 }
      );
    }

    // User-Agentを取得
    const userAgent = request.headers.get('user-agent') || null;

    // DBに保存
    const { data: contactMessage, error: insertError } = await supabase
      .from('contact_messages')
      .insert({
        name: name?.trim() || null,
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        page_url: page_url?.trim() || null,
        ip: clientIP !== 'unknown' ? clientIP : null,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (insertError) {
      console.error('問い合わせ保存エラー:', insertError);
      return NextResponse.json(
        { error: '問い合わせの保存に失敗しました' },
        { status: 500 }
      );
    }

    // 通知先メールアドレスを取得
    const { data: settings, error: settingsError } = await supabase
      .from('contact_settings')
      .select('notify_emails')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    if (settingsError) {
      console.error('設定取得エラー:', settingsError);
      // 設定取得に失敗しても問い合わせは保存済みなので成功として返す
      return NextResponse.json({
        success: true,
        message: 'お問い合わせを受け付けました',
        warning: 'メール通知の設定が見つかりませんでした',
      });
    }

    // メール送信（通知先が設定されている場合のみ）
    if (settings?.notify_emails && settings.notify_emails.trim()) {
      console.log('[Contact API] メール送信を試行します。通知先:', settings.notify_emails);
      try {
        const emailResult = await sendNotificationEmail({
          to: settings.notify_emails.split(',').map((e: string) => e.trim()),
          replyTo: email.trim(),
          subject: `【通信制高校リアルレビュー】お問い合わせ：${subject.trim()}`,
          contactId: contactMessage.id,
          name: name?.trim() || '（未入力）',
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          pageUrl: page_url?.trim() || '（未入力）',
          createdAt: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
        });
        console.log('[Contact API] メール送信成功:', emailResult);
      } catch (emailError) {
        console.error('[Contact API] メール送信エラー:', emailError);
        console.error('[Contact API] エラー詳細:', {
          message: emailError instanceof Error ? emailError.message : String(emailError),
          stack: emailError instanceof Error ? emailError.stack : undefined,
        });
        // メール送信に失敗しても問い合わせは保存済みなので成功として返す
        return NextResponse.json({
          success: true,
          message: 'お問い合わせを受け付けました',
          warning: 'メール通知の送信に失敗しました',
          error: emailError instanceof Error ? emailError.message : String(emailError),
        });
      }
    } else {
      console.log('[Contact API] メール通知先が設定されていません。設定値:', settings?.notify_emails);
    }

    return NextResponse.json({
      success: true,
      message: 'お問い合わせを受け付けました',
    });
  } catch (error) {
    console.error('問い合わせAPIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

async function sendNotificationEmail({
  to,
  replyTo,
  subject,
  contactId,
  name,
  email,
  subject: contactSubject,
  message,
  pageUrl,
  createdAt,
}: {
  to: string[];
  replyTo: string;
  subject: string;
  contactId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  pageUrl: string;
  createdAt: string;
}) {
  const emailService = process.env.EMAIL_SERVICE || 'resend';
  const emailApiKey = process.env.EMAIL_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;

  console.log('[Email] メール送信設定確認:', {
    emailService,
    hasApiKey: !!emailApiKey,
    apiKeyLength: emailApiKey?.length || 0,
    emailFrom,
    to,
    replyTo,
    subject,
  });

  if (!emailApiKey) {
    throw new Error('メール送信APIキー（EMAIL_API_KEY）が設定されていません。.env.localに設定してください。');
  }

  if (!emailFrom) {
    throw new Error('送信元メールアドレス（EMAIL_FROM）が設定されていません。.env.localに設定してください。');
  }

  const emailBody = `
お問い合わせが届きました。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【問い合わせ情報】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

受信日時: ${createdAt}
問い合わせID: ${contactId}

お名前: ${name}
メールアドレス: ${email}
件名: ${contactSubject}

対象ページURL: ${pageUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【お問い合わせ内容】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${message}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

このメールに返信すると、${email} に返信されます。

管理画面: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/admin/contacts/${contactId}
`;

  if (emailService === 'resend') {
    const resendApiKey = emailApiKey;
    const requestBody = {
      from: emailFrom,
      to,
      reply_to: replyTo,
      subject,
      text: emailBody,
    };

    console.log('[Email] Resend API リクエスト送信:', {
      url: 'https://api.resend.com/emails',
      from: requestBody.from,
      to: requestBody.to,
      subject: requestBody.subject,
      hasApiKey: !!resendApiKey,
    });

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[Email] Resend API レスポンス:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'レスポンスの解析に失敗しました' }));
      console.error('[Email] Resend API エラーレスポンス:', errorData);
      throw new Error(`Resend API error (${response.status}): ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    console.log('[Email] Resend API 成功レスポンス:', result);
    return result;
  } else {
    // 他のメールサービス（SendGrid、Postmark等）の実装を追加可能
    throw new Error(`未対応のメールサービス: ${emailService}`);
  }
}
