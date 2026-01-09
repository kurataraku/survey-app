import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSearchQuery } from '@/lib/utils';

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

    // クエリパラメータを取得
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';

    if (!q || q.length < 1) {
      return NextResponse.json({ suggestions: [] });
    }

    // 検索クエリを正規化（全角→半角変換）
    const normalizedQuery = normalizeSearchQuery(q);

    // 学校名での部分一致検索（最大10件）
    // 正規化されたクエリで検索（status='active'のみ）
    const { data: schools, error } = await supabase
      .from('schools')
      .select('id, name, prefecture, slug, status')
      .eq('is_public', true)
      .eq('status', 'active') // 承認済み（active）のみ
      .ilike('name', `%${normalizedQuery}%`)
      .order('name', { ascending: true })
      .limit(10);

    if (error) {
      console.error('学校検索エラー:', error);
      return NextResponse.json(
        { error: '学校検索に失敗しました', details: error.message, code: error.code },
        { status: 500 }
      );
    }

    // 念のため、activeのみをフィルタリング（クエリで既にフィルタリング済みだが、二重チェック）
    const suggestions = (schools || [])
      .filter((school) => school.status === 'active')
      .map((school) => ({
        id: school.id,
        name: school.name,
        prefecture: school.prefecture,
        slug: school.slug,
      }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

