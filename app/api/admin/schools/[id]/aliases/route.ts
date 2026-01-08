import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeText } from '@/lib/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const schoolId = params.id;

    const { data: aliases, error } = await supabase
      .from('school_aliases')
      .select('id, alias, created_at')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('別名取得エラー:', error);
      return NextResponse.json(
        { error: '別名の取得に失敗しました', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ aliases: aliases || [] });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const schoolId = params.id;

    const body = await request.json();
    const { alias } = body;

    if (!alias || typeof alias !== 'string' || alias.trim().length === 0) {
      return NextResponse.json(
        { error: '別名は必須です' },
        { status: 400 }
      );
    }

    const aliasNormalized = normalizeText(alias.trim());

    // 重複チェック
    const { data: existing } = await supabase
      .from('school_aliases')
      .select('id')
      .eq('alias_normalized', aliasNormalized)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'この別名は既に登録されています' },
        { status: 400 }
      );
    }

    const { data: newAlias, error } = await supabase
      .from('school_aliases')
      .insert({
        school_id: schoolId,
        alias: alias.trim(),
        alias_normalized: aliasNormalized,
      })
      .select('id, alias, created_at')
      .single();

    if (error) {
      console.error('別名追加エラー:', error);
      return NextResponse.json(
        { error: '別名の追加に失敗しました', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(newAlias, { status: 201 });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const schoolId = params.id;

    const searchParams = request.nextUrl.searchParams;
    const aliasId = searchParams.get('alias_id');

    if (!aliasId) {
      return NextResponse.json(
        { error: '別名IDは必須です' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('school_aliases')
      .delete()
      .eq('id', aliasId)
      .eq('school_id', schoolId); // セキュリティ: 学校IDも確認

    if (error) {
      console.error('別名削除エラー:', error);
      return NextResponse.json(
        { error: '別名の削除に失敗しました', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}



