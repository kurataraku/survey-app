import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface ReferralStats {
  referred_total: number;
  referred_approved: number;
  referred_pending: number;
  referred_rejected: number;
  referrer_grants_open: number;
  referrer_grants_sent: number;
  referrer_grants_flagged: number;
}

const emptyStats = (): ReferralStats => ({
  referred_total: 0,
  referred_approved: 0,
  referred_pending: 0,
  referred_rejected: 0,
  referrer_grants_open: 0,
  referrer_grants_sent: 0,
  referrer_grants_flagged: 0,
});

/** 紹介実績のある紹介コード（または q で検索したコード）と集計を返す */
export async function GET(request: NextRequest) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const supabase = getSupabase();
  // PostgREST の or フィルタ構文を壊す文字は除去する
  const q = (new URL(request.url).searchParams.get('q') ?? '')
    .trim()
    .toLowerCase()
    .replace(/[%_,()*\\"]/g, '');

  const [{ data: referred, error: referredError }, { data: grants, error: grantsError }] = await Promise.all([
    supabase
      .from('survey_responses')
      .select('referral_code_id, moderation_status')
      .not('referral_code_id', 'is', null),
    supabase
      .from('campaign_grants')
      .select('referral_code_id, status, flag_reason')
      .eq('grant_type', 'referrer'),
  ]);
  if (referredError || grantsError) {
    return NextResponse.json({ error: (referredError ?? grantsError)!.message }, { status: 500 });
  }

  const stats = new Map<string, ReferralStats>();
  const statsFor = (id: string) => {
    let s = stats.get(id);
    if (!s) {
      s = emptyStats();
      stats.set(id, s);
    }
    return s;
  };

  for (const r of referred ?? []) {
    const s = statsFor(r.referral_code_id as string);
    s.referred_total++;
    if (r.moderation_status === 'approved') s.referred_approved++;
    else if (r.moderation_status === 'rejected') s.referred_rejected++;
    else s.referred_pending++;
  }
  for (const g of grants ?? []) {
    if (!g.referral_code_id) continue;
    const s = statsFor(g.referral_code_id);
    if (g.status === 'sent') s.referrer_grants_sent++;
    else if (g.status === 'pending' || g.status === 'failed') s.referrer_grants_open++;
    if (g.flag_reason && g.status !== 'cancelled') s.referrer_grants_flagged++;
  }

  let codesQuery = supabase
    .from('referral_codes')
    .select('id, code, referrer_email, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (q) {
    codesQuery = codesQuery.or(`code.eq.${q.toUpperCase()},referrer_email.ilike.%${q}%`);
  } else {
    const ids = [...stats.keys()];
    if (ids.length === 0) return NextResponse.json({ referrals: [] }, { headers: { 'Cache-Control': 'no-store' } });
    codesQuery = codesQuery.in('id', ids);
  }

  const { data: codes, error } = await codesQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const referrals = (codes ?? [])
    .map((c) => ({ ...c, ...(stats.get(c.id) ?? emptyStats()) }))
    .sort((a, b) => b.referred_total - a.referred_total);

  return NextResponse.json({ referrals }, { headers: { 'Cache-Control': 'no-store' } });
}
