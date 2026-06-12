import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdminOrAgent } from '@/lib/auth/admin';
import { extractCoursesFromOfficialSite } from '@/lib/courses/extract';

export const maxDuration = 120;

/**
 * コース一覧のAI抽出（管理画面・エージェントCLI共用）
 * - 公式URL（schools.official_url）を起点にコースページを取得し、明記された名称のみ抽出する
 * - 結果は必ず draft として保存する（自動公開しない）。published には触れない
 *
 * body: {
 *   coursePageUrl?: string;  // コースページの直接指定（再実行用）
 *   dryRun?: boolean;        // 抽出のみ実行し保存しない
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdminOrAgent(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const schoolId = resolvedParams.id;
    const body = (await request.json().catch(() => ({}))) as {
      coursePageUrl?: string;
      dryRun?: boolean;
    };

    const supabase = createAdminSupabaseClient();
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, name, official_url')
      .eq('id', schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json({ error: '学校が見つかりません' }, { status: 404 });
    }

    const coursePageUrl =
      typeof body.coursePageUrl === 'string' && /^https?:\/\//i.test(body.coursePageUrl.trim())
        ? body.coursePageUrl.trim()
        : null;

    const officialUrl: string | null =
      typeof school.official_url === 'string' && school.official_url.trim()
        ? school.official_url.trim()
        : null;

    if (!officialUrl && !coursePageUrl) {
      return NextResponse.json({
        skipped: true,
        reason: 'official_url が未登録です。管理画面で公式URLを登録してください。',
        school: { id: school.id, name: school.name },
      });
    }

    const result = await extractCoursesFromOfficialSite({
      schoolName: school.name,
      officialUrl,
      coursePageUrl,
    });

    if (body.dryRun === true) {
      return NextResponse.json({
        dryRun: true,
        school: { id: school.id, name: school.name },
        extraction: result,
      });
    }

    // draft として保存（既存draftがあれば上書き。published には絶対に触れない）
    const createdBy = authResult.adminUser.id !== 'agent' ? authResult.adminUser.id : null;
    const { data: existingDraft } = await supabase
      .from('school_course_listings')
      .select('id')
      .eq('school_id', schoolId)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let saveResult;
    if (existingDraft) {
      saveResult = await supabase
        .from('school_course_listings')
        .update({ ...result.input, origin: 'ai' })
        .eq('id', existingDraft.id)
        .select()
        .single();
    } else {
      saveResult = await supabase
        .from('school_course_listings')
        .insert({
          school_id: schoolId,
          ...result.input,
          origin: 'ai',
          status: 'draft',
          created_by: createdBy,
        })
        .select()
        .single();
    }

    if (saveResult.error) {
      console.error('[courses extract] draft保存エラー:', saveResult.error);
      return NextResponse.json({ error: '抽出結果の保存に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({
      school: { id: school.id, name: school.name },
      draft: saveResult.data,
      found_courses: result.foundCourses,
      fetched_urls: result.fetchedUrls,
      warnings: result.warnings,
      tokens_used: result.tokensUsed,
    });
  } catch (error) {
    console.error('[courses extract] APIエラー:', error);
    return NextResponse.json(
      {
        error: 'コース情報の抽出に失敗しました',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
