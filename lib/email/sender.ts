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
  supabase,
}: {
  to: string;
  schoolName: string;
  surveyResponseId: string;
  supabase: SupabaseClient;
}) {
  const subject = '【通信制高校リアルレビュー】口コミが公開されました';
  const html = `
<p>この度は「通信制高校リアルレビュー」に口コミをご投稿いただきありがとうございます。</p>
<p><strong>${schoolName}</strong> への口コミが審査を通過し、サイトに公開されました。</p>
<p>あなたの体験談が、通信制高校を検討している方々の参考になっています。</p>
<br>
<p>引き続きご利用いただけますと幸いです。</p>
<p>─────────────────────</p>
<p>通信制高校リアルレビュー<br><a href="${SITE_URL}/tsushin-kuchikomi">${SITE_URL}/tsushin-kuchikomi</a></p>
  `.trim();

  const ok = await sendEmail(to, subject, html);
  await logEmail(supabase, surveyResponseId, 'approved', to, subject, ok ? 'sent' : 'failed');
}

export async function sendCampaignGrantEmail({
  to,
  schoolName,
  rewardAmount,
  surveyResponseId,
  supabase,
}: {
  to: string;
  schoolName: string;
  rewardAmount: number;
  surveyResponseId: string;
  supabase: SupabaseClient;
}) {
  const subject = `【通信制高校リアルレビュー】口コミ公開 + QUOカードPay ${rewardAmount}円分をお送りします`;
  const html = `
<p>この度は「通信制高校リアルレビュー」に口コミをご投稿いただきありがとうございます。</p>
<p><strong>${schoolName}</strong> への口コミが審査を通過し、サイトに公開されました。</p>
<br>
<p>キャンペーン特典として、<strong>QUOカードPay ${rewardAmount}円分</strong>を別途メールにてお送りします。</p>
<p>※ QUOカードPayのギフトコードは数日以内に別メールでお届けします。</p>
<br>
<p>あなたの体験談が、通信制高校を検討している方々の参考になっています。</p>
<p>─────────────────────</p>
<p>通信制高校リアルレビュー<br><a href="${SITE_URL}/tsushin-kuchikomi">${SITE_URL}/tsushin-kuchikomi</a></p>
  `.trim();

  const ok = await sendEmail(to, subject, html);
  await logEmail(supabase, surveyResponseId, 'campaign_grant', to, subject, ok ? 'sent' : 'failed');
}

export async function sendRejectedEmail({
  to,
  schoolName,
  reason,
  surveyResponseId,
  supabase,
}: {
  to: string;
  schoolName: string;
  reason: string;
  surveyResponseId: string;
  supabase: SupabaseClient;
}) {
  const subject = '【通信制高校リアルレビュー】口コミについてご確認のお願い';
  const html = `
<p>この度は「通信制高校リアルレビュー」に口コミをご投稿いただきありがとうございます。</p>
<p>誠に恐れ入りますが、<strong>${schoolName}</strong> へのご投稿について、以下の理由により今回は掲載を見送らせていただきました。</p>
<br>
<blockquote style="border-left:3px solid #ccc;padding-left:1em;color:#555;">
${reason}
</blockquote>
<br>
<p>上記の点をご修正いただいた上で、再度ご投稿いただけますと幸いです。</p>
<p><a href="${SURVEY_URL}">▶ 再投稿はこちら</a></p>
<br>
<p>ご不明な点がございましたらお気軽にお問い合わせください。</p>
<p>─────────────────────</p>
<p>通信制高校リアルレビュー<br><a href="${SITE_URL}/tsushin-kuchikomi">${SITE_URL}/tsushin-kuchikomi</a></p>
  `.trim();

  const ok = await sendEmail(to, subject, html);
  await logEmail(supabase, surveyResponseId, 'rejected', to, subject, ok ? 'sent' : 'failed');
}
