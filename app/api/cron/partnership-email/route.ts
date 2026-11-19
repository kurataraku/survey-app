import { NextRequest, NextResponse } from 'next/server';
import { reconcileEmailDeliveries } from '@/lib/partnerships/delivery';
import { requireCronSecret } from '@/lib/seo-loop/config';
import { createAdminSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

// 15分ごとに、まだ配信結果が確定していない送信を Resend に問い合わせて反映する。
// 不達が見つかれば Slack に流す（lib/partnerships/delivery.ts）。
export async function POST(request: NextRequest) {
  if (!requireCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await reconcileEmailDeliveries(createAdminSupabaseClient());
  return NextResponse.json(result, { status: result.error ? 503 : 200 });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
