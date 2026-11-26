import { NextRequest, NextResponse } from 'next/server';
import { portalGet, portalPost } from '@/lib/partnerships/portal';
import { isSameOrigin, json, requireSchoolMember } from '@/lib/partnerships/server';

// 学校担当者の管理画面。処理の中身は lib/partnerships/portal.ts（運営の代理表示と共通）。

export async function GET(request: NextRequest) {
  const auth = await requireSchoolMember();
  if (auth instanceof NextResponse) return auth;
  return portalGet(auth.db, auth.member.schoolId, request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return json({ error: '送信元を確認できません。' }, 403);
  const auth = await requireSchoolMember();
  if (auth instanceof NextResponse) return auth;
  return portalPost(request, auth.db, auth.member.schoolId, { scope: 'school', userId: auth.member.userId });
}
