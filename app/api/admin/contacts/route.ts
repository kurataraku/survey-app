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

    const searchParams = request.nextUrl.searchParams;
    const isReadParam = searchParams.get('is_read');

    let query = supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (isReadParam === 'true' || isReadParam === 'false') {
      query = query.eq('is_read', isReadParam === 'true');
    }

    const { data, error } = await query;

    if (error) {
      console.error('問い合わせ一覧取得エラー:', error);
      return NextResponse.json(
        { error: '問い合わせ一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      contacts: data || [],
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
