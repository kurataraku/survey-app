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

const mediaName = '通信制高校リアルレビュー';
const contactEmail = process.env.PARTNERSHIP_CONTACT_EMAIL || 'info@careeressence.co.jp';

const signature = [
  '――――――――――――',
  mediaName,
  '運営：株式会社キャリアエッセンス',
  `お問い合わせ：${contactEmail}`,
  '※ 本メールは送信専用です。ご返信いただいても届きません。',
].join('\n');

const loginGuide = [
  '【ログイン方法】',
  'ご登録のメールアドレスを入力すると、認証コードが届きます。そのコードと、認証アプリの6桁の数字でログインできます。',
].join('\n');

const formatDeadline = (value?: string | null) => value
  ? `${new Date(value).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' })}まで`
  : null;

export function buildInvitationMail(schoolName: string, portalUrl: string) {
  return {
    subject: `【${mediaName}】学校向け管理画面のご案内（${schoolName}）`,
    message: [
      `${mediaName}（運営：株式会社キャリアエッセンス）です。`,
      `${schoolName}の学校担当者として、このメールアドレスを登録しました。`,
      '',
      '学校向け管理画面では、貴校あての資料請求の確認と、学校紹介の写真・メッセージの掲載ができます。',
      '',
      '▼ 学校向け管理画面',
      portalUrl,
      '',
      '上のページでこのメールアドレスを入力すると、認証コードが届きます。初回は、認証アプリの設定もご案内します。',
      '',
      '心当たりがない場合は、このメールを破棄してください。',
      '',
      signature,
    ].join('\n'),
  };
}

export function buildRequestSharedMail(input: { schoolName: string; requestId: string; accessUntil?: string | null; portalUrl: string }) {
  const deadline = formatDeadline(input.accessUntil);
  return {
    subject: `【${mediaName}】資料請求が届きました（${input.schoolName}）`,
    message: [
      input.schoolName,
      'ご担当者さま',
      '',
      `${mediaName}（運営：株式会社キャリアエッセンス）です。`,
      '貴校あてに、新しい資料請求が届きました。',
      '',
      `■ 受付番号：${input.requestId.slice(0, 8)}`,
      ...(deadline ? [`■ 閲覧できる期限：${deadline}`] : []),
      '',
      '【ご対応のお願い】',
      '1. 下記の学校向け管理画面にログインしてください。',
      '2. 「届いた資料請求」で、受付番号の「詳細を見る」から宛名・住所などをご確認ください。',
      '3. 資料を郵送いただいたら、「発送済みにする」を押してください。',
      '',
      '▼ 学校向け管理画面',
      input.portalUrl,
      '',
      loginGuide,
      '',
      '※ 宛名・住所などの個人情報は、安全のためメールには記載していません。',
      '',
      signature,
    ].join('\n'),
  };
}

export function buildContentStoppedMail(input: { schoolName: string; contentKind: string; reason: string; portalUrl: string }) {
  return {
    subject: `【${mediaName}】掲載を停止しました（${input.schoolName}）`,
    message: [
      input.schoolName,
      'ご担当者さま',
      '',
      `${mediaName}（運営：株式会社キャリアエッセンス）です。`,
      '貴校から提供いただいた情報の掲載を、いったん停止しました。',
      '',
      `■ 対象：${input.contentKind === 'photo' ? '学校提供の写真' : '学校からのメッセージ'}`,
      `■ 理由・修正のお願い：${input.reason}`,
      '',
      '【ご対応のお願い】',
      '学校向け管理画面で内容を修正のうえ、再度ご提出ください。運営が確認したあと、公開します。',
      '',
      '▼ 学校向け管理画面',
      input.portalUrl,
      '',
      signature,
    ].join('\n'),
  };
}

export function buildApplicantReceiptMail(input: { schoolName: string; requestId: string; receivedAt: Date }) {
  const received = input.receivedAt.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return {
    subject: `【${mediaName}】資料請求を受け付けました（${input.schoolName}）`,
    message: [
      '資料請求のお申し込みありがとうございます。',
      `${mediaName}（運営：株式会社キャリアエッセンス）です。`,
      '以下の内容で受け付けました。',
      '',
      `■ 請求先の学校：${input.schoolName}`,
      `■ 受付番号：${input.requestId.slice(0, 8)}`,
      `■ 受付日時：${received}`,
      '',
      '【今後の流れ】',
      '1. 運営が請求の内容を確認します。',
      '2. 確認後、学校へ宛名・住所などを共有します。',
      '3. 学校から、ご記入の住所へ資料が郵送されます。',
      '※ 発送の時期は学校により異なります。',
      '',
      '【ご確認ください】',
      `・内容の訂正や取り消しをご希望の場合は、受付番号を添えて ${contactEmail} へご連絡ください。`,
      '・このメールに心当たりがない場合は、破棄してください。',
      '',
      signature,
    ].join('\n'),
  };
}

/** 応募者への受付確認。失敗しても請求の受付には影響させない（呼び出し側で結果を握りつぶす）。 */
export async function sendApplicantReceipt(db: Db, input: { requestId: string; email: string; schoolId: string; schoolName: string }) {
  const mail = buildApplicantReceiptMail({ schoolName: input.schoolName, requestId: input.requestId, receivedAt: new Date() });
  const result = await send(input.email, mail.subject, mail.message, `applicant-receipt-${input.requestId}`);
  if (result.ok) await recordEmailSend(db, { messageId: result.messageId, kind: 'applicant_receipt', refId: input.requestId, schoolId: input.schoolId, recipient: input.email });
  return result.ok;
}

export async function sendSchoolInvitation(db: Db, email: string, schoolName: string, schoolId: string, memberId: string) {
  const mail = buildInvitationMail(schoolName, `${getAppBaseUrl()}/school-portal`);
  const result = await send(email, mail.subject, mail.message, `school-invite-${memberId}`);
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
  const school = await db.from('schools').select('name').eq('id', rows[0].school_id).single();
  if (school.error || !school.data?.name) return false;
  const portalUrl = `${getAppBaseUrl()}/school-portal`;
  const { subject, message } = kind === 'request_shared'
    ? buildRequestSharedMail({ schoolName: school.data.name, requestId: eventId, accessUntil: material?.data?.access_until, portalUrl })
    : buildContentStoppedMail({ schoolName: school.data.name, contentKind: content?.data?.kind ?? '', reason: content?.data?.stop_reason ?? '', portalUrl });

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
