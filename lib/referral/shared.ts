/** 紛らわしい文字（0/O, 1/I/L）を除いた 32 文字 */
export const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const REFERRAL_CODE_LENGTH = 8;
export const REFERRAL_CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

export const REFERRAL_QUERY_PARAM = 'ref';
export const REFERRAL_STORAGE_KEY = 'tk_referral_code';
export const REFERRAL_STORAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function normalizeReferralCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return REFERRAL_CODE_PATTERN.test(code) ? code : null;
}

/** 回答完了画面に返す紹介情報 */
export interface ReferralShareInfo {
  code: string;
  url: string;
  /** 紹介された人が受け取る謝礼（通常の口コミ謝礼と同額。二重付与なし） */
  respondentRewardAmount: number;
  /** 紹介者が 1 人紹介するごとに受け取る謝礼 */
  referrerRewardAmount: number;
}

/** 紹介者向けの特典説明（HTML不可のプレーンテキスト） */
export function describeReferralReward(referral: ReferralShareInfo): string {
  const referrer = referral.referrerRewardAmount.toLocaleString('ja-JP');
  const respondent = referral.respondentRewardAmount.toLocaleString('ja-JP');
  if (referral.referrerRewardAmount === referral.respondentRewardAmount) {
    return `あなたとご紹介した方のそれぞれに QUOカードPay ${referrer}円分`;
  }
  return `あなたに QUOカードPay ${referrer}円分、ご紹介した方に ${respondent}円分`;
}

/**
 * 紹介者がそのまま知り合いに送れる依頼文（URL入り）。
 * 回答者は在校生・卒業生・保護者のいずれもありうるため、立場を限定しない文面にする。
 */
export function buildReferralMessage(
  referral: Pick<ReferralShareInfo, 'url' | 'respondentRewardAmount'>
): string {
  const amount = referral.respondentRewardAmount.toLocaleString('ja-JP');
  return [
    '通信制高校の口コミサイト「通信制高校リアルレビュー」では、',
    `簡単なアンケートに回答し、口コミが掲載されるとQUOカードPay ${amount}円分を受け取れます。`,
    '',
    '・スマホで3〜5分程度',
    '・選択式が中心で、自由記述は「良かった点」「気になった点」の2項目',
    '・匿名で回答でき、名前はサイトに掲載されません',
    '',
    '通信制高校に現在通っている方、以前通っていた方、または保護者の方が回答できます。',
    '以下のURLからご協力いただけるとうれしいです。',
    '',
    '▼アンケートはこちら',
    referral.url,
    '',
    '※投稿内容の確認後、口コミが掲載された場合に謝礼の対象となります。',
  ].join('\n');
}

export const REFERRAL_MESSAGE_SUBJECT = '通信制高校の口コミアンケートご協力のお願い';

export function buildLineShareUrl(message: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(message)}`;
}
