import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeText } from '@/lib/utils';

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
      return NextResponse.json({ schools: [] });
    }

    // 検索クエリを正規化
    const normalizedQuery = normalizeText(q);

    // 1. schoolsテーブルでname_normalizedで検索
    // trigram類似検索を使用（pg_trgm拡張が必要）
    // まずは部分一致検索で試す
    const { data: schoolsByName, error: errorByName } = await supabase
      .from('schools')
      .select('id, name, prefecture, status')
      .ilike('name_normalized', `%${normalizedQuery}%`)
      .in('status', ['active', 'pending'])
      .order('status', { ascending: true }) // activeを先に
      .order('name', { ascending: true })
      .limit(10);

    if (errorByName) {
      console.error('学校名検索エラー:', errorByName);
    }

    // 2. school_aliasesテーブルで検索
    const { data: aliases, error: errorAliases } = await supabase
      .from('school_aliases')
      .select('school_id, schools(id, name, prefecture, status)')
      .ilike('alias_normalized', `%${normalizedQuery}%`)
      .limit(10);

    if (errorAliases) {
      console.error('別名検索エラー:', errorAliases);
    }

    // 3. 結果をマージ（重複除去）
    const schoolMap = new Map<string, { id: string; name: string; prefecture: string; status: string }>();

    // schoolsテーブルからの結果を追加
    if (schoolsByName) {
      schoolsByName.forEach((school) => {
        if (school.status === 'active' || school.status === 'pending') {
          schoolMap.set(school.id, {
            id: school.id,
            name: school.name,
            prefecture: school.prefecture || '不明',
            status: school.status,
          });
        }
      });
    }

    // school_aliasesからの結果を追加
    if (aliases) {
      aliases.forEach((alias: any) => {
        if (alias.schools && (alias.schools.status === 'active' || alias.schools.status === 'pending')) {
          schoolMap.set(alias.school_id, {
            id: alias.school_id,
            name: alias.schools.name,
            prefecture: alias.schools.prefecture || '不明',
            status: alias.schools.status,
          });
        }
      });
    }

    // 4. 配列に変換して返却（status='active'を優先、次に'pending'）
    const schools = Array.from(schoolMap.values())
      .sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return a.name.localeCompare(b.name, 'ja');
      })
      .slice(0, 10);

    return NextResponse.json({ schools });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
