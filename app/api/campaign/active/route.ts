import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await supabase
    .from('campaigns')
    .select('id, title, description, reward_amount, ends_at')
    .eq('is_active', true)
    .lte('starts_at', new Date().toISOString())
    .gte('ends_at', new Date().toISOString())
    .limit(1)
    .single();

  return NextResponse.json({ campaign: data ?? null });
}
