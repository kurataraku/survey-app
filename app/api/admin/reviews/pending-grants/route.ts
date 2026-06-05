import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin';

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

  // 最初のキャンペーン開始前の記録はキャンペーン対象外のため表示しない
  const { data: firstCampaign } = await supabase
    .from('campaigns')
    .select('starts_at')
    .order('starts_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  let grantsQuery = supabase
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

  if (firstCampaign?.starts_at) {
    grantsQuery = grantsQuery.gte('created_at', firstCampaign.starts_at);
  }

  const { data, error } = await grantsQuery;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ grants: data });
}
