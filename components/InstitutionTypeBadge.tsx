import type { SchoolInstitutionType } from '@/lib/types/schools';

/**
 * 公立 / 私立 / サポート校 を示すバッジ。
 *
 * サポート校は通信制高校ではないため、一覧でも詳細でも学校名のすぐ近くに出す。
 * 一覧のタブと配色を揃え、同じ区分だと一目で分かるようにしている。
 */
const CONFIG: Record<SchoolInstitutionType, { label: string; className: string }> = {
  public: { label: '公立', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  private: { label: '私立', className: 'bg-violet-50 text-violet-700 ring-violet-200' },
  support: { label: 'サポート校', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
};

const SIZES = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-sm',
} as const;

export default function InstitutionTypeBadge({
  type,
  size = 'sm',
}: {
  type: SchoolInstitutionType;
  size?: keyof typeof SIZES;
}) {
  const config = CONFIG[type];
  if (!config) return null;

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full font-bold ring-1 ring-inset ${SIZES[size]} ${config.className}`}
    >
      {config.label}
    </span>
  );
}
