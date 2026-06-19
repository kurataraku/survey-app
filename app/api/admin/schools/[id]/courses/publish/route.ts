import { NextRequest, NextResponse, after } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import { syncRagForSchoolIds } from '@/lib/rag/sync';

type PublishAction = 'publish' | 'unpublish' | 'reject';

/**
 * コース一覧の公開状態の切り替え
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
    const body = (await request.json()) as { listingId?: string; action?: PublishAction };
    const { listingId, action } = body;

    if (!listingId || !action || !['publish', 'unpublish', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'listingId と action (publish/unpublish/reject) が必要です' },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();

    const { data: listing, error: fetchError } = await supabase
      .from('school_course_listings')
      .select('id, school_id, status')
      .eq('id', listingId)
      .eq('school_id', schoolId)
      .single();

    if (fetchError || !listing) {
      return NextResponse.json({ error: 'コース一覧が見つかりません' }, { status: 404 });
    }

    if (action === 'publish') {
      if (listing.status !== 'draft') {
        return NextResponse.json(
          { error: '公開できるのは下書き状態のコース一覧のみです' },
          { status: 400 }
        );
      }

      const { error: demoteError } = await supabase
        .from('school_course_listings')
        .update({ status: 'draft' })
        .eq('school_id', schoolId)
        .eq('status', 'published');
      if (demoteError) {
        console.error('[courses publish] 既存公開の降格エラー:', demoteError);
      }

      const { data: published, error: publishError } = await supabase
        .from('school_course_listings')
        .update({ status: 'published' })
        .eq('id', listingId)
        .select()
        .single();

      if (publishError) {
        console.error('[courses publish] 公開エラー:', publishError);
        if (publishError.code === '23505') {
          return NextResponse.json(
            { error: '既に公開済みのコース一覧が存在します。先に非公開にしてください。' },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: 'コース一覧の公開に失敗しました' }, { status: 500 });
      }

      after(async () => {
        try {
          await syncRagForSchoolIds([schoolId]);
        } catch (syncError) {
          console.error('[courses publish] RAG同期エラー:', syncError);
        }
      });
      return NextResponse.json({ listing: published });
    }

    if (action === 'unpublish') {
      if (listing.status !== 'published') {
        return NextResponse.json(
          { error: '非公開にできるのは公開済みのコース一覧のみです' },
          { status: 400 }
        );
      }

      const { data: unpublished, error: unpublishError } = await supabase
        .from('school_course_listings')
        .update({ status: 'draft' })
        .eq('id', listingId)
        .select()
        .single();

      if (unpublishError) {
        console.error('[courses publish] 非公開化エラー:', unpublishError);
        return NextResponse.json({ error: 'コース一覧の非公開化に失敗しました' }, { status: 500 });
      }

      after(async () => {
        try {
          await syncRagForSchoolIds([schoolId]);
        } catch (syncError) {
          console.error('[courses unpublish] RAG同期エラー:', syncError);
        }
      });
      return NextResponse.json({ listing: unpublished });
    }

    // reject
    if (listing.status !== 'draft') {
      return NextResponse.json(
        { error: '却下できるのは下書き状態のコース一覧のみです' },
        { status: 400 }
      );
    }

    const { data: rejected, error: rejectError } = await supabase
      .from('school_course_listings')
      .update({ status: 'rejected' })
      .eq('id', listingId)
      .select()
      .single();

    if (rejectError) {
      console.error('[courses publish] 却下エラー:', rejectError);
      return NextResponse.json({ error: 'コース一覧の却下に失敗しました' }, { status: 500 });
    }

    after(async () => {
      try {
        await syncRagForSchoolIds([schoolId]);
      } catch (syncError) {
        console.error('[courses reject] RAG同期エラー:', syncError);
      }
    });
    return NextResponse.json({ listing: rejected });
  } catch (error) {
    console.error('[courses publish] APIエラー:', error);
    return NextResponse.json({ error: 'コース一覧の状態変更に失敗しました' }, { status: 500 });
  }
}
