import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { recordUnsubscribe, verifyUnsubscribeToken } from '@/lib/referral/unsubscribe';

/**
 * 紹介の案内メールの配信停止。
 * 配信停止ページからは JSON の { e, t }、メールソフトのワンクリック停止（RFC 8058）からは
 * クエリ文字列の e, t で POST される。GET では停止しない（リンクの自動プリフェッチ対策）。
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let e: unknown = searchParams.get('e');
  let t: unknown = searchParams.get('t');

  if (!e || !t) {
    const body = await request.json().catch(() => ({}));
    e = body?.e;
    t = body?.t;
  }

  const email = verifyUnsubscribeToken(e, t);
  if (!email) {
    return NextResponse.json({ error: '配信停止リンクが正しくありません' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const ok = await recordUnsubscribe(supabase, email);
  if (!ok) {
    return NextResponse.json({ error: '配信停止の処理に失敗しました' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
