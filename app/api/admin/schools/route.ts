import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdminOrAgent } from '@/lib/auth/admin';
import { searchAdminSchools } from '@/lib/schools/adminSearchSchools';
import { sanitizeCampusLocationsInput } from '@/lib/schools/campusLocations';
import { normalizeText } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminOrAgent(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }
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
    const status = searchParams.get('status') || '';
    const prefecture = searchParams.get('prefecture') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    try {
      const result = await searchAdminSchools(supabase, { q, status, prefecture, page, limit });
      return NextResponse.json(result);
    } catch (error) {
      console.error('学校検索エラー:', error);

      const message = error instanceof Error ? error.message : '学校検索に失敗しました';
      const code = (error as { code?: string }).code;
      const hint = (error as { hint?: string }).hint;

      if (message === '{\"') {
        return NextResponse.json(
          {
            schools: [],
            total: 0,
            page,
            limit,
            total_pages: 0,
            warning: '一部の学校データ取得で予期しないエラーが発生したため、空の結果を返しました。',
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: '学校検索に失敗しました', details: message, code, hint },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminOrAgent(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

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

    const body = await request.json();
    const {
      name,
      prefecture,
      prefectures,
      institution_type,
      campus_locations,
      slug,
      intro,
      highlights,
      faq,
      is_public,
    } = body;

    // バリデーション
    if (!name || !prefecture || !slug) {
      return NextResponse.json(
        { error: '学校名、都道府県、スラッグは必須です' },
        { status: 400 }
      );
    }

    // prefectures配列を準備（prefecturesが指定されていない場合はprefectureから作成）
    const prefecturesArray = prefectures && Array.isArray(prefectures) && prefectures.length > 0
      ? prefectures
      : [prefecture];
    const campusLocationsArray = sanitizeCampusLocationsInput(campus_locations);

    const nameNormalized = normalizeText(String(name));

    if (!nameNormalized) {
      return NextResponse.json(
        { error: '学校名を正しく入力してください（有効な文字が含まれている必要があります）' },
        { status: 400 }
      );
    }

    // 学校名の重複チェック
    const { data: nameConflict } = await supabase
      .from('schools')
      .select('id')
      .eq('name', name)
      .single();

    if (nameConflict) {
      return NextResponse.json(
        { error: 'この学校名は既に使用されています' },
        { status: 400 }
      );
    }

    const { data: normalizedConflict } = await supabase
      .from('schools')
      .select('id')
      .eq('name_normalized', nameNormalized)
      .maybeSingle();

    if (normalizedConflict) {
      return NextResponse.json(
        { error: 'この学校名は既存校と正規化後に同一になるため登録できません（表記を変えてください）' },
        { status: 400 }
      );
    }

    // スラッグの重複チェック
    const { data: slugConflict } = await supabase
      .from('schools')
      .select('id')
      .eq('slug', slug)
      .single();

    if (slugConflict) {
      return NextResponse.json(
        { error: 'このスラッグは既に使用されています' },
        { status: 400 }
      );
    }

    // 学校情報を作成（DBの name_normalized NOT NULL / status 既定値に整合）
    const insertData: Record<string, unknown> = {
      name,
      name_normalized: nameNormalized,
      prefecture,
      prefectures: prefecturesArray,
      institution_type: institution_type || null,
      campus_locations: campusLocationsArray,
      slug,
      intro: intro || null,
      highlights: highlights || null,
      faq: faq || null,
      is_public: is_public !== undefined ? is_public : true,
    };

    const { data: school, error: insertError } = await supabase
      .from('schools')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error('学校作成エラー:', insertError);
      return NextResponse.json(
        { error: '学校情報の作成に失敗しました', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(school, { status: 201 });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}




