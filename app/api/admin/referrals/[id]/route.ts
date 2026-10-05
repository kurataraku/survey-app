import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** 紹介コードの有効・無効を切り替える（無効化後はそのURL経由の回答を紐づけない） */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.is_active !== 'boolean') {
    return NextResponse.json({ error: 'is_active を指定してください' }, { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from('referral_codes')
    .update({ is_active: body.is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ referral: data });
}
