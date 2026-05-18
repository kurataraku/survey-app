import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin';
import { sendRejectedEmail } from '@/lib/email/sender';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await request.json();
  const { reason } = body as { reason: string };

  if (!reason?.trim()) {
    return NextResponse.json({ error: '却下理由を入力してください' }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data: review, error } = await supabase
    .from('survey_responses')
    .update({
      moderation_status: 'rejected',
      is_public: false,
      rejection_reason: reason,
    })
    .eq('id', id)
    .select('id, email, school_name')
    .single();

  if (error || !review) {
    return NextResponse.json({ error: '却下処理に失敗しました' }, { status: 500 });
  }

  if (review.email) {
    // アクティブなキャンペーンがあるか確認（メール文面切り替え用）
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('is_active', true)
      .lte('starts_at', new Date().toISOString())
      .gte('ends_at', new Date().toISOString())
      .limit(1)
      .single();

    await sendRejectedEmail({
      to: review.email,
      schoolName: review.school_name,
      reason,
      hasCampaign: !!campaign,
      surveyResponseId: id,
      supabase,
    });
  }

  return NextResponse.json({ success: true });
}
