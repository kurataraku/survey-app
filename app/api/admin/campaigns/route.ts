import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('campaigns')
    .select(`
      *,
      campaign_grants(count)
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      title: body.title,
      description: body.description ?? null,
      reward_amount: body.reward_amount,
      starts_at: body.starts_at,
      ends_at: body.ends_at,
      is_active: body.is_active ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data }, { status: 201 });
}
