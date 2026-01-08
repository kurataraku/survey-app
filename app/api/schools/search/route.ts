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
      .select('id, name, prefecture, prefectures, status')
      .ilike('name_normalized', `%${normalizedQuery}%`)
      .in('status', ['active', 'pending'])
      .order('status', { ascending: true }) // activeを先に
      .order('name', { ascending: true })
      .limit(10);

    if (errorByName) {
      console.error('学校名検索エラー:', errorByName);
      // エラーを返すのではなく、空配列を返して続行
    }

    // デバッグ用ログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] /api/schools/search - クエリ: "${q}", 正規化: "${normalizedQuery}"`);
      console.log(`[API] 検索結果数: ${schoolsByName?.length || 0}`);
    }

    // 3. 結果をマージ（重複除去）
    const schoolMap = new Map<string, { id: string; name: string; prefecture: string; status: string }>();

    // schoolsテーブルからの結果を追加
    if (schoolsByName) {
      schoolsByName.forEach((school) => {
        if (school.status === 'active' || school.status === 'pending') {
          // prefecture（単一）またはprefectures（配列）から都道府県を取得
          let prefecture = '不明';
          if (school.prefecture) {
            prefecture = school.prefecture;
          } else if (school.prefectures && Array.isArray(school.prefectures) && school.prefectures.length > 0) {
            prefecture = school.prefectures[0];
          }
          
          schoolMap.set(school.id, {
            id: school.id,
            name: school.name,
            prefecture: prefecture,
            status: school.status,
          });
        }
      });
    }

    // 2. school_aliasesテーブルで検索（別名での検索）
    // 注意: Supabaseのリレーション取得が正しく動作しない場合は、別の方法で取得する
    const { data: aliases, error: errorAliases } = await supabase
      .from('school_aliases')
      .select('school_id, alias')
      .ilike('alias_normalized', `%${normalizedQuery}%`)
      .limit(10);

    if (errorAliases) {
      console.error('別名検索エラー:', errorAliases);
    }

    // school_aliasesから取得したschool_idを使って、schoolsテーブルから詳細を取得
    if (aliases && aliases.length > 0) {
      const schoolIds = aliases.map((alias: any) => alias.school_id);
      const { data: schoolsFromAliases, error: errorSchoolsFromAliases } = await supabase
        .from('schools')
        .select('id, name, prefecture, prefectures, status')
        .in('id', schoolIds)
        .in('status', ['active', 'pending']);

      if (errorSchoolsFromAliases) {
        console.error('別名経由の学校取得エラー:', errorSchoolsFromAliases);
      } else if (schoolsFromAliases) {
        schoolsFromAliases.forEach((school) => {
          let prefecture = '不明';
          if (school.prefecture) {
            prefecture = school.prefecture;
          } else if (school.prefectures && Array.isArray(school.prefectures) && school.prefectures.length > 0) {
            prefecture = school.prefectures[0];
          }
          
          schoolMap.set(school.id, {
            id: school.id,
            name: school.name,
            prefecture: prefecture,
            status: school.status,
          });
        });
      }
    }


    // 4. 配列に変換して返却（status='active'を優先、次に'pending'）
    const schools = Array.from(schoolMap.values())
      .sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return a.name.localeCompare(b.name, 'ja');
      })
      .slice(0, 10);

    // デバッグ用ログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] 最終結果数: ${schools.length}`);
    }

    return NextResponse.json({ schools });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}
