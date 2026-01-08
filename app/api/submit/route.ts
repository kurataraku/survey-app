import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { surveySchema, SurveyFormData } from '@/lib/schema';
import { normalizeAnswers } from '@/lib/normalizeAnswers';
import { generateSlug } from '@/lib/utils';

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
    const rawAnswers: Record<string, any> = {
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

    // answersを正規化（キー名の統一、型変換、バリデーション）
    console.log('[API] /api/submit - rawAnswers:', JSON.stringify(rawAnswers, null, 2));
    console.log('[API] /api/submit - rawAnswers.campus_prefecture:', rawAnswers.campus_prefecture);
    const answers = await normalizeAnswers(
      rawAnswers,
      supabaseUrl,
      supabaseServiceKey
    );
    console.log('[API] /api/submit - normalized answers:', JSON.stringify(answers, null, 2));
    console.log('[API] /api/submit - normalized answers.campus_prefecture:', answers.campus_prefecture);

    // ============================================================================
    // schoolsテーブルからschool_idを取得または作成
    // ============================================================================
    let schoolId: string | null = null;
    let schoolNameToSave: string = data.school_name;
    let schoolNameInput: string | null = null;

    // school_idが提供されている場合（オートコンプリートから選択された場合）
    if (data.school_id) {
      schoolId = data.school_id;
      
      // 学校名とステータスを取得
      const { data: schoolData } = await supabase
        .from('schools')
        .select('name, status')
        .eq('id', schoolId)
        .single();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/submit/route.ts:90',message:'口コミ投稿:学校情報取得',data:{schoolId,schoolName:schoolData?.name,schoolStatus:schoolData?.status},timestamp:Date.now(),sessionId:'debug-session',runId:'pending-check',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      if (schoolData) {
        schoolNameToSave = schoolData.name;
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/0312fc5c-8c2b-4b8c-9a2b-089d506d00dc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/submit/route.ts:97',message:'口コミ投稿:学校ステータス確認',data:{schoolId,schoolStatus:schoolData.status,isPending:schoolData.status==='pending',willBeHidden:schoolData.status==='pending'},timestamp:Date.now(),sessionId:'debug-session',runId:'pending-check',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      }
      
      // school_name_inputは「その他」入力時のみ保存
      schoolNameInput = data.school_name_input || null;
    } else if (data.school_name) {
      // 後方互換: school_idが提供されていない場合は既存のロジックで処理
      // 既存の学校を検索
      const { data: existingSchool, error: searchError } = await supabase
        .from('schools')
        .select('id, name')
        .eq('name', data.school_name)
        .single();

      if (searchError && searchError.code !== 'PGRST116') {
        // PGRST116は「行が見つからない」エラー（これは正常）
        console.error('学校検索エラー:', searchError);
      }

      if (existingSchool) {
        schoolId = existingSchool.id;
        schoolNameToSave = existingSchool.name;
      } else {
        // 新規学校を作成（後方互換のため、このロジックは残す）
        const prefecture = data.campus_prefecture || '不明';
        const slug = generateSlug(data.school_name);
        
        const { data: newSchool, error: createError } = await supabase
          .from('schools')
          .insert({
            name: data.school_name,
            name_normalized: data.school_name, // 一時的にnameをそのまま使用（後で正規化関数で更新可能）
            prefecture: prefecture,
            prefectures: [prefecture],
            slug: slug,
            status: 'pending', // 後方互換のためpendingで作成
            is_public: true
          })
          .select('id, name')
          .single();

        if (createError) {
          console.error('学校作成エラー:', createError);
          // エラーが発生しても続行（school_idはnullのまま）
        } else if (newSchool) {
          schoolId = newSchool.id;
          schoolNameToSave = newSchool.name;
        }
      }
    }

    // 既存の学校のprefectures配列を更新（school_idが存在する場合）
    if (schoolId) {
      const campusPrefecture = data.campus_prefecture || '不明';
      
      // 現在のprefectures配列を取得
      const { data: currentSchool } = await supabase
        .from('schools')
        .select('prefectures, prefecture')
        .eq('id', schoolId)
        .single();
      
      if (currentSchool) {
        const currentPrefectures = currentSchool?.prefectures || [];
        // 新しい都道府県が配列に含まれていない場合は追加
        if (!currentPrefectures.includes(campusPrefecture)) {
          const newPrefectures = [...currentPrefectures, campusPrefecture];
          
          // prefectures配列を更新（prefectureも最初の要素で更新）
          await supabase
            .from('schools')
            .update({
              prefectures: newPrefectures,
              prefecture: newPrefectures[0] || currentSchool?.prefecture || '不明'
            })
            .eq('id', schoolId);
        }
      }
    }

    // ============================================================================
    // answersから検索用カラムの値を準備
    // ============================================================================
    const enrollmentYear = data.enrollment_year ? parseInt(data.enrollment_year) : null;
    const attendanceFrequency = data.attendance_frequency || null;
    const reasonForChoosing = Array.isArray(data.reason_for_choosing) 
      ? data.reason_for_choosing 
      : [];
    const staffRating = data.staff_rating ? parseInt(data.staff_rating) : null;
    const atmosphereFitRating = data.atmosphere_fit_rating ? parseInt(data.atmosphere_fit_rating) : null;
    const creditRating = data.credit_rating ? parseInt(data.credit_rating) : null;
    const tuitionRating = data.tuition_rating ? parseInt(data.tuition_rating) : null;

    // ============================================================================
    // Supabaseに挿入（検索用カラムも含める）
    // ============================================================================
    const { error } = await supabase.from('survey_responses').insert({
      // 既存のフィールド（後方互換性のため維持）
      school_name: schoolNameToSave, // 選択された学校名を使用
      respondent_role: data.respondent_role,
      status: data.status,
      graduation_path: data.graduation_path || null,
      graduation_path_other: data.graduation_path_other || null,
      overall_satisfaction: parseInt(data.overall_satisfaction),
      good_comment: data.good_comment,
      bad_comment: data.bad_comment,
      answers: answers,
      email: data.email || null,
      // 新規追加フィールド
      school_id: schoolId,
      school_name_input: schoolNameInput, // その他入力時の原文
      // Epic1で追加した検索用カラム
      enrollment_year: enrollmentYear,
      attendance_frequency: attendanceFrequency,
      reason_for_choosing: reasonForChoosing.length > 0 ? reasonForChoosing : null,
      staff_rating: staffRating,
      atmosphere_fit_rating: atmosphereFitRating,
      credit_rating: creditRating,
      tuition_rating: tuitionRating,
      is_public: true,
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

