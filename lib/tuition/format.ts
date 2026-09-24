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

/** 公開画面・管理画面で使う学費サマリーのラベル（進学ネット等と同様、初年度納入金のみ掲載） */
export const TUITION_FIRST_YEAR_LABEL = '初年度納入金';

export interface TuitionRangeLine {
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
  const firstYear = formatTuitionRange(estimate.first_year_min, estimate.first_year_max);
  if (!firstYear) return [];
  return [{ label: TUITION_FIRST_YEAR_LABEL, value: firstYear }];
}

/**
 * カード用の1行サマリー（例: 「約35万円〜75万円」）。ラベルは呼び出し側で付ける。
 * 表示できる内容がなければ null（カード側で行ごと非表示にする）。
 */
export function buildTuitionCardSummary(estimate: PublicTuitionEstimate): string | null {
  if (estimate.display_mode !== 'amounts') {
    return TUITION_FALLBACK_SHORT[estimate.display_mode];
  }
  return formatTuitionRange(estimate.first_year_min, estimate.first_year_max);
}

/** 学費目安として表示可能なデータか（公開ページで描画するかの判定） */
export function hasDisplayableTuition(estimate: PublicTuitionEstimate | null | undefined): estimate is PublicTuitionEstimate {
  if (!estimate) return false;
  if (estimate.display_mode !== 'amounts') return true;
  return buildTuitionRangeLines(estimate).length > 0;
}

/**
 * 掲載金額が就学支援金の適用前か適用後か。
 *
 * mixed=コースごとに前後が違う / unknown=公式記載から判断できない。
 * 同じ「初年度納入金」でも適用前と適用後では数倍変わるため、学校間で基準が揃わない。
 * 適用後の学校は安く、適用前の学校は高く見えるので、金額の隣に必ず基準を出す。
 */
export type TuitionSupportFundBasis = 'before' | 'after' | 'mixed' | 'unknown';

export function resolveSupportFundBasis(
  estimate: PublicTuitionEstimate
): TuitionSupportFundBasis {
  const bases = new Set(
    estimate.plans
      .filter((plan) => plan.first_year_min != null || plan.first_year_max != null)
      .map((plan) => plan.support_fund ?? 'unknown')
  );
  if (bases.size === 0) return 'unknown';
  if (bases.size > 1) return 'mixed';
  const only = [...bases][0];
  return only === 'before' || only === 'after' ? only : 'unknown';
}

/** 金額の隣に出す短いラベル。一覧カードでもそのまま使う */
export const SUPPORT_FUND_BADGE_LABEL: Record<TuitionSupportFundBasis, string> = {
  before: '就学支援金 適用前',
  after: '就学支援金 適用後',
  mixed: 'コースにより適用前後が異なる',
  unknown: '適用前後は要確認',
};

/**
 * 金額が高い・安いではなく前提の違いであることを伝える説明文。
 * 適用後の学校を「安い」、適用前の学校を「高い」と誤読させないことが目的。
 */
export const SUPPORT_FUND_CAUTION: Record<TuitionSupportFundBasis, string> = {
  before:
    '国の就学支援金を差し引く前の学費です。2026年4月から所得制限が撤廃されたため、支援金が適用されると実際に納める額はこれより大きく下がります。適用後の金額を掲載している学校と並べると高く見えますが、前提が違うだけです。',
  after:
    '国の就学支援金を差し引いた後の、実際に納める額です。支援金を差し引く前の学費を掲載している学校と並べると低く見えますが、前提が違うだけで学費が安いとは限りません。支援金の額は履修単位数や前籍校での在籍期間によって変わります。',
  mixed:
    'コースによって就学支援金の適用前・適用後が異なります。金額の前提が揃っていないため、コース別の内訳で基準をご確認ください。',
  unknown:
    '公式サイトの記載からは、就学支援金の適用前か適用後かを判断できませんでした。実際に納める額は学校にご確認ください。',
};

/** 適用前後が確定している場合だけ、カード用の短い基準ラベルを返す */
export function buildTuitionCardBasisLabel(estimate: PublicTuitionEstimate): string | null {
  if (estimate.display_mode !== 'amounts') return null;
  if (!buildTuitionRangeLines(estimate).length) return null;
  const basis = resolveSupportFundBasis(estimate);
  if (basis === 'before') return '就学支援金適用前';
  if (basis === 'after') return '就学支援金適用後';
  return null;
}
