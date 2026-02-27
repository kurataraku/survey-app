import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin';
import { surveyImportSchema, type SurveyImportFormData } from '@/lib/schema';
import { normalizeAnswers } from '@/lib/normalizeAnswers';

const BATCH_SIZE = 50;

export interface ImportResponse {
  success: number;
  failed: number;
  errors: Array<{ rowIndex: number; message: string }>;
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: 'Supabase環境変数が設定されていません' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'リクエストボディが不正です' },
      { status: 400 }
    );
  }

  const rawRows = Array.isArray(body) ? body : (body as { rows?: unknown })?.rows;
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return NextResponse.json(
      { error: 'インポートするデータ（rows配列）が空です' },
      { status: 400 }
    );
  }

  const validatedRows: Array<{ data: SurveyImportFormData; originalIndex: number }> = [];
  const validationErrors: Array<{ rowIndex: number; message: string }> = [];

  for (let i = 0; i < rawRows.length; i++) {
    const parsed = surveyImportSchema.safeParse(rawRows[i]);
    if (parsed.success) {
      validatedRows.push({ data: parsed.data, originalIndex: i });
    } else {
      const firstIssue = parsed.error.issues[0];
      validationErrors.push({
        rowIndex: i + 1,
        message: firstIssue?.message ?? 'バリデーションエラー',
      });
    }
  }

  const uniqueSchoolNames = [...new Set(validatedRows.map((r) => r.data.school_name.trim()))];
  const { data: schools } = await supabase
    .from('schools')
    .select('id, name')
    .in('name', uniqueSchoolNames);

  const nameToId = new Map<string, string>();
  if (schools) {
    for (const s of schools) {
      nameToId.set(s.name, s.id);
    }
  }

  const toInsert: Array<Record<string, unknown>> = [];
  const insertErrors: Array<{ rowIndex: number; message: string }> = [];

  for (let i = 0; i < validatedRows.length; i++) {
    const { data, originalIndex } = validatedRows[i];
    const schoolId = nameToId.get(data.school_name.trim());
    if (!schoolId) {
      insertErrors.push({
        rowIndex: originalIndex + 1,
        message: `この学校名はシステムに登録されていません: ${data.school_name}`,
      });
      continue;
    }

    const rawAnswers: Record<string, unknown> = {
      reason_for_choosing: data.reason_for_choosing,
      course: data.course ?? null,
      enrollment_type: data.enrollment_type,
      enrollment_year: data.enrollment_year,
      attendance_frequency: data.attendance_frequency,
      campus_prefecture: data.campus_prefecture,
      teaching_style: data.teaching_style,
      student_atmosphere: data.student_atmosphere,
      atmosphere_other: data.atmosphere_other,
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

    const answers = await normalizeAnswers(
      rawAnswers as Record<string, any>,
      supabaseUrl,
      supabaseServiceKey
    );

    const enrollmentYear = data.enrollment_year ? parseInt(data.enrollment_year, 10) : null;
    const reasonForChoosing = Array.isArray(data.reason_for_choosing) ? data.reason_for_choosing : [];
    const staffRating = data.staff_rating ? parseInt(data.staff_rating, 10) : null;
    const atmosphereFitRating = data.atmosphere_fit_rating ? parseInt(data.atmosphere_fit_rating, 10) : null;
    const creditRating = data.credit_rating ? parseInt(data.credit_rating, 10) : null;
    const tuitionRating = data.tuition_rating ? parseInt(data.tuition_rating, 10) : null;

    toInsert.push({
      school_name: data.school_name,
      school_id: schoolId,
      school_name_input: data.school_name_input ?? null,
      respondent_role: data.respondent_role,
      status: data.status,
      graduation_path: data.graduation_path ?? null,
      graduation_path_other: data.graduation_path_other ?? null,
      overall_satisfaction: parseInt(data.overall_satisfaction, 10),
      good_comment: data.good_comment,
      bad_comment: data.bad_comment,
      answers,
      email: data.email ?? null,
      enrollment_year: enrollmentYear,
      attendance_frequency: data.attendance_frequency || null,
      reason_for_choosing: reasonForChoosing.length > 0 ? reasonForChoosing : null,
      staff_rating: staffRating,
      atmosphere_fit_rating: atmosphereFitRating,
      credit_rating: creditRating,
      tuition_rating: tuitionRating,
      is_public: true,
    });
  }

  const allErrors = [...validationErrors, ...insertErrors];
  let insertSuccess = 0;

  for (let offset = 0; offset < toInsert.length; offset += BATCH_SIZE) {
    const batch = toInsert.slice(offset, offset + BATCH_SIZE);
    const { error } = await supabase.from('survey_responses').insert(batch);
    if (error) {
      return NextResponse.json(
        {
          error: 'データの保存に失敗しました',
          details: error.message,
          success: insertSuccess,
          failed: toInsert.length - insertSuccess + allErrors.length,
          errors: allErrors,
        },
        { status: 500 }
      );
    }
    insertSuccess += batch.length;
  }

  return NextResponse.json({
    success: insertSuccess,
    failed: allErrors.length,
    errors: allErrors,
  } satisfies ImportResponse);
}
