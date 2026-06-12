// 学費目安の表示整形ロジック
// 金額は円単位のINTEGERで保持し、表示時に「約35万円〜75万円」の形式に整形する

import type { PublicTuitionEstimate, TuitionDisplayMode } from '@/lib/types/tuition';

/** 円 → 「約35万円」形式。1万円未満は「約8,000円」形式 */
export function formatYenApprox(yen: number): string {
  if (yen >= 10000) {
    const man = yen / 10000;
    // 小数第1位まで（整数なら整数表示）: 350000 -> 35万, 355000 -> 35.5万
    const rounded = Math.round(man * 10) / 10;
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `約${text}万円`;
  }
  return `約${yen.toLocaleString('ja-JP')}円`;
}

/**
 * 金額レンジを「約35万円〜75万円」形式に整形する。
 * - min/max 両方あり: 約35万円〜75万円（同額なら 約35万円）
 * - min のみ: 約35万円〜
 * - max のみ: 〜約75万円
 * - 両方 null: null（表示しない）
 */
export function formatTuitionRange(min: number | null, max: number | null): string | null {
  if (min != null && max != null) {
    if (min === max) return formatYenApprox(min);
    return `${formatYenApprox(min)}〜${formatYenApprox(max).replace(/^約/, '')}`;
  }
  if (min != null) return `${formatYenApprox(min)}〜`;
  if (max != null) return `〜${formatYenApprox(max)}`;
  return null;
}

export interface TuitionRangeLine {
  /** 例: 初年度 / 年間 / 月額 */
  label: string;
  /** 例: 約35万円〜75万円 */
  value: string;
}

/** display_mode が amounts 以外、または金額が一切ない場合の表示文言 */
export const TUITION_FALLBACK_TEXT: Record<Exclude<TuitionDisplayMode, 'amounts'>, string> = {
  varies: 'コースや通学頻度により費用が変動します。',
  contact_required: 'コースや通学頻度により費用が大きく変わるため、個別確認が必要です。',
};

/** カード等での1行表示用の短い文言 */
export const TUITION_FALLBACK_SHORT: Record<Exclude<TuitionDisplayMode, 'amounts'>, string> = {
  varies: 'コースにより変動',
  contact_required: '個別確認が必要',
};

/**
 * 学費目安のサマリーレンジを表示行の配列に整形する。
 * 金額が確認できない項目は行ごと省略する（無理に表示しない）。
 */
export function buildTuitionRangeLines(estimate: PublicTuitionEstimate): TuitionRangeLine[] {
  if (estimate.display_mode !== 'amounts') return [];
  const lines: TuitionRangeLine[] = [];
  const firstYear = formatTuitionRange(estimate.first_year_min, estimate.first_year_max);
  if (firstYear) lines.push({ label: '初年度', value: firstYear });
  const annual = formatTuitionRange(estimate.annual_min, estimate.annual_max);
  if (annual) lines.push({ label: '年間', value: annual });
  const monthly = formatTuitionRange(estimate.monthly_min, estimate.monthly_max);
  if (monthly) lines.push({ label: '月額', value: monthly });
  return lines;
}

/**
 * カード用の1行サマリー（例: 「初年度 約35万円〜75万円 / 年間 約25万円〜65万円」）。
 * 表示できる内容がなければ null（カード側で行ごと非表示にする）。
 */
export function buildTuitionCardSummary(estimate: PublicTuitionEstimate): string | null {
  if (estimate.display_mode !== 'amounts') {
    return TUITION_FALLBACK_SHORT[estimate.display_mode];
  }
  const lines = buildTuitionRangeLines(estimate);
  if (lines.length === 0) return null;
  return lines
    .slice(0, 2)
    .map((line) => `${line.label} ${line.value}`)
    .join(' / ');
}

/** 学費目安として表示可能なデータか（公開ページで描画するかの判定） */
export function hasDisplayableTuition(estimate: PublicTuitionEstimate | null | undefined): estimate is PublicTuitionEstimate {
  if (!estimate) return false;
  if (estimate.display_mode !== 'amounts') return true;
  return buildTuitionRangeLines(estimate).length > 0;
}
