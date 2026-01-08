import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
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

    // 認証チェック（簡易版 - 実際の実装では適切な認証を実装してください）
    // TODO: 実際の認証チェックを実装

    const { data, error } = await supabase
      .from('contact_settings')
      .select('notify_emails')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    if (error) {
      console.error('設定取得エラー:', error);
      
      // テーブルが存在しない、またはレコードが存在しない場合
      if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
        // 初期データを作成
        const { data: newData, error: insertError } = await supabase
          .from('contact_settings')
          .insert({
            id: '00000000-0000-0000-0000-000000000001',
            notify_emails: '',
          })
          .select('notify_emails')
          .single();

        if (insertError) {
          console.error('初期データ作成エラー:', insertError);
          return NextResponse.json(
            { 
              error: '設定の取得に失敗しました',
              details: insertError.message || 'テーブルが存在しない可能性があります。SupabaseでSQLを実行してください。'
            },
            { status: 500 }
          );
        }

        return NextResponse.json({
          notify_emails: newData?.notify_emails || '',
        });
      }

      return NextResponse.json(
        { 
          error: '設定の取得に失敗しました',
          details: error.message || '不明なエラーが発生しました'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      notify_emails: data?.notify_emails || '',
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    // 認証チェック（簡易版 - 実際の実装では適切な認証を実装してください）
    // TODO: 実際の認証チェックを実装

    const body = await request.json();
    const { notify_emails } = body;

    if (!notify_emails || typeof notify_emails !== 'string') {
      return NextResponse.json(
        { error: '通知先メールアドレスは必須です' },
        { status: 400 }
      );
    }

    // メールアドレスの形式チェック（簡易版）
    const emails = notify_emails.split(',').map((e: string) => e.trim()).filter(Boolean);
    for (const email of emails) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { error: `無効なメールアドレス形式です: ${email}` },
          { status: 400 }
        );
      }
    }

    // まず存在確認して、存在しない場合は作成
    const { data: existingData, error: checkError } = await supabase
      .from('contact_settings')
      .select('id')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single();

    let result;
    if (checkError && (checkError.code === 'PGRST116' || checkError.message?.includes('No rows'))) {
      // レコードが存在しない場合は作成
      const { data: newData, error: insertError } = await supabase
        .from('contact_settings')
        .insert({
          id: '00000000-0000-0000-0000-000000000001',
          notify_emails: notify_emails.trim(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error('設定作成エラー:', insertError);
        return NextResponse.json(
          { 
            error: '設定の作成に失敗しました',
            details: insertError.message || 'テーブルが存在しない可能性があります。SupabaseでSQLを実行してください。'
          },
          { status: 500 }
        );
      }
      result = newData;
    } else {
      // レコードが存在する場合は更新
      const { data: updatedData, error: updateError } = await supabase
        .from('contact_settings')
        .update({
          notify_emails: notify_emails.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .select()
        .single();

      if (updateError) {
        console.error('設定更新エラー:', updateError);
        return NextResponse.json(
          { 
            error: '設定の更新に失敗しました',
            details: updateError.message || '不明なエラーが発生しました'
          },
          { status: 500 }
        );
      }
      result = updatedData;
    }

    return NextResponse.json({
      success: true,
      notify_emails: result.notify_emails,
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
