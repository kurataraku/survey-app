import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { surveySchema, SurveyFormData } from '@/lib/schema';

export async function POST(request: NextRequest) {
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

    const body = await request.json();

    // サーバー側でもZod検証
    const validationResult = surveySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'バリデーションエラー', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const data: SurveyFormData = validationResult.data;

    // answers（JSONB）に格納するデータを準備
    // 設問順に沿った形でフィールドを保持する（配列・補足情報など）
    const answers: Record<string, any> = {
      // Step1: 基本情報
      reason_for_choosing: data.reason_for_choosing,
      course: data.course || null,
      enrollment_type: data.enrollment_type,
      enrollment_year: data.enrollment_year,

      // Step2: 学習/環境
      attendance_frequency: data.attendance_frequency,
      campus_prefecture: data.campus_prefecture,
      teaching_style: data.teaching_style,
      student_atmosphere: data.student_atmosphere,
      atmosphere_other: data.atmosphere_other,

      // Step3: 評価
      flexibility_rating: data.flexibility_rating,
      staff_rating: data.staff_rating,
      support_rating: data.support_rating,
      atmosphere_fit_rating: data.atmosphere_fit_rating,
      credit_rating: data.credit_rating,
      unique_course_rating: data.unique_course_rating,
      career_support_rating: data.career_support_rating,
      campus_life_rating: data.campus_life_rating,
      tuition_rating: data.tuition_rating,
    };

    // Supabaseに挿入
    const { error } = await supabase.from('survey_responses').insert({
      school_name: data.school_name,
      respondent_role: data.respondent_role,
      status: data.status,
      graduation_path: data.graduation_path || null,
      graduation_path_other: data.graduation_path_other || null,
      overall_satisfaction: parseInt(data.overall_satisfaction),
      good_comment: data.good_comment,
      bad_comment: data.bad_comment,
      answers: answers,
      email: data.email || null,
    });

    if (error) {
      console.error('Supabase挿入エラー:', error);
      return NextResponse.json(
        { error: 'データの保存に失敗しました', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('APIエラー:', error);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
}

