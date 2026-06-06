import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin';
import { CAMPAIGN_ADMIN_VISIBLE_FROM_UTC } from '@/lib/campaign/grantDisplayCutoff';

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
    .gte('created_at', CAMPAIGN_ADMIN_VISIBLE_FROM_UTC)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { grants: data ?? [] },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
