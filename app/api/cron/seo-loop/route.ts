import { NextRequest, NextResponse } from 'next/server';
import { requireCronSecret } from '@/lib/seo-loop/config';
import { runSeoLoopTick } from '@/lib/seo-loop/orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!requireCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runSeoLoopTick();
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  return POST(request);
}
