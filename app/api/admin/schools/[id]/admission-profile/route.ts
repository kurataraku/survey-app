import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import {
  canPublishAdmissionProfile,
  getAdmissionProfileForAdmin,
  needsReverification,
  sanitizeAdmissionProfileInput,
  upsertAdmissionProfile,
} from '@/lib/schools/admissionProfiles';

const TABLE_MISSING_MESSAGE =
  'school_admission_profiles テーブルが未作成です。supabase-migrations/create-school-admission-profiles.sql を適用してください';

type RouteParams = { params: Promise<{ id: string }> | { id: string } };

async function resolveId(params: RouteParams['params']): Promise<string> {
  const resolved = params instanceof Promise ? await params : params;
  return resolved.id;
}

/** 入学条件・スクーリング確認データの取得（管理画面用） */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const schoolId = await resolveId(params);
    const supabase = createAdminSupabaseClient();
    const { profile, tableMissing } = await getAdmissionProfileForAdmin(supabase, schoolId);
    return NextResponse.json({
      profile,
      tableMissing,
      needsReverification: profile ? needsReverification(profile) : null,
    });
  } catch (error) {
    console.error('[admission-profile GET] APIエラー:', error);
    return NextResponse.json({ error: '入学条件の取得に失敗しました' }, { status: 500 });
  }
}

/**
 * 保存。body.action = 'draft'（下書き）/ 'publish'（公開）/ 'unpublish'（下書きに戻す）
 * 公開は確認日と公式出典が揃っている場合のみ許可する。
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const schoolId = await resolveId(params);
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action === 'publish' ? 'publish' : 'draft';
    const input = sanitizeAdmissionProfileInput(body);

    if (action === 'publish') {
      const reason = canPublishAdmissionProfile(input);
      if (reason) return NextResponse.json({ error: reason }, { status: 400 });
      if (needsReverification(input)) {
        return NextResponse.json(
          { error: '確認日が12か月より前、または対象年度が過ぎています。再確認してから公開してください' },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminSupabaseClient();
    const { data: school } = await supabase.from('schools').select('id').eq('id', schoolId).maybeSingle();
    if (!school) return NextResponse.json({ error: '学校が見つかりません' }, { status: 404 });

    const updatedBy = authResult.adminUser.id !== 'agent' ? authResult.adminUser.id : null;
    const { profile, tableMissing } = await upsertAdmissionProfile(
      supabase,
      schoolId,
      input,
      action === 'publish' ? 'published' : 'draft',
      updatedBy
    );
    if (tableMissing) return NextResponse.json({ error: TABLE_MISSING_MESSAGE }, { status: 503 });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[admission-profile PUT] APIエラー:', error);
    return NextResponse.json({ error: '入学条件の保存に失敗しました' }, { status: 500 });
  }
}
