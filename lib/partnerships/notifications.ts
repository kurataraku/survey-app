import { getAppBaseUrl } from '@/lib/env-check';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { recordEmailSend } from './delivery';

type Db = ReturnType<typeof createAdminSupabaseClient>;

// Resendは受け付けた時点で200を返すので、ok は「受け付けられた」であって「届いた」ではない。
// 届いたかどうかはメッセージIDを控えておき、email_deliveries で後から照合する（lib/partnerships/delivery.ts）。
async function send(to: string, subject: string, message: string, idempotencyKey: string) {
  const key = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from || !process.env.NEXT_PUBLIC_SITE_URL || (process.env.EMAIL_SERVICE && process.env.EMAIL_SERVICE !== 'resend')) return { ok: false, messageId: null };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ from, to: [to], subject, text: message }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!response?.ok) return { ok: false, messageId: null };
  const body = await response.json().catch(() => null) as { id?: string } | null;
  return { ok: true, messageId: body?.id ?? null };
}

export async function sendSchoolInvitation(db: Db, email: string, schoolName: string, schoolId: string, memberId: string) {
  const result = await send(email, '通信制高校リアルレビュー 学校担当者のご案内',
    `${schoolName}の学校担当者として登録しました。以下の画面でこのメールアドレスを入力し、届く認証コードでログインしてください。\n${getAppBaseUrl()}/school-portal`,
    `school-invite-${memberId}`);
  if (result.ok) await recordEmailSend(db, { messageId: result.messageId, kind: 'school_invitation', refId: memberId, schoolId, recipient: email });
  return result.ok;
}

export async function sendQueuedSchoolNotifications(db: Db, kind: 'request_shared' | 'content_stopped', eventId: string) {
  const { data: rows, error } = await db.from('school_partner_notifications').select('id, member_id, school_id, status, attempted_at')
    .eq('event_kind', kind).eq('event_id', eventId).in('status', ['pending', 'failed', 'sending']);
  if (error) return false;
  if (!rows?.length) return true;

  const content = kind === 'content_stopped'
    ? await db.from('school_partner_content').select('kind, stop_reason').eq('id', eventId).single() : null;
  const material = kind === 'request_shared'
    ? await db.from('school_material_requests').select('status, access_until').eq('id', eventId).single() : null;
  if (content?.error || material?.error) return false;
  const subject = kind === 'request_shared' ? '新しい資料請求が届きました' : '学校提供情報の掲載停止のお知らせ';
  const reason = content?.data
    ? `対象：${content.data.kind === 'photo' ? '学校提供の写真' : '学校からのメッセージ'}\n理由・修正のお願い：${content.data.stop_reason}\n\n`
    : '学校向け画面で新しい資料請求をご確認ください。\n\n';
  const message = `${reason}${getAppBaseUrl()}/school-portal`;

  const results = await Promise.allSettled(rows.map(async (row) => {
    if (row.status === 'sending' && row.attempted_at && Date.now() - Date.parse(row.attempted_at) < 120_000) return false;
    const claimedAt = new Date().toISOString();
    let claim = db.from('school_partner_notifications').update({ status: 'sending', attempted_at: claimedAt }).eq('id', row.id).eq('status', row.status);
    if (row.attempted_at) claim = claim.eq('attempted_at', row.attempted_at);
    const { data: claimed } = await claim.select('id').maybeSingle();
    if (!claimed) return false;

    const { data: member, error: memberError } = await db.from('school_partner_members').select('email').eq('user_id', row.member_id)
      .eq('school_id', row.school_id).eq('active', true).maybeSingle();
    const inactiveRequest = material?.data && (material.data.status === 'cancelled' || Date.parse(material.data.access_until) <= Date.now());
    let status: 'failed' | 'skipped' | 'sent' = 'failed';
    if (!memberError) {
      if (!member || inactiveRequest) status = 'skipped';
      else {
        const result = await send(member.email, subject, message, `school-notice-${row.id}`);
        status = result.ok ? 'sent' : 'failed';
        if (result.ok) await recordEmailSend(db, { messageId: result.messageId, kind: 'school_notification', refId: row.id, schoolId: row.school_id, recipient: member.email });
      }
    }
    const { error: saveError } = await db.from('school_partner_notifications').update({ status, sent_at: status === 'sent' ? new Date().toISOString() : null })
      .eq('id', row.id).eq('attempted_at', claimedAt);
    return !saveError && status !== 'failed';
  }));
  return results.every((result) => result.status === 'fulfilled' && result.value);
}
