import type { PublicTuitionEstimate } from '@/lib/types/tuition';
import {
  buildTuitionRangeLines,
  formatTuitionRange,
  hasDisplayableTuition,
  TUITION_FALLBACK_TEXT,
  TUITION_FIRST_YEAR_LABEL,
} from '@/lib/tuition/format';
interface TuitionEstimateBlockProps {
  estimate: PublicTuitionEstimate | null;
  /** 口コミの学費満足度平均（1〜5）。あれば併記する */
  tuitionRatingAvg?: number | null;
  className?: string;
}

/** plans の1パターンを「約35万円〜75万円」形式の文字列に（初年度納入金のみ） */
function buildPlanRangeText(plan: PublicTuitionEstimate['plans'][number]): string | null {
  return formatTuitionRange(plan.first_year_min ?? null, plan.first_year_max ?? null);
}

function buildPlanLabel(plan: PublicTuitionEstimate['plans'][number]): string {
  if (plan.label?.trim()) return plan.label.trim();
  const parts: string[] = [];
  if (plan.course_name?.trim()) parts.push(plan.course_name.trim());
  if (plan.attendance?.trim()) parts.push(plan.attendance.trim());
  if (plan.support_fund === 'before') parts.push('就学支援金適用前');
  if (plan.support_fund === 'after') parts.push('就学支援金適用後');
  return parts.join('・') || '費用目安';
}

/**
 * 学費目安（参考目安）の表示ブロック。
 * 公開済みデータがない場合は何も描画しない（無理に表示しない）。
 * 内部管理情報（出典・確認日・確認状態）は表示しない。
 */
export default function TuitionEstimateBlock({
  estimate,
  tuitionRatingAvg,
  className = '',
}: TuitionEstimateBlockProps) {
  if (!hasDisplayableTuition(estimate)) return null;

  const rangeLines = buildTuitionRangeLines(estimate);
  const fallbackText =
    estimate.display_mode !== 'amounts' ? TUITION_FALLBACK_TEXT[estimate.display_mode] : null;

  const visiblePlans = estimate.plans
    .map((plan) => ({ label: buildPlanLabel(plan), range: buildPlanRangeText(plan), note: plan.note?.trim() || null }))
    .filter((plan) => plan.range !== null)
    .slice(0, 6);

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 sm:p-5 ${className}`}>
      <h4 className="text-sm font-bold text-gray-900 mb-1">
        {TUITION_FIRST_YEAR_LABEL}
        <span className="ml-1.5 text-xs font-medium text-amber-800">（参考）</span>
      </h4>
      {estimate.display_mode === 'amounts' && rangeLines.length > 0 && (
        <p className="text-xs text-gray-500 mb-3 leading-relaxed">
          入学後1年目に学校へ納める費用の合計（就学支援金適用前・公式記載ベース）。教材費等は含まない場合があります。
        </p>
      )}

      {rangeLines.length > 0 ? (
        <dl className="space-y-1.5 mb-3">
          {rangeLines.map((line) => (
            <div key={line.label} className="flex items-baseline gap-3">
              <dt className="w-14 flex-shrink-0 text-xs text-gray-500">{line.label}</dt>
              <dd className="text-sm font-bold text-gray-800">{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        fallbackText && <p className="text-sm text-gray-700 leading-relaxed mb-3">{fallbackText}</p>
      )}

      {visiblePlans.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-600 mb-1.5">コース・通学頻度別の目安</p>
          <ul className="space-y-1.5">
            {visiblePlans.map((plan, i) => (
              <li key={i} className="text-xs text-gray-700 leading-relaxed">
                <span className="font-medium">{plan.label}</span>
                <span className="text-gray-500">：</span>
                {plan.range}
                {plan.note && <span className="text-gray-500">（{plan.note}）</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {estimate.support_fund_note && (
        <p className="text-xs text-gray-600 leading-relaxed mb-2">{estimate.support_fund_note}</p>
      )}
      {estimate.public_note && (
        <p className="text-xs text-gray-600 leading-relaxed mb-2">{estimate.public_note}</p>
      )}

      {tuitionRatingAvg != null && (
        <p className="text-xs text-gray-600">
          口コミでの学費満足度：
          <span className="font-bold text-gray-800">{tuitionRatingAvg.toFixed(1)}</span>
          <span className="text-gray-400"> / 5.0</span>
        </p>
      )}
    </div>
  );
}
