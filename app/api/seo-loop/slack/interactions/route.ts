import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { handleSlackInteraction, verifySlackSignature } from '@/lib/seo-loop/slack';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json({ error: 'SLACK_SIGNING_SECRET is not configured' }, { status: 500 });
  }

  const rawBody = await request.text();
  const valid = verifySlackSignature({
    signingSecret,
    timestamp: request.headers.get('x-slack-request-timestamp'),
    signature: request.headers.get('x-slack-signature'),
    rawBody,
  });

  if (!valid) {
    return NextResponse.json({ error: 'Invalid Slack signature' }, { status: 401 });
  }

  const result = await handleSlackInteraction({
    supabase: createAdminSupabaseClient(),
    rawBody,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
