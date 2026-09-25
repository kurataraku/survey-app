import type { AdmissionBadge } from '@/lib/schools/admissionProfiles';

/** 公式情報で確認済みの募集区域・スクーリング会場バッジ（地域LP・都市LPの比較表用） */
export default function AdmissionBadgeList({ badges }: { badges: AdmissionBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight ${
            badge.tone === 'caution'
              ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
              : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
          }`}
        >
          {badge.label}
        </span>
      ))}
    </span>
  );
}
