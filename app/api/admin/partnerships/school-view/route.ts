import { NextRequest, NextResponse } from 'next/server';
import { uuid } from '@/lib/partnerships/model';
import { portalGet, portalPost } from '@/lib/partnerships/portal';
import { isSameOrigin, json, requirePartnershipOperator } from '@/lib/partnerships/server';

// 運営が学校の管理画面を代わりに表示する（?school=<学校ID>）。
// 学校と同じ画面を見られ、写真・メッセージ・公式サイトのリンクは代理で登録できる。
// 資料請求の「確認済み」「発送済み」は学校だけの操作なので、ここからは記録できない（portal.ts で拒否）。

function schoolIdFrom(request: NextRequest) {
  const parsed = uuid.safeParse(request.nextUrl.searchParams.get('school'));
  return parsed.success ? parsed.data : null;
}

export async function GET(request: NextRequest) {
  const auth = await requirePartnershipOperator(request);
  if (auth instanceof NextResponse) return auth;
  const schoolId = schoolIdFrom(request);
  if (!schoolId) return json({ error: '学校を選び直してください。' }, 400);
  return portalGet(auth.db, schoolId, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: '送信元を確認できません。' }, 403);
  const auth = await requirePartnershipOperator(request);
  if (auth instanceof NextResponse) return auth;
  const schoolId = schoolIdFrom(request);
  if (!schoolId) return json({ error: '学校を選び直してください。' }, 400);
  return portalPost(request, auth.db, schoolId, { scope: 'operator', userId: auth.actorId });
}
