export default function NationalAverageDiff({
  diff,
  className = '',
}: {
  diff: number | null;
  className?: string;
}) {
  if (diff == null) return null;
  const label =
    diff === 0
      ? '全国平均と同じ'
      : `全国平均より ${diff > 0 ? '+' : '-'}${Math.abs(diff).toFixed(1)}`;
  const tone = diff > 0 ? 'font-semibold text-blue-700' : 'font-normal text-gray-500';
  return <span className={`text-[11px] ${tone} ${className}`}>{label}</span>;
}
