import { z } from 'zod';

export const uuid = z.string().uuid();
export const email = z.string().trim().max(254).email().transform((value) => value.toLowerCase());
export const consentVersion = 'postal-2026-11-v1';
export const photoBucket = 'school-partner-photos';

export const settingsSchema = z.object({
  official_link_enabled: z.boolean(),
  request_enabled: z.boolean(),
  content_enabled: z.boolean(),
  recipient_name: z.string().trim().max(150),
  access_days: z.number().int().min(7).max(365),
});

export type PartnershipSettings = z.infer<typeof settingsSchema>;

export const defaultSettings: PartnershipSettings = {
  official_link_enabled: false,
  request_enabled: false,
  content_enabled: false,
  recipient_name: '',
  access_days: 90,
};

export const requestSchema = z.object({
  school_id: uuid,
  submission_key: uuid,
  recipient_label: z.string().trim().min(1).max(150),
  recipient_name: z.string().trim().min(1).max(150),
  addressee: z.string().trim().min(1).max(80),
  postal_code: z.string().max(12).transform((value) => value.normalize('NFKC').trim().replace(/[-ー−\s]/g, ''))
    .pipe(z.string().regex(/^\d{7}$/, '郵便番号を7桁で入力してください。')),
  address: z.string().trim().min(1).max(240),
  email,
  phone: z.string().max(24).default('').transform((value) => value.normalize('NFKC').trim().replace(/[-ー−\s()]/g, ''))
    .pipe(z.string().regex(/^(?:0\d{9,10})?$/, '電話番号を確認してください。')),
  applicant_role: z.enum(['guardian', 'adult']),
  consent: z.literal(true),
  consent_version: z.literal(consentVersion),
  website: z.literal('').optional(),
});

export function consentText(school: string, organization: string, includePhone: boolean) {
  const items = `宛名・郵便番号・住所${includePhone ? '・電話番号' : ''}`;
  return `株式会社キャリアエッセンスは、資料の郵送と請求内容の確認に必要な連絡のため、${items}を${school}（${organization}）へ提供します。受付連絡用メールアドレスは当社が使用します。`;
}

export function verifiedOfficialLink(url: unknown, verified: unknown): string | null {
  if (verified !== true || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * 学校が入力したリンク先の検証。外部リンクとして公開されるため厳しめにする。
 * 通らなければ null（保存せず、公開時にも表示しない）。https のみ、認証情報・ローカル/社内ホスト・IP直指定は不可。
 */
export function normalizeSchoolLink(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const value = input.normalize('NFKC').trim();
  if (!value || value.length > 500) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) return null;
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('.') || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return null;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[')) return null;
    parsed.hash = '';
    return parsed.href;
  } catch {
    return null;
  }
}

export const schoolLinkError = 'https:// で始まる、学校の公式サイトのURLを入力してください（例: https://example.ac.jp/）。';

export const requestLabels: Record<string, string> = {
  received: '受付済み', held: '保留', shared: '未確認', acknowledged: '発送待ち', shipped: '発送済み', cancelled: '取消',
};

export const contentLabels: Record<string, string> = {
  pending: '公開中・確認待ち', approved: '公開中・確認済み', stopped: '掲載停止', revision_pending: '修正版・確認待ち',
};

export function monthRange(value: string | null) {
  const current = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit' }).format(new Date());
  const month = value && /^20\d\d-(?:0[1-9]|1[0-2])$/.test(value) ? value : current;
  const [year, number] = month.split('-').map(Number);
  const nextMonth = number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`;
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { month, start: `${month}-01T00:00:00+09:00`, end: `${nextMonth}-01T00:00:00+09:00`, startDate: `${month}-01`, endDate: `${month}-${lastDay}` };
}

// メール配信結果の表示名。クライアントからも使うので、サーバ専用コードを含む delivery.ts ではなくここに置く。
export type DeliveryStatus = 'queued' | 'delayed' | 'delivered' | 'bounced' | 'complained' | 'canceled' | 'unknown';
export const deliveryLabels: Record<DeliveryStatus, string> = {
  queued: '送信受付', delayed: '配信遅延', delivered: '配信済み', bounced: '不達',
  complained: '迷惑メール報告', canceled: '送信取消', unknown: '結果不明',
};
