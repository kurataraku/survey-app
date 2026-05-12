import Link from 'next/link';
import { appPath } from '@/lib/base-path';

interface RankingCardServerProps {
  rank: number;
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
  highlights?: string[] | null;
  intro?: string | null;
  reviewCount: number;
  value: number | null;
  valueLabel: string;
  valueType: 'rating' | 'count' | 'percentage';
  overallAvg?: number | null;
  staffAvg?: number | null;
  atmosphereAvg?: number | null;
  creditAvg?: number | null;
  tuitionAvg?: number | null;
  latestGoodComment?: string | null;
  latestBadComment?: string | null;
  reviewTendency?: { good: string[]; improvement: string[] } | null;
  globalAverages?: {
    overall_satisfaction_avg: number | null;
    staff_rating_avg: number | null;
    atmosphere_fit_rating_avg: number | null;
    credit_rating_avg: number | null;
    tuition_rating_avg: number | null;
  } | null;
}

function StarRating({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <div className="flex gap-0.5 items-center" aria-label={`${value}つ星`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`w-4 h-4 ${i <= rounded ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`} viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
      <span className="ml-1.5 text-sm font-bold text-gray-800">{value.toFixed(1)}</span>
    </div>
  );
}

function SectionBadge({ color, icon, label }: { color: string; icon: React.ReactNode; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mb-2 ${color}`}>
      {icon}
      {label}
    </span>
  );
}

const IconBook = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const IconChat = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const IconStar = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const IconChart = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

export default function RankingCardServer({
  rank,
  id,
  name,
  prefecture,
  slug,
  highlights,
  intro,
  reviewCount,
  value,
  valueLabel,
  valueType,
  staffAvg,
  atmosphereAvg,
  creditAvg,
  tuitionAvg,
  latestGoodComment,
  latestBadComment,
  reviewTendency,
  globalAverages,
}: RankingCardServerProps) {
  const href = slug?.trim() ? appPath(`/schools/${encodeURIComponent(slug)}`) : appPath(`/schools/id/${id}`);

  const formatValue = () => {
    if (value === null) return 'データなし';
    if (valueType === 'percentage') return `${value.toFixed(1)}%`;
    if (valueType === 'count') return `${value}件`;
    return value.toFixed(1);
  };

  const rankBadge = (() => {
    if (rank === 1) return 'bg-yellow-400 text-white shadow-sm';
    if (rank === 2) return 'bg-gray-400 text-white shadow-sm';
    if (rank === 3) return 'bg-amber-600 text-white shadow-sm';
    return 'bg-gray-100 text-gray-600';
  })();

  const visibleTags = highlights?.filter((h) => h.trim() !== '').slice(0, 3) ?? [];

  const ga = globalAverages;
  const categoryRatings = [
    { label: '先生', value: staffAvg, globalAvg: ga?.staff_rating_avg ?? null },
    { label: '雰囲気', value: atmosphereAvg, globalAvg: ga?.atmosphere_fit_rating_avg ?? null },
    { label: '単位取得', value: creditAvg, globalAvg: ga?.credit_rating_avg ?? null },
    { label: '学費', value: tuitionAvg, globalAvg: ga?.tuition_rating_avg ?? null },
  ].filter((r) => r.value != null);

  return (
    <Link
      href={href}
      className="block bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-lg transition-all duration-200"
    >
      {/* ヘッダー：順位 + 学校名 + 評価値 */}
      <div className="flex items-center gap-4 px-5 pt-5 pb-3 border-b border-gray-100">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${rankBadge}`}>
          {rank}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900 truncate">{name}</h3>
          {prefecture?.trim() && prefecture !== '不明' && (
            <p className="text-xs text-gray-500 mt-0.5">📍 {prefecture}</p>
          )}
        </div>
        <div className="flex-shrink-0 text-right">
          {valueType === 'rating' && value !== null && <StarRating value={value} />}
          {valueType === 'rating' && value === null && <span className="text-sm text-gray-400">データなし</span>}
          {valueType !== 'rating' && (
            <span className="text-lg font-bold text-blue-600">{formatValue()}</span>
          )}
          <p className="text-xs text-gray-400 mt-0.5">{valueLabel} · {reviewCount}件</p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* タグ */}
        {visibleTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {visibleTags.map((tag) => (
              <span key={tag} className="bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 学校紹介 */}
        {intro && (
          <div>
            <SectionBadge color="bg-slate-100 text-slate-600" icon={<IconBook />} label="学校紹介" />
            <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">{intro}</p>
          </div>
        )}

        {/* 口コミ */}
        {(latestGoodComment || latestBadComment) && (
          <div>
            <SectionBadge color="bg-blue-100 text-blue-700" icon={<IconChat />} label="口コミ" />
            <div className="space-y-2">
              {latestGoodComment && (
                <div className="pl-2 border-l-2 border-emerald-300">
                  <p className="text-xs font-medium text-emerald-600 mb-0.5">良かった点</p>
                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">「{latestGoodComment}」</p>
                </div>
              )}
              {latestBadComment && (
                <div className="pl-2 border-l-2 border-orange-300">
                  <p className="text-xs font-medium text-orange-600 mb-0.5">改善してほしい点</p>
                  <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">「{latestBadComment}」</p>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">全{reviewCount}件の口コミより抜粋</p>
          </div>
        )}

        {/* 口コミの傾向 */}
        {reviewTendency && (reviewTendency.good.length > 0 || reviewTendency.improvement.length > 0) && (
          <div>
            <SectionBadge color="bg-purple-100 text-purple-700" icon={<IconStar />} label="口コミの傾向" />
            <div className="space-y-2">
              {reviewTendency.good.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-emerald-600 mb-1">良い点</p>
                  <ul className="space-y-1">
                    {reviewTendency.good.map((g, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                        <span className="flex-shrink-0 mt-0.5 text-emerald-500">✓</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {reviewTendency.improvement.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-orange-600 mb-1">改善してほしい点</p>
                  <ul className="space-y-1">
                    {reviewTendency.improvement.map((g, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-gray-700">
                        <span className="flex-shrink-0 mt-0.5 text-orange-400">!</span>
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 項目別評価 */}
        {categoryRatings.length > 0 && (
          <div className="pt-3 border-t border-gray-100">
            <SectionBadge color="bg-amber-100 text-amber-700" icon={<IconChart />} label="項目別評価" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
              {categoryRatings.map((r) => {
                const score = r.value as number;
                const diff = r.globalAvg != null ? parseFloat((score - r.globalAvg).toFixed(1)) : null;
                const diffLabel = diff == null ? null : diff > 0 ? `(+${diff.toFixed(1)})` : diff < 0 ? `(${diff.toFixed(1)})` : '(±0.0)';
                const diffColor = diff == null ? '' : diff > 0.05 ? 'text-emerald-600' : diff < -0.05 ? 'text-rose-500' : 'text-gray-400';
                return (
                  <div key={r.label} className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 w-12 flex-shrink-0">{r.label}</span>
                    <span className="text-sm font-bold text-gray-800">{score.toFixed(1)}</span>
                    {diffLabel && (
                      <span className={`text-xs font-medium ${diffColor}`}>{diffLabel}</span>
                    )}
                  </div>
                );
              })}
            </div>
            {ga && <p className="text-xs text-gray-400 mt-1.5">（）内はサイト平均との差</p>}
          </div>
        )}
      </div>
    </Link>
  );
}
