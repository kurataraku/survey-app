import { SupabaseClient } from '@supabase/supabase-js';
import {
  buildLineShareUrl,
  buildReferralMessage,
  describeReferralReward,
  type ReferralShareInfo,
} from '@/lib/referral/shared';

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM = process.env.EMAIL_FROM ?? 'noreply@careeressence.co.jp';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://careeressence.jp';
const SURVEY_URL = `${SITE_URL}/tsushin-kuchikomi/survey`;

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  headers?: Record<string, string>
): Promise<boolean> {
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
    body: JSON.stringify({ from: FROM, to, subject, html, ...(headers ? { headers } : {}) }),
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

function quoGiftSection(giftUrl: string, title: string, message?: string): string {
  return `
<br>
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:24px 0;">
  <tr><td style="background:#fef9ec;padding:16px 20px;">
    <p style="margin:0 0 8px;font-weight:bold;color:#92400e;">🎁 ${title}</p>
    <p style="margin:0 0 12px;color:#78350f;font-size:14px;">
      ${message ? `${message}<br>` : ''}
      下記のURLよりお受け取りください。
    </p>
    <p style="margin:0;">
      <a href="${giftUrl}" style="display:inline-block;background:#d97706;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">QUOカードPayを受け取る</a>
    </p>
    <p style="margin:8px 0 0;font-size:12px;color:#92400e;">※ URLの有効期限にご注意ください。</p>
  </td></tr>
</table>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function referralRequestSection(referral: ReferralShareInfo): string {
  const message = buildReferralMessage(referral);
  const messageHtml = escapeHtml(message).replace(/\n/g, '<br>');
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #bfdbfe;border-radius:8px;overflow:hidden;margin:24px 0;">
  <tr><td style="background:#eff6ff;padding:16px 20px;">
    <p style="margin:0 0 8px;font-weight:bold;color:#1e3a8a;">お知り合いへのご紹介のお願い</p>
    <p style="margin:0 0 12px;color:#1e40af;font-size:14px;">
      通信制高校に通っている・通っていた方や、その保護者の方がお知り合いにいらっしゃいましたら、口コミ投稿へのご協力をお願いできないでしょうか。<br>
      ご紹介した方の口コミが掲載されると、<strong>${describeReferralReward(referral)}</strong>をお贈りします。
    </p>
    <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#1e3a8a;">
      ▼ 下の文面をコピーして、LINEやメールでそのまま送ってください（あなた専用のURL入り）
    </p>
    <div style="background:#ffffff;border:1px dashed #93c5fd;border-radius:6px;padding:12px 14px;margin:0 0 12px;font-size:14px;color:#1f2937;word-break:break-all;">
      ${messageHtml}
    </div>
    <p style="margin:0 0 12px;">
      <a href="${buildLineShareUrl(message)}" style="display:inline-block;background:#06C755;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">LINEでこの文面を送る</a>
    </p>
    <p style="margin:0 0 4px;font-size:13px;color:#1e3a8a;">あなた専用の紹介URL（URLだけ送る場合）</p>
    <p style="margin:0 0 12px;font-size:14px;word-break:break-all;">
      <a href="${referral.url}" style="color:#2563eb;">${referral.url}</a>
    </p>
    <p style="margin:0;font-size:12px;color:#3b82f6;">
      ※ 特典は、ご紹介した方の口コミが掲載基準を満たし、承認された場合に限ります。<br>
      ※ ご本人による別アドレスでの投稿は対象外です。
    </p>
  </td></tr>
</table>`;
}

export async function sendApprovedEmail({
  to,
  schoolName,
  surveyResponseId,
  giftUrl,
  referral,
  supabase,
}: {
  to: string;
  schoolName: string;
  surveyResponseId: string;
  giftUrl?: string;
  referral?: ReferralShareInfo | null;
  supabase: SupabaseClient;
}) {
  const subject = '【通信制高校リアルレビュー】口コミのご投稿、誠にありがとうございます';
  const quoSection = giftUrl
    ? quoGiftSection(
        giftUrl,
        'キャンペーン特典のご案内',
        '今回のご投稿に対する感謝の気持ちとして、<strong>QUOカードPay</strong> をお贈りいたします。'
      )
    : '';
  const referralSection = referral ? referralRequestSection(referral) : '';
  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#374151;line-height:1.7;">
  <p>この度は「通信制高校リアルレビュー」に口コミをご投稿いただき、誠にありがとうございます。</p>

  <p>
    いただいたご投稿を拝見し、内容を確認させていただきました。<br>
    <strong>${schoolName}</strong> への口コミとして、サイトへの掲載が決定いたしましたのでお知らせします。
  </p>

  <p>
    通信制高校への進学を検討している方にとって、在校生・卒業生・保護者の方のリアルな体験談は非常に貴重な情報です。<br>
    あなたの声が、進路選択に迷っている多くの方の力になります。改めて、心より感謝申し上げます。
  </p>
  ${quoSection}
  ${referralSection}
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

export type GrantType = 'review' | 'referee' | 'referrer';

/**
 * QUO配布管理タブから、承認後にギフトURLを送る。
 * grantType ごとに件名・本文を切り替える。
 */
export async function sendGrantGiftEmail({
  to,
  grantType,
  schoolName,
  rewardAmount,
  giftUrl,
  referral,
  surveyResponseId,
  supabase,
}: {
  to: string;
  grantType: GrantType;
  schoolName: string;
  rewardAmount: number | null;
  giftUrl: string;
  referral?: ReferralShareInfo | null;
  surveyResponseId: string;
  supabase: SupabaseClient;
}): Promise<boolean> {
  const amountLabel = rewardAmount ? ` ${rewardAmount.toLocaleString('ja-JP')}円分` : '';
  const schoolLabel = schoolName ? `<strong>${schoolName}</strong> への` : '';

  const content: Record<
    GrantType,
    { subject: string; paragraphs: string[]; giftTitle: string; closing: string }
  > = {
    review: {
      subject: '【通信制高校リアルレビュー】QUOカードPayのお届け',
      paragraphs: [
        `先日は ${schoolLabel}口コミをご投稿いただき、誠にありがとうございました。`,
        '通信制高校を検討している方やそのご家族にとって、実際に通った方や保護者の方の率直な体験談は、学校を選ぶうえで大変貴重な情報になります。<br>お寄せいただいた口コミも、これから進路を考える方の不安を減らし、自分に合った学校を見つけるための参考として活用させていただきます。',
        `貴重な体験をお寄せいただいたことへの感謝の気持ちとして、キャンペーン特典の <strong>QUOカードPay${amountLabel}</strong> をお届けします。`,
      ],
      giftTitle: 'キャンペーン特典のご案内',
      closing: 'この度は、通信制高校リアルレビューへのご協力、本当にありがとうございました。',
    },
    referee: {
      subject: '【通信制高校リアルレビュー】QUOカードPayのお届け（ご紹介特典）',
      paragraphs: [
        `先日はお知り合いの方からのご紹介で ${schoolLabel}口コミをご投稿いただき、誠にありがとうございました。`,
        '通信制高校を検討している方やそのご家族にとって、実際に通った方や保護者の方の率直な体験談は、公式情報だけでは分からない学校の様子を知るための大切な判断材料になります。<br>お寄せいただいた口コミも、これから進路を考える方が自分に合った学校を選ぶための貴重な情報として活用させていただきます。',
        `ご協力への感謝の気持ちとして、ご紹介特典の <strong>QUOカードPay${amountLabel}</strong> をお届けします。`,
      ],
      giftTitle: 'ご紹介特典のご案内',
      closing: 'この度は、通信制高校リアルレビューへのご協力、本当にありがとうございました。',
    },
    referrer: {
      subject: '【通信制高校リアルレビュー】お知り合いのご紹介のお礼（QUOカードPayのお届け）',
      paragraphs: [
        'このたびはお知り合いの方をご紹介いただき、誠にありがとうございます。<br>ご紹介いただいた方の口コミが掲載されましたので、ご連絡いたしました。',
        '通信制高校を検討している方やそのご家族にとって、一人ひとりの実体験に基づく口コミは、学校選びの不安を減らし、自分に合った進路を考えるための貴重な情報になります。<br>今回、新たな体験談を届けるきっかけを作っていただいたことに、心より感謝申し上げます。',
        `ご紹介への感謝の気持ちとして、紹介特典の <strong>QUOカードPay${amountLabel}</strong> をお届けします。`,
      ],
      giftTitle: 'ご紹介特典のご案内',
      closing: '通信制高校リアルレビューの輪を広げるご協力をいただき、本当にありがとうございました。',
    },
  };
  const c = content[grantType];
  const referralSection = referral ? referralRequestSection(referral) : '';

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#374151;line-height:1.7;">
  ${c.paragraphs.map((p) => `<p>${p}</p>`).join('\n  ')}
  ${quoGiftSection(giftUrl, c.giftTitle)}
  <p>${c.closing}</p>
  ${referralSection}
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

  const ok = await sendEmail(to, c.subject, html);
  await logEmail(
    supabase,
    surveyResponseId,
    grantType === 'referrer' ? 'referral_reward' : 'campaign_grant',
    to,
    c.subject,
    ok ? 'sent' : 'failed'
  );
  return ok;
}

/** 特定電子メール法の表示義務（送信者の名称・住所）。未設定なら紹介依頼メールは送れない */
export function getSenderIdentity(): { org: string; address: string } | null {
  const org = process.env.EMAIL_SENDER_ORG?.trim();
  const address = process.env.EMAIL_SENDER_ADDRESS?.trim();
  return org && address ? { org, address } : null;
}

/** 過去の回答者に紹介をお願いするメール（scripts/send-referral-requests.ts から送信） */
export async function sendReferralRequestEmail({
  to,
  schoolName,
  referral,
  campaignEndsAt,
  unsubscribePageUrl,
  unsubscribeApiUrl,
  surveyResponseId,
  supabase,
}: {
  to: string;
  schoolName: string | null;
  referral: ReferralShareInfo;
  campaignEndsAt: string;
  unsubscribePageUrl: string;
  unsubscribeApiUrl: string;
  surveyResponseId: string;
  supabase: SupabaseClient;
}): Promise<boolean> {
  const sender = getSenderIdentity();
  if (!sender) {
    console.error('[email] EMAIL_SENDER_ORG / EMAIL_SENDER_ADDRESS が未設定のため紹介依頼メールを送信しません');
    return false;
  }

  const subject = '【通信制高校リアルレビュー】先日はご協力ありがとうございました／お知り合いへのご紹介のお願い';
  const endsAtLabel = new Date(campaignEndsAt).toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const schoolLabel = schoolName ? `<strong>${escapeHtml(schoolName)}</strong> の` : '';

  const html = `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#374151;line-height:1.7;">
  <p>
    以前「通信制高校リアルレビュー」にて、${schoolLabel}口コミをご投稿いただき、誠にありがとうございました。<br>
    いただいた口コミは、通信制高校への進学を検討している多くの方やご家族に読まれています。
  </p>

  <p>
    本日は、お知り合いへのご紹介のお願いでご連絡いたしました。<br>
    キャンペーン期間は <strong>${endsAtLabel}まで</strong> です。
  </p>
  ${referralRequestSection(referral)}
  <br>
  <p style="font-size:14px;color:#6b7280;">
    ご不明な点がございましたら、下記のお問い合わせページよりご連絡ください。<br>
    <a href="${SITE_URL}/tsushin-kuchikomi/contact" style="color:#3b82f6;">${SITE_URL}/tsushin-kuchikomi/contact</a>
  </p>

  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
  <p style="font-size:13px;color:#9ca3af;margin:0 0 12px;">
    通信制高校リアルレビュー<br>
    運営：${escapeHtml(sender.org)}（${escapeHtml(sender.address)}）<br>
    <a href="${SITE_URL}/tsushin-kuchikomi" style="color:#3b82f6;">${SITE_URL}/tsushin-kuchikomi</a>
  </p>
  <p style="font-size:12px;color:#9ca3af;margin:0;">
    今後このようなご案内が不要な場合は、こちらから配信を停止できます。<br>
    <a href="${unsubscribePageUrl}" style="color:#9ca3af;">配信停止はこちら</a>
  </p>
</div>
  `.trim();

  const ok = await sendEmail(to, subject, html, {
    'List-Unsubscribe': `<${unsubscribeApiUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  });
  await logEmail(supabase, surveyResponseId, 'referral_request', to, subject, ok ? 'sent' : 'failed');
  return ok;
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
