import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin';
import { sendGrantGiftEmail, type GrantType } from '@/lib/email/sender';
import { getReferralShareInfo } from '@/lib/referral/server';
import type { ReferralShareInfo } from '@/lib/referral/shared';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const SENDING_MARKER = '__sending__';

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * body.action
 *   未指定      : 送付済みにする（メールは送らない。従来の手動送付用）
 *   send_email : body.gift_url を種別に応じたメールで送り、送付済みにする
 *   cancel     : 対象外にする
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; grantId: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id, grantId } = await params;
  const body = await request.json().catch(() => ({}));
  const action: string | undefined = body.action;
  const supabase = getSupabase();

  if (action === 'cancel') {
    const { data, error } = await supabase
      .from('campaign_grants')
      .update({ status: 'cancelled' })
      .eq('id', grantId)
      .eq('campaign_id', id)
      .eq('status', 'pending')
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ grant: data });
  }

  if (action === 'send_email') {
    if (!isHttpsUrl(body.gift_url)) {
      return NextResponse.json({ error: 'QUOカードPayのURL（https://〜）を入力してください' }, { status: 400 });
    }
    const giftUrl = body.gift_url.trim();

    const { data: grant, error: grantError } = await supabase
      .from('campaign_grants')
      .select('id, email, status, grant_type, reward_amount, survey_response_id, survey_responses ( school_name ), campaigns ( reward_amount )')
      .eq('id', grantId)
      .eq('campaign_id', id)
      .single();
    if (grantError || !grant) {
      return NextResponse.json({ error: '配布記録が見つかりません' }, { status: 404 });
    }
    if (grant.status !== 'pending' && grant.status !== 'failed') {
      return NextResponse.json({ error: 'この配布記録は送付済みまたは対象外です' }, { status: 409 });
    }

    // 二重クリックや多重リクエストでギフトURLを二度送らないよう、送信権を行単位で確保する
    const { data: claimed } = await supabase
      .from('campaign_grants')
      .update({ error_message: SENDING_MARKER })
      .eq('id', grantId)
      .in('status', ['pending', 'failed'])
      .or(`error_message.is.null,error_message.neq.${SENDING_MARKER}`)
      .select('id');
    if (!claimed?.length) {
      return NextResponse.json({ error: '送信処理中です。しばらくしてから更新してください' }, { status: 409 });
    }

    const surveyResponse = grant.survey_responses as unknown as { school_name: string } | null;
    const campaign = grant.campaigns as unknown as { reward_amount: number } | null;

    let referral: ReferralShareInfo | null = null;
    try {
      referral = await getReferralShareInfo(supabase, grant.email, null, { forEmail: true });
    } catch (e) {
      console.error('[grants] 紹介URL取得エラー:', e);
    }

    const ok = await sendGrantGiftEmail({
      to: grant.email,
      grantType: (grant.grant_type ?? 'review') as GrantType,
      schoolName: surveyResponse?.school_name ?? '',
      rewardAmount: grant.reward_amount ?? campaign?.reward_amount ?? null,
      giftUrl,
      referral,
      surveyResponseId: grant.survey_response_id,
      supabase,
    });

    const { data, error } = await supabase
      .from('campaign_grants')
      .update(
        ok
          ? { status: 'sent', sent_at: new Date().toISOString(), gift_code: giftUrl, error_message: null }
          : { status: 'failed', gift_code: giftUrl, error_message: 'メール送信に失敗しました' }
      )
      .eq('id', grantId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!ok) return NextResponse.json({ error: 'メール送信に失敗しました', grant: data }, { status: 502 });
    return NextResponse.json({ grant: data });
  }

  const { data, error } = await supabase
    .from('campaign_grants')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', grantId)
    .eq('campaign_id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ grant: data });
}
