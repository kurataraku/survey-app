import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeText } from '@/lib/utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
    const { id: sourceSchoolId } = await params;

    const body = await request.json();
    const { target_school_id } = body;

    if (!target_school_id) {
      return NextResponse.json(
        { error: '統合先の学校IDは必須です' },
        { status: 400 }
      );
    }

    if (sourceSchoolId === target_school_id) {
      return NextResponse.json(
        { error: '同じ学校を統合することはできません' },
        { status: 400 }
      );
    }

    // 統合元の学校情報を取得
    const { data: sourceSchool, error: sourceError } = await supabase
      .from('schools')
      .select('id, name, name_normalized')
      .eq('id', sourceSchoolId)
      .single();

    if (sourceError || !sourceSchool) {
      return NextResponse.json(
        { error: '統合元の学校が見つかりません' },
        { status: 404 }
      );
    }

    // 統合先の学校情報を取得
    const { data: targetSchool, error: targetError } = await supabase
      .from('schools')
      .select('id, name')
      .eq('id', target_school_id)
      .single();

    if (targetError || !targetSchool) {
      return NextResponse.json(
        { error: '統合先の学校が見つかりません' },
        { status: 404 }
      );
    }

    // 1. 統合元の学校名をaliasとして統合先に追加
    const aliasNormalized = normalizeText(sourceSchool.name);
    const { error: aliasError } = await supabase
      .from('school_aliases')
      .insert({
        school_id: target_school_id,
        alias: sourceSchool.name,
        alias_normalized: aliasNormalized,
      });

    if (aliasError && aliasError.code !== '23505') {
      // 23505は重複エラー（既に存在する場合は無視）
      console.error('別名追加エラー:', aliasError);
      return NextResponse.json(
        { error: '別名の追加に失敗しました', details: aliasError.message },
        { status: 500 }
      );
    }

    // 2. survey_responsesのschool_idを更新
    const { error: updateError } = await supabase
      .from('survey_responses')
      .update({ school_id: target_school_id })
      .eq('school_id', sourceSchoolId);

    if (updateError) {
      console.error('survey_responses更新エラー:', updateError);
      return NextResponse.json(
        { error: '口コミデータの更新に失敗しました', details: updateError.message },
        { status: 500 }
      );
    }

    // 3. 統合元の学校のstatusを'merged'に変更
    const { error: mergeError } = await supabase
      .from('schools')
      .update({ status: 'merged' })
      .eq('id', sourceSchoolId);

    if (mergeError) {
      console.error('学校統合エラー:', mergeError);
      return NextResponse.json(
        { error: '学校の統合に失敗しました', details: mergeError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `${sourceSchool.name}を${targetSchool.name}に統合しました`,
    });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}



