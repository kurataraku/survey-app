import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin';
import { sendApprovedEmail } from '@/lib/email/sender';
import { publicReviewUrl, submitIndexNowUrls } from '@/lib/indexnow/submitIndexNow';
import { resolveSchoolIdFromSchoolName } from '@/lib/reviews/schoolReviewLinkage';

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
  const body = await request.json().catch(() => ({}));
  const giftUrl: string | undefined = body.gift_url || undefined;

  const supabase = getSupabase();

  const { data: before, error: beforeErr } = await supabase
    .from('survey_responses')
    .select('school_id, school_name')
    .eq('id', id)
    .single();

  if (beforeErr || !before) {
    return NextResponse.json({ error: '承認に失敗しました' }, { status: 500 });
  }

  let schoolIdToSet = before.school_id as string | null;
  if (!schoolIdToSet) {
    schoolIdToSet = await resolveSchoolIdFromSchoolName(supabase, before.school_name);
  }

  const updatePayload: {
    moderation_status: string;
    is_public: boolean;
    school_id?: string;
  } = { moderation_status: 'approved', is_public: true };
  if (schoolIdToSet) {
    updatePayload.school_id = schoolIdToSet;
  }

  const { data: review, error } = await supabase
    .from('survey_responses')
    .update(updatePayload)
    .eq('id', id)
    .select('id, email, school_name, is_duplicate_email')
    .single();

  if (error || !review) {
    return NextResponse.json({ error: '承認に失敗しました' }, { status: 500 });
  }

  console.log('[approve] email:', review.email, 'is_duplicate:', review.is_duplicate_email);

  if (review.email && !review.is_duplicate_email) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, reward_amount')
      .eq('is_active', true)
      .lte('starts_at', new Date().toISOString())
      .gte('ends_at', new Date().toISOString())
      .limit(1)
      .single();

    console.log('[approve] campaign:', campaign ? campaign.id : 'none');

    if (campaign) {
      // gift_url が渡された場合は即 sent、なければ pending（未配布タブに残す）
      await supabase.from('campaign_grants').insert({
        campaign_id: campaign.id,
        survey_response_id: id,
        email: review.email,
        gift_code: giftUrl ?? null,
        sent_at: giftUrl ? new Date().toISOString() : null,
        status: giftUrl ? 'sent' : 'pending',
        error_message: null,
      });
    }

    await sendApprovedEmail({
      to: review.email,
      schoolName: review.school_name,
      surveyResponseId: id,
      giftUrl,
      supabase,
    });
  }

  await submitIndexNowUrls([publicReviewUrl(id)]);

  return NextResponse.json({ success: true });
}
