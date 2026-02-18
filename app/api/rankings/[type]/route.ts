import { NextRequest, NextResponse } from 'next/server';
import { getRankingsByType } from '@/lib/rankings/getRankingsByType';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  const result = await getRankingsByType(type, { page, limit });

  if ('error' in result) {
    if (result.error.includes('進学実績')) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (result.error === '無効なランキングタイプです') {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
