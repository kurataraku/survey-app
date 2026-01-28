import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const contactId = resolvedParams.id;

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
      .from('contact_messages')
      .select('*')
      .eq('id', contactId)
      .single();

    if (error) {
      console.error('問い合わせ取得エラー:', error);
      
      // PGRST116は「No rows returned」を意味する（レコードが見つからない）
      if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
        return NextResponse.json(
          { error: '問い合わせが見つかりませんでした' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: '問い合わせの取得に失敗しました', details: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: '問い合わせが見つかりませんでした' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      contact: data,
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    // Next.js 16では params が Promise になる可能性がある
    const resolvedParams = params instanceof Promise ? await params : params;
    const contactId = resolvedParams.id;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await request.json();
    const { is_read } = body;

    if (typeof is_read !== 'boolean') {
      return NextResponse.json(
        { error: 'is_readはboolean型である必要があります' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('contact_messages')
      .update({ is_read })
      .eq('id', contactId)
      .select()
      .single();

    if (error) {
      console.error('問い合わせ更新エラー:', error);
      return NextResponse.json(
        { error: '問い合わせの更新に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      contact: data,
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
