import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { deliveryLabels, type DeliveryStatus } from './model';

type Db = ReturnType<typeof createAdminSupabaseClient>;
export type DeliveryKind = 'school_notification' | 'school_invitation' | 'applicant_receipt';
export type { DeliveryStatus };

// 結果の強さ。弱い状態から強い状態へしか進めない。
// Resend のイベントは順不同で届くため（delivered のあとに bounced が来ることがある）、
// 時刻ではなくこの順位で判定する。cron でも Webhook でも同じ規則になる。
const rank: Record<DeliveryStatus, number> = {
  queued: 0, delayed: 1, delivered: 2, canceled: 3, unknown: 4, bounced: 5, complained: 6,
};
// 不達として扱い、運営に知らせるもの
const alertable: DeliveryStatus[] = ['bounced', 'complained', 'unknown'];

function mapResendEvent(event: string | null | undefined): DeliveryStatus {
  switch (event) {
    case 'delivered': return 'delivered';
    case 'bounced': case 'failed': return 'bounced';
    case 'complained': return 'complained';
    case 'delivery_delayed': return 'delayed';
    case 'canceled': return 'canceled';
    default: return 'queued';
  }
}

export async function recordEmailSend(db: Db, entry: {
  messageId: string | null; kind: DeliveryKind; refId: string; schoolId: string | null; recipient: string;
}) {
  // メッセージIDが取れなかった送信は追跡できない。結果不明として残し、運営に知らせる。
  await db.from('email_deliveries').upsert({
    provider: 'resend',
    provider_message_id: entry.messageId ?? `unknown:${entry.kind}:${entry.refId}:${Date.now()}`,
    kind: entry.kind, ref_id: entry.refId, school_id: entry.schoolId, recipient: entry.recipient,
    status: entry.messageId ? 'queued' : 'unknown',
    detail: entry.messageId ? null : 'ResendがメッセージIDを返さなかったため、配信結果を確認できません。',
  }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true });
}

/** 配信結果を1件反映する。cron の照合からも、将来の Webhook からもここを通す。 */
export async function applyDeliveryEvent(db: Db, event: {
  messageId: string; status: DeliveryStatus; detail?: string | null; eventAt?: string | null;
}) {
  const { data: row } = await db.from('email_deliveries').select('id, status')
    .eq('provider_message_id', event.messageId).maybeSingle();
  if (!row) return false;
  const checkedAt = new Date().toISOString();
  // 弱い結果での上書きを防ぐ（照合と Webhook が前後しても壊れない）
  if (rank[event.status] <= rank[row.status as DeliveryStatus]) {
    await db.from('email_deliveries').update({ checked_at: checkedAt }).eq('id', row.id);
    return false;
  }
  const { error } = await db.from('email_deliveries').update({
    status: event.status, detail: event.detail ?? null,
    event_at: event.eventAt ?? checkedAt, checked_at: checkedAt,
  }).eq('id', row.id).eq('status', row.status);
  return !error;
}

async function fetchResendStatus(messageId: string) {
  const key = process.env.EMAIL_API_KEY;
  if (!key) return null;
  const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(messageId)}`, {
    headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!response) return null;
  // 送信直後はまだ参照できないことがある。見つからない＝不達ではないので据え置く。
  if (!response.ok) return null;
  const body = await response.json().catch(() => null) as { last_event?: string } | null;
  return body ? mapResendEvent(body.last_event) : null;
}

async function postSlack(text: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_PARTNERSHIP_CHANNEL_ID || process.env.SLACK_SEO_CHANNEL_ID;
  if (!token || !channel) return false;
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ channel, text }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  const body = await response?.json().catch(() => null) as { ok?: boolean } | null;
  return Boolean(body?.ok);
}

/** 未通知の不達をSlackへ流す。Slackが未設定・失敗なら alerted_at を立てず、次回また試す。 */
async function alertUndelivered(db: Db) {
  const { data: rows } = await db.from('email_deliveries')
    .select('id, kind, status, recipient, detail, created_at, school_id, schools(name)')
    .in('status', alertable).is('alerted_at', null).order('created_at').limit(20);
  let alerted = 0;
  for (const row of rows ?? []) {
    const school = Array.isArray(row.schools) ? row.schools[0]?.name : (row.schools as { name?: string } | null)?.name;
    const kind = row.kind === 'school_invitation' ? '学校担当者の招待メール'
      : row.kind === 'applicant_receipt' ? '資料請求の受付確認メール（応募者宛）' : '資料請求の新着通知';
    const next = row.kind === 'school_invitation'
      ? 'アドレスの誤りがないか学校に確認し、正しいアドレスで招待し直してください。'
      : row.kind === 'applicant_receipt'
        ? '入力ミスのほか、いたずらや他人のアドレスの入力の可能性があります。学校へ公開する前に、運営画面で請求の内容（宛名・住所・メールアドレス）を確認してください。'
        : '学校に連絡が届いていません。担当者のアドレスを確認し、運営画面の通知欄から再送してください。';
    const sent = await postSlack([
      `:warning: メールが届いていません（${deliveryLabels[row.status as DeliveryStatus]}）`,
      `対象: ${kind}`,
      `学校: ${school ?? '不明'}`,
      `宛先: ${row.recipient}`,
      `送信日時: ${new Date(row.created_at).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
      row.detail ? `詳細: ${row.detail}` : '',
      `対応: ${next}`,
    ].filter(Boolean).join('\n'));
    if (!sent) break;
    await db.from('email_deliveries').update({ alerted_at: new Date().toISOString() }).eq('id', row.id);
    alerted += 1;
  }
  return alerted;
}

/**
 * 結果が確定していない送信を Resend に問い合わせて反映する。
 * 送信から windowHours を過ぎても確定しないものは「結果不明」として打ち切り、通知対象にする。
 */
export async function reconcileEmailDeliveries(db: Db, options: { windowHours?: number; limit?: number } = {}) {
  const windowHours = options.windowHours ?? 48;
  const cutoff = new Date(Date.now() - windowHours * 3600_000).toISOString();
  const { data: rows, error } = await db.from('email_deliveries')
    .select('id, provider_message_id, status, created_at')
    .in('status', ['queued', 'delayed']).order('created_at').limit(options.limit ?? 50);
  if (error) return { checked: 0, updated: 0, givenUp: 0, alerted: 0, error: error.message };

  let updated = 0;
  let givenUp = 0;
  for (const row of rows ?? []) {
    if (row.created_at < cutoff) {
      const { error: giveUpError } = await db.from('email_deliveries').update({
        status: 'unknown', checked_at: new Date().toISOString(),
        detail: `送信から${windowHours}時間、配信結果を確認できませんでした。`,
      }).eq('id', row.id).eq('status', row.status);
      if (!giveUpError) givenUp += 1;
      continue;
    }
    const status = await fetchResendStatus(row.provider_message_id);
    if (status && await applyDeliveryEvent(db, { messageId: row.provider_message_id, status })) updated += 1;
  }
  return { checked: rows?.length ?? 0, updated, givenUp, alerted: await alertUndelivered(db) };
}
