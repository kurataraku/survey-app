import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = await params;
  const baseUrl = process.env.AGENT_BASE_URL ?? 'http://localhost:3000';

  const res = await fetch(`${baseUrl}/api/admin/reviews/${id}/moderate`, {
    method: 'POST',
    headers: { 'x-api-key': process.env.AGENT_API_KEY ?? '' },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  return NextResponse.json(await res.json());
}
