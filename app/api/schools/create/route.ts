import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeText, generateSlug } from '@/lib/utils';

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

    const body = await request.json();
    const { name, prefecture } = body;

    // バリデーション
    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: '学校名は必須です' },
        { status: 400 }
      );
    }

    // 学校名の長さチェック（2〜40文字）
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 40) {
      return NextResponse.json(
        { error: '学校名は2文字以上40文字以下で入力してください' },
        { status: 400 }
      );
    }

    // 記号だけは不可（文字が含まれているかチェック）
    if (!/[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(trimmedName)) {
      return NextResponse.json(
        { error: '有効な学校名を入力してください' },
        { status: 400 }
      );
    }

    // 正規化名を生成
    const nameNormalized = normalizeText(trimmedName);

    // 既存の学校を検索（name_normalizedで重複チェック）
    const { data: existingSchool, error: searchError } = await supabase
      .from('schools')
      .select('id, name, status')
      .eq('name_normalized', nameNormalized)
      .single();

    if (searchError && searchError.code !== 'PGRST116') {
      // PGRST116は「行が見つからない」エラー（これは正常）
      console.error('学校検索エラー:', searchError);
      return NextResponse.json(
        { error: '学校検索に失敗しました', details: searchError.message },
        { status: 500 }
      );
    }

    // 既存の学校が見つかった場合はそれを返す
    if (existingSchool) {
      return NextResponse.json({
        id: existingSchool.id,
        name: existingSchool.name,
        status: existingSchool.status,
      });
    }

    // 新規学校を作成（status='pending'）
    const slug = generateSlug(trimmedName);
    const prefectureValue = prefecture || '不明';

    const { data: newSchool, error: createError } = await supabase
      .from('schools')
      .insert({
        name: trimmedName,
        name_normalized: nameNormalized,
        prefecture: prefectureValue,
        prefectures: [prefectureValue],
        slug: slug,
        status: 'pending',
        is_public: true,
      })
      .select('id, name, status')
      .single();

    if (createError) {
      console.error('学校作成エラー:', createError);
      return NextResponse.json(
        { error: '学校情報の作成に失敗しました', details: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: newSchool.id,
      name: newSchool.name,
      status: newSchool.status,
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

