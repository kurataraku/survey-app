import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { BASE_PATH } from '@/lib/base-path';
import { MY_STORY_AWARD_APPLY_PATH } from '@/lib/contest/copy';
import { getSiteUrl } from '@/lib/env-check';
import { sendContestDraftResumeEmail } from '@/lib/email/sender';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function newToken() {
  return randomBytes(32).toString('base64url');
}

function resumeUrl(token: string) {
  return `${getSiteUrl()}${BASE_PATH}${MY_STORY_AWARD_APPLY_PATH}?draft=${encodeURIComponent(token)}`;
}

const payloadSchema = z.record(z.string(), z.unknown()).default({});

const draftPatchSchema = z.object({
  token: z.string().min(16),
  email: z.string().email().optional().or(z.literal('')),
  payload: payloadSchema.optional(),
});

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const body = await request.json().catch(() => ({}));
  const parsed = z.object({
    email: z.string().email().optional().or(z.literal('')),
    payload: payloadSchema.optional(),
  }).safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: '下書きの作成に失敗しました', details: parsed.error.issues }, { status: 400 });
  }

  const token = newToken();
  const { data, error } = await supabase
    .from('contest_drafts')
    .insert({
      token,
      email: parsed.data.email || null,
      payload: parsed.data.payload ?? {},
    })
    .select('token, email, payload, updated_at, expires_at, submitted_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data });
}

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return NextResponse.json({ error: '下書きリンクが見つかりません' }, { status: 400 });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('contest_drafts')
    .select('token, email, payload, updated_at, expires_at, submitted_at')
    .eq('token', token)
    .single();

  if (error || !data) return NextResponse.json({ error: '下書きが見つかりません' }, { status: 404 });
  if (data.submitted_at) return NextResponse.json({ error: 'この応募は送信済みです' }, { status: 410 });
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: '下書きの期限が切れています' }, { status: 410 });
  }

  return NextResponse.json({ draft: data });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const action = typeof body?.action === 'string' ? body.action : 'save';
  const parsed = draftPatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: '下書きの保存に失敗しました', details: parsed.error.issues }, { status: 400 });
  }

  const supabase = getSupabase();
  const { token, email, payload } = parsed.data;

  const { data: current, error: currentError } = await supabase
    .from('contest_drafts')
    .select('token, email, expires_at, submitted_at')
    .eq('token', token)
    .single();

  if (currentError || !current) return NextResponse.json({ error: '下書きが見つかりません' }, { status: 404 });
  if (current.submitted_at) return NextResponse.json({ error: 'この応募は送信済みです' }, { status: 410 });
  if (new Date(current.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: '下書きの期限が切れています' }, { status: 410 });
  }

  if (action === 'send_resume_email') {
    const to = email || current.email;
    if (!to) return NextResponse.json({ error: 'メールアドレスを入力してください' }, { status: 400 });
    if (payload || email) {
      await supabase
        .from('contest_drafts')
        .update({
          ...(email !== undefined ? { email: email || null } : {}),
          ...(payload ? { payload } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('token', token);
    }
    const ok = await sendContestDraftResumeEmail({ to, resumeUrl: resumeUrl(token), supabase });
    return NextResponse.json({ success: ok, resume_url: resumeUrl(token) });
  }

  const { data, error } = await supabase
    .from('contest_drafts')
    .update({
      ...(email !== undefined ? { email: email || null } : {}),
      ...(payload ? { payload } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('token', token)
    .select('token, email, payload, updated_at, expires_at, submitted_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data });
}
