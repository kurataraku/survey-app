import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin';
import {
  getGrantDisplayCutoffDate,
  isGrantVisibleOnDisplay,
} from '@/lib/campaign/grantDisplayCutoff';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const supabase = getSupabase();

  // 表示対象は、すでに開始済みの最新キャンペーンの開始日（JST）以降の配布記録のみ
  const now = new Date().toISOString();
  const { data: latestCampaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('starts_at')
    .lte('starts_at', now)
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 500 });
  }

  const cutoffDateJst = getGrantDisplayCutoffDate(latestCampaign?.starts_at);
  if (!cutoffDateJst) {
    return NextResponse.json(
      { grants: [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const { data, error } = await supabase
    .from('campaign_grants')
    .select(`
      id,
      campaign_id,
      email,
      status,
      gift_code,
      created_at,
      sent_at,
      survey_responses (
        id,
        school_name
      ),
      campaigns (
        title,
        reward_amount
      )
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const grants = (data ?? []).filter((grant) =>
    isGrantVisibleOnDisplay(grant.created_at, cutoffDateJst)
  );

  return NextResponse.json(
    { grants },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
