import { SupabaseClient } from '@supabase/supabase-js';

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM = process.env.EMAIL_FROM ?? 'noreply@careeressence.co.jp';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://careeressence.jp';
const SURVEY_URL = `${SITE_URL}/tsushin-kuchikomi/survey`;

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) {
    console.warn('[email] EMAIL_API_KEY が未設定のためメール送信をスキップ');
    return false;
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error('[email] Resend error:', res.status, body);
  }
  return res.ok;
}

async function logEmail(
  supabase: SupabaseClient,
  surveyResponseId: string,
  emailType: string,
  toEmail: string,
  subject: string,
  status: 'sent' | 'failed'
) {
  await supabase.from('email_logs').insert({
    survey_response_id: surveyResponseId,
    email_type: emailType,
    to_email: toEmail,
    subject,
    status,
  });
}

export async function sendApprovedEmail({
  to,
  schoolName,
  surveyResponseId,
  giftUrl,
  supabase,
}: {
  to: string;
  schoolName: string;
  surveyResponseId: string;
  giftUrl?: string;
  supabase: SupabaseClient;
}) {
  const subject = '【通信制高校リアルレビュー】口コミのご投稿、誠にありがとうございます';
  const quoSection = giftUrl
    ? `
<br>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:24px 0;">
  <tr><td style="background:#fef9ec;padding:16px 20px;">
    <p style="margin:0 0 8px;font-weight:bold;color:#92400e;">🎁 キャンペーン特典のご案内</p>
    <p style="margin:0 0 12px;color:#78350f;font-size:14px;">
      今回のご投稿に対する感謝の気持ちとして、<strong>QUOカードPay</strong> をお贈りいたします。<br>
      下記のURLよりお受け取りください。
    </p>
    <p style="margin:0;">
      <a href="${giftUrl}" style="display:inline-block;background:#d97706;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">QUOカードPayを受け取る</a>
    </p>
    <p style="margin:8px 0 0;font-size:12px;color:#92400e;">※ URLの有効期限にご注意ください。</p>
  </td></tr>
</table>`
    : '';
  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#374151;line-height:1.7;">
  <p>この度は「通信制高校リアルレビュー」に口コミをご投稿いただき、誠にありがとうございます。</p>

  <p>
    いただいたご投稿を拝見し、内容を確認させていただきました。<br>
    <strong>${schoolName}</strong> への口コミとして、サイトへの掲載が決定いたしましたのでお知らせします。
  </p>

  <p>
    通信制高校への進学を検討している方にとって、在校生・卒業生のリアルな体験談は非常に貴重な情報です。<br>
    あなたの声が、進路選択に迷っている多くの方の力になります。改めて、心より感謝申し上げます。
  </p>
  ${quoSection}
  <br>
  <p style="font-size:14px;color:#6b7280;">
    ご不明な点がございましたら、下記のお問い合わせページよりご連絡ください。<br>
    <a href="${SITE_URL}/tsushin-kuchikomi/contact" style="color:#3b82f6;">${SITE_URL}/tsushin-kuchikomi/contact</a><br><br>
    今後とも「通信制高校リアルレビュー」をよろしくお願いいたします。
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="font-size:13px;color:#9ca3af;margin:0;">
    通信制高校リアルレビュー<br>
    <a href="${SITE_URL}/tsushin-kuchikomi" style="color:#3b82f6;">${SITE_URL}/tsushin-kuchikomi</a>
  </p>
</div>
  `.trim();

  const ok = await sendEmail(to, subject, html);
  await logEmail(supabase, surveyResponseId, 'approved', to, subject, ok ? 'sent' : 'failed');
}

export async function sendRejectedEmail({
  to,
  schoolName,
  reason,
  hasCampaign,
  surveyResponseId,
  supabase,
}: {
  to: string;
  schoolName: string;
  reason: string;
  hasCampaign?: boolean;
  surveyResponseId: string;
  supabase: SupabaseClient;
}) {
  const subject = '【通信制高校リアルレビュー】ご投稿内容についてのご連絡';
  const quoSection = hasCampaign
    ? `
  <p style="color:#374151;">
    なお、誠に恐れ入りますが、今回は掲載を見送らせていただいたため、<strong>QUOカードPayの特典対象外</strong>となります。あらかじめご了承くださいますようお願いいたします。
  </p>`
    : '';
  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#374151;line-height:1.7;">
  <p>この度は「通信制高校リアルレビュー」に口コミをご投稿いただき、誠にありがとうございます。</p>

  <p>
    いただいた <strong>${schoolName}</strong> へのご投稿について、内容を確認させていただきましたところ、
    誠に恐れ入りますが、以下の理由により今回は掲載を見送らせていただくこととなりました。
  </p>

  <div style="background:#f9fafb;border-left:4px solid #d1d5db;border-radius:4px;padding:14px 18px;margin:20px 0;color:#4b5563;font-size:14px;">
    ${reason}
  </div>
  ${quoSection}
  <p>
    ご投稿いただいたお気持ちに応えられず大変申し訳ございません。<br>
    上記の点をご確認いただいた上で、改めてご投稿いただけますと幸いです。
  </p>

  <p>
    <a href="${SURVEY_URL}" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">再投稿はこちら</a>
  </p>

  <br>
  <p style="font-size:14px;color:#6b7280;">
    ご不明な点がございましたら、下記のお問い合わせページよりご連絡ください。<br>
    <a href="${SITE_URL}/tsushin-kuchikomi/contact" style="color:#3b82f6;">${SITE_URL}/tsushin-kuchikomi/contact</a><br><br>
    今後とも「通信制高校リアルレビュー」をよろしくお願いいたします。
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="font-size:13px;color:#9ca3af;margin:0;">
    通信制高校リアルレビュー<br>
    <a href="${SITE_URL}/tsushin-kuchikomi" style="color:#3b82f6;">${SITE_URL}/tsushin-kuchikomi</a>
  </p>
</div>
  `.trim();

  const ok = await sendEmail(to, subject, html);
  await logEmail(supabase, surveyResponseId, 'rejected', to, subject, ok ? 'sent' : 'failed');
}
