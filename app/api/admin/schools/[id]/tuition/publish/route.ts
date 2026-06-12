import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';

type PublishAction = 'publish' | 'unpublish' | 'reject';

/**
 * 学費目安の公開状態の切り替え
 * - publish: draft → published（既存の published は draft に降格）
 * - unpublish: published → draft
 * - reject: draft → rejected
 * 自動公開は不可（必ず管理者の操作で実行される）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const schoolId = resolvedParams.id;
    const body = (await request.json()) as { estimateId?: string; action?: PublishAction };
    const { estimateId, action } = body;

    if (!estimateId || !action || !['publish', 'unpublish', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'estimateId と action (publish/unpublish/reject) が必要です' },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();

    const { data: estimate, error: fetchError } = await supabase
      .from('school_tuition_estimates')
      .select('id, school_id, status')
      .eq('id', estimateId)
      .eq('school_id', schoolId)
      .single();

    if (fetchError || !estimate) {
      return NextResponse.json({ error: '学費目安が見つかりません' }, { status: 404 });
    }

    if (action === 'publish') {
      if (estimate.status !== 'draft') {
        return NextResponse.json(
          { error: '公開できるのは下書き状態の学費目安のみです' },
          { status: 400 }
        );
      }

      // 既存の published を draft に降格（部分ユニークインデックスで published は1件のみ）
      const { error: demoteError } = await supabase
        .from('school_tuition_estimates')
        .update({ status: 'draft' })
        .eq('school_id', schoolId)
        .eq('status', 'published');
      if (demoteError) {
        console.error('[tuition publish] 既存公開の降格エラー:', demoteError);
      }

      const { data: published, error: publishError } = await supabase
        .from('school_tuition_estimates')
        .update({ status: 'published' })
        .eq('id', estimateId)
        .select()
        .single();

      if (publishError) {
        console.error('[tuition publish] 公開エラー:', publishError);
        if (publishError.code === '23505') {
          return NextResponse.json(
            { error: '既に公開済みの学費目安が存在します。先に非公開にしてください。' },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: '学費目安の公開に失敗しました' }, { status: 500 });
      }

      return NextResponse.json({ estimate: published });
    }

    if (action === 'unpublish') {
      if (estimate.status !== 'published') {
        return NextResponse.json(
          { error: '非公開にできるのは公開済みの学費目安のみです' },
          { status: 400 }
        );
      }

      const { data: unpublished, error: unpublishError } = await supabase
        .from('school_tuition_estimates')
        .update({ status: 'draft' })
        .eq('id', estimateId)
        .select()
        .single();

      if (unpublishError) {
        console.error('[tuition publish] 非公開化エラー:', unpublishError);
        return NextResponse.json({ error: '学費目安の非公開化に失敗しました' }, { status: 500 });
      }

      return NextResponse.json({ estimate: unpublished });
    }

    // reject
    if (estimate.status !== 'draft') {
      return NextResponse.json(
        { error: '却下できるのは下書き状態の学費目安のみです' },
        { status: 400 }
      );
    }

    const { data: rejected, error: rejectError } = await supabase
      .from('school_tuition_estimates')
      .update({ status: 'rejected' })
      .eq('id', estimateId)
      .select()
      .single();

    if (rejectError) {
      console.error('[tuition publish] 却下エラー:', rejectError);
      return NextResponse.json({ error: '学費目安の却下に失敗しました' }, { status: 500 });
    }

    return NextResponse.json({ estimate: rejected });
  } catch (error) {
    console.error('[tuition publish] APIエラー:', error);
    return NextResponse.json({ error: '学費目安の状態変更に失敗しました' }, { status: 500 });
  }
}
