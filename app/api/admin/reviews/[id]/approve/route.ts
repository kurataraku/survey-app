import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendApprovedEmail, sendCampaignGrantEmail } from '@/lib/email/sender';
import { issueQuoCardPay } from '@/lib/quocard/client';
import { publicReviewUrl, submitIndexNowUrls } from '@/lib/indexnow/submitIndexNow';
import { resolveSchoolIdFromSchoolName } from '@/lib/reviews/schoolReviewLinkage';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

  // メール送信（重複でない場合のみ）
  if (review.email && !review.is_duplicate_email) {
    // アクティブなキャンペーンを確認
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, title, reward_amount')
      .eq('is_active', true)
      .lte('starts_at', new Date().toISOString())
      .gte('ends_at', new Date().toISOString())
      .limit(1)
      .single();

    if (campaign) {
      // QUOカードPay発行
      const grantResult = await issueQuoCardPay(campaign.reward_amount, review.email);

      await supabase.from('campaign_grants').insert({
        campaign_id: campaign.id,
        survey_response_id: id,
        email: review.email,
        gift_code: grantResult.gift_code ?? null,
        sent_at: grantResult.success ? new Date().toISOString() : null,
        status: grantResult.success ? 'sent' : 'failed',
        error_message: grantResult.error ?? null,
      });

      await sendCampaignGrantEmail({
        to: review.email,
        schoolName: review.school_name,
        rewardAmount: campaign.reward_amount,
        surveyResponseId: id,
        supabase,
      });
    } else {
      // キャンペーン外: 通常の承認メール
      await sendApprovedEmail({
        to: review.email,
        schoolName: review.school_name,
        surveyResponseId: id,
        supabase,
      });
    }
  }

  await submitIndexNowUrls([publicReviewUrl(id)]);

  return NextResponse.json({ success: true });
}
