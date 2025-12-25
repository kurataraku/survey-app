import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    // 環境変数のチェック
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { 
          error: 'Supabase環境変数が設定されていません',
          message: 'NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください。'
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // データを取得
    const { data, error } = await supabase
      .from('survey_responses')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase取得エラー:', error);
      return NextResponse.json(
        { error: 'データの取得に失敗しました', details: error.message },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'データがありません' },
        { status: 404 }
      );
    }

    // CSVヘッダーを定義（設問番号順）
    const headers = [
      'ID',
      '送信日時',
      // Step1: 基本情報（Q1〜Q8）
      'どの通信制高校についての口コミですか？（学校名）',
      'あなたの立場',
      '状況',
      '卒業後の進路',
      '卒業後の進路（その他）',
      '通信制を選んだ理由',
      '在籍していたコース',
      '入学タイミング',
      '入学年',
      // Step2: 学習/環境（Q9〜Q12.1）
      '主な通学頻度',
      '主に通っていたキャンパス都道府県',
      '授業スタイル',
      '生徒の雰囲気',
      'その他（生徒の雰囲気）',
      // Step3: 評価（Q13〜Q22）
      '学びの柔軟さ（評価）',
      '先生・職員の対応（評価）',
      '心や体調の波・不安などに対するサポート（評価）',
      '在校生の雰囲気が自分に合っていたか（評価）',
      '単位取得のしやすさ（評価）',
      '独自授業・コースの充実度（評価）',
      '進路サポート（評価）',
      '行事やキャンパスライフの過ごしやすさ（評価）',
      '学費の納得感（評価）',
      '総合満足度',
      // Q23〜Q25
      '良かった点（自由記述）',
      '改善してほしい点/合わない点（自由記述）',
      'メールアドレス',
    ];

    // CSV行を生成
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const answers = row.answers || {};

      // 配列をセミコロン区切りの文字列に変換
      const reasonForChoosing = Array.isArray(answers.reason_for_choosing)
        ? answers.reason_for_choosing.join('; ')
        : '';
      const teachingStyle = Array.isArray(answers.teaching_style)
        ? answers.teaching_style.join('; ')
        : '';
      const studentAtmosphere = Array.isArray(answers.student_atmosphere)
        ? answers.student_atmosphere.join('; ')
        : '';

      // CSVの値をエスケープ（カンマ、改行、ダブルクォートを含む場合）
      const escapeCsvValue = (value: any): string => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvRow = [
        // メタ情報
        escapeCsvValue(row.id),
        escapeCsvValue(row.created_at),
        // Step1: 基本情報（Q1〜Q8）
        escapeCsvValue(row.school_name),
        escapeCsvValue(row.respondent_role),
        escapeCsvValue(row.status),
        escapeCsvValue(row.graduation_path || ''),
        escapeCsvValue(row.graduation_path_other || ''),
        escapeCsvValue(reasonForChoosing),
        escapeCsvValue(answers.course || ''),
        escapeCsvValue(answers.enrollment_type || ''),
        escapeCsvValue(answers.enrollment_year || ''),
        // Step2: 学習/環境（Q9〜Q12.1）
        escapeCsvValue(answers.attendance_frequency || ''),
        escapeCsvValue(answers.campus_prefecture || ''),
        escapeCsvValue(teachingStyle),
        escapeCsvValue(studentAtmosphere),
        escapeCsvValue(answers.atmosphere_other || ''),
        // Step3: 評価（Q13〜Q22）
        escapeCsvValue(answers.flexibility_rating || ''),
        escapeCsvValue(answers.staff_rating || ''),
        escapeCsvValue(answers.support_rating || ''),
        escapeCsvValue(answers.atmosphere_fit_rating || ''),
        escapeCsvValue(answers.credit_rating || ''),
        escapeCsvValue(answers.unique_course_rating || ''),
        escapeCsvValue(answers.career_support_rating || ''),
        escapeCsvValue(answers.campus_life_rating || ''),
        escapeCsvValue(answers.tuition_rating || ''),
        escapeCsvValue(row.overall_satisfaction),
        // Q23〜Q25
        escapeCsvValue(row.good_comment),
        escapeCsvValue(row.bad_comment),
        escapeCsvValue(row.email || ''),
      ];

      csvRows.push(csvRow.join(','));
    }

    // CSV文字列を生成
    const csvContent = csvRows.join('\n');

    // BOMを追加してExcelで文字化けを防ぐ
    const bom = '\uFEFF';
    const csvWithBom = bom + csvContent;

    // CSVファイルとして返す
    return new NextResponse(csvWithBom, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="survey_responses_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('CSVエクスポートエラー:', error);
    return NextResponse.json(
      { error: 'CSVエクスポートに失敗しました' },
      { status: 500 }
    );
  }
}

