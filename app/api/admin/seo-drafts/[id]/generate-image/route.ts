import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth/admin';
import {
  runImageGenerator,
  downloadAndUploadImage,
} from '@/lib/seo-generation/image-generator';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    const id = resolvedParams.id;
    const supabase = createAdminSupabaseClient();

    const { data: draft, error: fetchError } = await supabase
      .from('seo_drafts')
      .select(
        'id, keyword, title, draft_type, school_id, school:schools!seo_drafts_school_id_fkey(name)'
      )
      .eq('id', id)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json(
        { error: '下書きが見つかりません' },
        { status: 404 }
      );
    }

    const schoolRecord = draft.school as unknown as { name: string } | null;

    const result = await runImageGenerator({
      keyword: draft.keyword,
      title: draft.title || draft.keyword,
      draftType: draft.draft_type,
      schoolName: schoolRecord?.name,
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase環境変数が設定されていません' },
        { status: 500 }
      );
    }

    const publicUrl = await downloadAndUploadImage(
      result.imageUrl,
      supabaseUrl,
      supabaseServiceKey
    );

    const { error: updateError } = await supabase
      .from('seo_drafts')
      .update({ featured_image_url: publicUrl })
      .eq('id', id);

    if (updateError) {
      console.error('[generate-image] update error:', updateError);
      return NextResponse.json(
        { error: '画像URLの保存に失敗しました', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ imageUrl: publicUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '画像生成エラー';
    console.error('[generate-image] error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
