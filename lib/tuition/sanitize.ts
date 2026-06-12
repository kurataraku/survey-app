// 学費目安の入力値サニタイズ（管理画面PUT・AI抽出保存の共通処理）
// 不明な金額は null として扱い、0以下の値は保存しない（0円扱い禁止）

import type {
  TuitionBreakdownItem,
  TuitionDisplayMode,
  TuitionEstimateInput,
  TuitionPlan,
  TuitionSourceType,
  TuitionSourceUrl,
  TuitionSupportFund,
} from '@/lib/types/tuition';

const DISPLAY_MODES: TuitionDisplayMode[] = ['amounts', 'varies', 'contact_required'];
const SOURCE_TYPES: TuitionSourceType[] = [
  'official_site',
  'official_pdf',
  'external_media',
  'unverified',
];
const SUPPORT_FUNDS: TuitionSupportFund[] = ['before', 'after', 'unknown'];

/** 正の整数のみ許可。それ以外（0・負数・小数・非数値）は null */
export function sanitizeAmount(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  return i > 0 ? i : null;
}

function sanitizeText(value: unknown, maxLength = 2000): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/** min > max の場合は両方を入れ替えずに max を捨てる（誤入力をそのまま公開しない） */
function sanitizeRange(min: unknown, max: unknown): { min: number | null; max: number | null } {
  const sMin = sanitizeAmount(min);
  let sMax = sanitizeAmount(max);
  if (sMin != null && sMax != null && sMin > sMax) {
    sMax = null;
  }
  return { min: sMin, max: sMax };
}

export function sanitizePlans(value: unknown): TuitionPlan[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === 'object')
    .slice(0, 20)
    .map((p) => {
      const firstYear = sanitizeRange(p.first_year_min, p.first_year_max);
      const annual = sanitizeRange(p.annual_min, p.annual_max);
      const monthly = sanitizeRange(p.monthly_min, p.monthly_max);
      const supportFund = SUPPORT_FUNDS.includes(p.support_fund as TuitionSupportFund)
        ? (p.support_fund as TuitionSupportFund)
        : null;
      return {
        label: sanitizeText(p.label, 200),
        course_name: sanitizeText(p.course_name, 200),
        attendance: sanitizeText(p.attendance, 200),
        first_year_min: firstYear.min,
        first_year_max: firstYear.max,
        annual_min: annual.min,
        annual_max: annual.max,
        monthly_min: monthly.min,
        monthly_max: monthly.max,
        support_fund: supportFund,
        note: sanitizeText(p.note, 500),
      };
    });
}

export function sanitizeBreakdown(value: unknown): TuitionBreakdownItem[] | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .filter((b): b is Record<string, unknown> => Boolean(b) && typeof b === 'object')
    .slice(0, 20)
    .map((b): TuitionBreakdownItem | null => {
      const item = sanitizeText(b.item, 100);
      if (!item) return null;
      const range = sanitizeRange(b.amount_min, b.amount_max);
      return {
        item,
        amount_min: range.min,
        amount_max: range.max,
        note: sanitizeText(b.note, 500),
      };
    })
    .filter((b): b is TuitionBreakdownItem => b !== null);
  return items.length > 0 ? items : null;
}

export function sanitizeSourceUrls(value: unknown): TuitionSourceUrl[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
    .slice(0, 10)
    .map((s): TuitionSourceUrl | null => {
      const url = sanitizeText(s.url, 2000);
      if (!url || !/^https?:\/\//i.test(url)) return null;
      return {
        url,
        kind: sanitizeText(s.kind, 100),
        note: sanitizeText(s.note, 500),
      };
    })
    .filter((s): s is TuitionSourceUrl => s !== null);
}

function sanitizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/**
 * 管理画面・AI抽出からの入力を school_tuition_estimates に保存できる形に正規化する。
 */
export function sanitizeTuitionInput(body: Record<string, unknown>): TuitionEstimateInput {
  const firstYear = sanitizeRange(body.first_year_min, body.first_year_max);
  const annual = sanitizeRange(body.annual_min, body.annual_max);
  const monthly = sanitizeRange(body.monthly_min, body.monthly_max);

  return {
    display_mode: DISPLAY_MODES.includes(body.display_mode as TuitionDisplayMode)
      ? (body.display_mode as TuitionDisplayMode)
      : 'amounts',
    first_year_min: firstYear.min,
    first_year_max: firstYear.max,
    annual_min: annual.min,
    annual_max: annual.max,
    monthly_min: monthly.min,
    monthly_max: monthly.max,
    plans: sanitizePlans(body.plans),
    breakdown: sanitizeBreakdown(body.breakdown),
    support_fund_note: sanitizeText(body.support_fund_note, 1000),
    public_note: sanitizeText(body.public_note, 1000),
    source_type: SOURCE_TYPES.includes(body.source_type as TuitionSourceType)
      ? (body.source_type as TuitionSourceType)
      : 'unverified',
    source_urls: sanitizeSourceUrls(body.source_urls),
    source_excerpt: sanitizeText(body.source_excerpt, 8000),
    verified_at: sanitizeDate(body.verified_at),
    internal_memo: sanitizeText(body.internal_memo, 4000),
  };
}
