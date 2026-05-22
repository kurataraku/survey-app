import Link from 'next/link';
import { appPath } from '@/lib/base-path';
import type { SchoolCampusLocation, SchoolInstitutionType } from '@/lib/types/schools';

interface SchoolCardServerProps {
  id: string;
  name: string;
  prefecture: string;
  prefectures?: string[];
  institutionType?: SchoolInstitutionType | null;
  campusLocations?: SchoolCampusLocation[] | null;
  matchedPrefecture?: string;
  /** 一覧が都道府県で絞り込まれているとき、本校所在地など別県表記が誤解を招くため所在地行を出さない */
  hidePrefectureUnderFilter?: boolean;
  slug: string | null;
  highlights?: string[] | null;
  intro?: string | null;
  reviewCount: number;
  overallAvg: number | null;
  latestGoodComment?: string | null;
  latestBadComment?: string | null;
  reviewExcerpts?: Array<{ good: string | null; bad: string | null }> | null;
  flexibilityAvg?: number | null;
  staffAvg?: number | null;
  supportAvg?: number | null;
  atmosphereAvg?: number | null;
  creditAvg?: number | null;
  uniqueCourseAvg?: number | null;
  careerSupportAvg?: number | null;
  campusLifeAvg?: number | null;
  tuitionAvg?: number | null;
  reviewTendency?: { good: string[]; improvement: string[] } | null;
  primaryMetric?: 'overall' | 'reviews' | 'support' | 'tuition';
  globalAverages?: {
    overall_satisfaction_avg: number | null;
    flexibility_rating_avg?: number | null;
    staff_rating_avg: number | null;
    support_rating_avg?: number | null;
    atmosphere_fit_rating_avg: number | null;
    credit_rating_avg: number | null;
    unique_course_rating_avg?: number | null;
    career_support_rating_avg?: number | null;
    campus_life_rating_avg?: number | null;
    tuition_rating_avg: number | null;
  } | null;
}

function StarRating({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <div className="flex gap-0.5" aria-label={`${value}つ星`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={`w-4 h-4 ${i <= rounded ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`} viewBox="0 0 24 24">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function InstitutionTypeBadge({ type }: { type: SchoolInstitutionType }) {
  const config = {
    public: {
      label: '公立',
      className: 'bg-sky-50 text-sky-700 ring-sky-200',
    },
    private: {
      label: '私立',
      className: 'bg-violet-50 text-violet-700 ring-violet-200',
    },
    support: {
      label: 'サポート校',
      className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    },
  }[type];

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function CampusLocationBadges({
  locations,
  matchedPrefecture,
}: {
  locations: SchoolCampusLocation[] | null | undefined;
  matchedPrefecture?: string;
}) {
  if (!locations?.length) return null;

  const visibleLocations = locations.filter((location) =>
    matchedPrefecture ? location.prefecture === matchedPrefecture : true
  );
  if (visibleLocations.length === 0) return null;

  const cities = Array.from(new Set(visibleLocations.map((location) => location.city))).slice(0, 6);
  if (cities.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {cities.map((city) => (
        <span
          key={city}
          className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 ring-1 ring-inset ring-blue-100"
        >
          {city}
        </span>
      ))}
    </div>
  );
}

/** セクション見出しバッジ */
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

const IconClipboard = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

export default function SchoolCardServer({
  id,
  name,
  prefecture,
  prefectures,
  institutionType,
  campusLocations,
  matchedPrefecture,
  hidePrefectureUnderFilter = false,
  slug,
  highlights,
  intro,
  reviewCount,
  overallAvg,
  latestGoodComment,
  latestBadComment,
  reviewExcerpts,
  flexibilityAvg,
  staffAvg,
  supportAvg,
  atmosphereAvg,
  creditAvg,
  uniqueCourseAvg,
  careerSupportAvg,
  campusLifeAvg,
  tuitionAvg,
  reviewTendency,
  primaryMetric = 'overall',
  globalAverages,
}: SchoolCardServerProps) {
  const isValidPrefecture = (pref: string | null | undefined) =>
    pref !== null && pref !== undefined && pref.trim() !== '' && pref !== '不明';

  const allPrefecturesSet = new Set<string>();
  if (isValidPrefecture(prefecture)) allPrefecturesSet.add(prefecture);
  prefectures?.forEach((p) => { if (isValidPrefecture(p)) allPrefecturesSet.add(p); });
  const allPrefectures = Array.from(allPrefecturesSet);

  let displayPrefectures: string[] = [];
  if (hidePrefectureUnderFilter && matchedPrefecture && isValidPrefecture(matchedPrefecture)) {
    displayPrefectures = [matchedPrefecture];
  } else if (!hidePrefectureUnderFilter && allPrefectures.length > 0) {
    if (matchedPrefecture && allPrefectures.includes(matchedPrefecture)) {
      displayPrefectures = [matchedPrefecture, ...allPrefectures.filter((p) => p !== matchedPrefecture).slice(0, 4)];
    } else {
      const main = isValidPrefecture(prefecture) ? prefecture : allPrefectures[0];
      displayPrefectures = [main, ...allPrefectures.filter((p) => p !== main).slice(0, 4)];
    }
  }

  const href = slug?.trim()
    ? appPath(`/schools/${encodeURIComponent(slug)}`)
    : appPath(`/schools/id/${id}`);

  const visibleTags = highlights?.filter((h) => h.trim() !== '').slice(0, 4) ?? [];
  const visibleReviewExcerpts =
    reviewExcerpts && reviewExcerpts.length > 0
      ? reviewExcerpts.slice(0, 2)
      : latestGoodComment || latestBadComment
        ? [{ good: latestGoodComment ?? null, bad: latestBadComment ?? null }]
        : [];
  const excerptCount = Math.min(reviewCount, visibleReviewExcerpts.length);

  const ga = globalAverages;
  const primaryMetricConfig = (() => {
    if (primaryMetric === 'reviews') {
      return {
        label: '口コミ数',
        value: `${reviewCount}`,
        suffix: '件',
        rating: null as number | null,
        globalAvg: null as number | null,
      };
    }
    if (primaryMetric === 'support') {
      return {
        label: 'サポート評価',
        value: supportAvg != null ? supportAvg.toFixed(1) : null,
        suffix: null,
        rating: supportAvg ?? null,
        globalAvg: ga?.support_rating_avg ?? null,
      };
    }
    if (primaryMetric === 'tuition') {
      return {
        label: '学費満足度',
        value: tuitionAvg != null ? tuitionAvg.toFixed(1) : null,
        suffix: null,
        rating: tuitionAvg ?? null,
        globalAvg: ga?.tuition_rating_avg ?? null,
      };
    }
    return {
      label: '総合満足度',
      value: overallAvg != null ? overallAvg.toFixed(1) : null,
      suffix: null,
      rating: overallAvg,
      globalAvg: ga?.overall_satisfaction_avg ?? null,
    };
  })();
  /** ヘッダーに総合があるため、ここでは詳細項目のみ（重複を避ける） */
  const categoryRatings = [
    { label: '柔軟さ', value: flexibilityAvg, globalAvg: ga?.flexibility_rating_avg ?? null },
    { label: '先生', value: staffAvg, globalAvg: ga?.staff_rating_avg ?? null },
    { label: 'サポート', value: supportAvg, globalAvg: ga?.support_rating_avg ?? null },
    { label: '雰囲気', value: atmosphereAvg, globalAvg: ga?.atmosphere_fit_rating_avg ?? null },
    { label: '単位取得', value: creditAvg, globalAvg: ga?.credit_rating_avg ?? null },
    { label: '独自コース', value: uniqueCourseAvg, globalAvg: ga?.unique_course_rating_avg ?? null },
    { label: '進路支援', value: careerSupportAvg, globalAvg: ga?.career_support_rating_avg ?? null },
    { label: '学校生活', value: campusLifeAvg, globalAvg: ga?.campus_life_rating_avg ?? null },
    { label: '学費', value: tuitionAvg, globalAvg: ga?.tuition_rating_avg ?? null },
  ].filter((r) => r.value != null);

  return (
    <Link
      href={href}
      className="block bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-lg transition-all duration-200"
    >
      {/* ヘッダー：学校名 + 評価 */}
      <div className="flex justify-between items-start gap-3 px-5 pt-5 pb-3 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-gray-900 leading-snug">{name}</h3>
          {institutionType && <div className="mt-1.5"><InstitutionTypeBadge type={institutionType} /></div>}
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
          {primaryMetricConfig.value !== null ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-bold text-yellow-700 ring-1 ring-inset ring-yellow-200">
                  {primaryMetricConfig.label}
                </span>
                {primaryMetricConfig.rating != null && <StarRating value={primaryMetricConfig.rating} />}
              </div>
              <span className="text-xs text-gray-500 font-medium">
                {primaryMetricConfig.value}
                {primaryMetricConfig.suffix && (
                  <span className="font-normal text-gray-400">{primaryMetricConfig.suffix}</span>
                )}
                {primaryMetricConfig.rating != null && primaryMetricConfig.globalAvg != null && (() => {
                  const diff = parseFloat((primaryMetricConfig.rating - primaryMetricConfig.globalAvg).toFixed(1));
                  const label = diff > 0 ? `(+${diff.toFixed(1)})` : diff < 0 ? `(${diff.toFixed(1)})` : '(±0.0)';
                  const color = diff > 0.05 ? 'text-emerald-600' : diff < -0.05 ? 'text-rose-500' : 'text-gray-400';
                  return <span className={`ml-1 font-medium ${color}`}>{label}</span>;
                })()}
                {primaryMetric !== 'reviews' && (
                  <span className="font-normal text-gray-400"> / {reviewCount}件</span>
                )}
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-400">{reviewCount}件</span>
          )}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* 都道府県 + タグ */}
        {(displayPrefectures.length > 0 || visibleTags.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {displayPrefectures.length > 0 && (
              <span className="text-xs text-gray-500">
                {hidePrefectureUnderFilter ? '一覧条件: ' : '📍 '}
                {displayPrefectures.join('、')}
              </span>
            )}
            {visibleTags.map((tag) => (
              <span key={tag} className="bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
        <CampusLocationBadges locations={campusLocations} matchedPrefecture={matchedPrefecture} />

        {/* 学校紹介 */}
        {intro && (
          <div>
            <SectionBadge
              color="bg-slate-100 text-slate-600"
              icon={<IconBook />}
              label="学校紹介"
            />
            <p
              className="text-sm text-gray-700 leading-relaxed line-clamp-6"
            >
              {intro}
            </p>
          </div>
        )}

        {reviewCount === 0 && (
          <div>
            <SectionBadge
              color="bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200"
              icon={<IconClipboard />}
              label="比較するときの確認ポイント"
            />
            <ul className="text-xs text-gray-700 space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>学費・就学支援は必ず学校公式サイトの最新情報で確認してください。</li>
              <li>通学型・オンライン型、サポートの有無は募集要項・資料請求で確認してください。</li>
              <li>詳細ページの学校概要・よくある質問もあわせてご覧ください。</li>
            </ul>
          </div>
        )}

        {/* 口コミ */}
        {visibleReviewExcerpts.length > 0 && (
          <div>
            <SectionBadge
              color="bg-blue-100 text-blue-700"
              icon={<IconChat />}
              label="口コミ"
            />
            <div className="space-y-2.5">
              {visibleReviewExcerpts.map((excerpt, index) => (
                <div key={index} className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                      <IconChat />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-700 leading-tight">口コミ例</p>
                      <p className="text-[10px] text-gray-400 leading-tight">実際の投稿から抜粋</p>
                    </div>
                  </div>
                  {excerpt.good && (
                    <div className="mb-1.5">
                      <p className="text-xs font-medium text-emerald-600 mb-0.5">良かった点</p>
                      <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">「{excerpt.good}」</p>
                    </div>
                  )}
                  {excerpt.bad && (
                    <div>
                      <p className="text-xs font-medium text-orange-600 mb-0.5">気になった点</p>
                      <p className="text-sm text-gray-700 leading-relaxed line-clamp-2">「{excerpt.bad}」</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              全{reviewCount}件の口コミより{excerptCount}件を抜粋
            </p>
          </div>
        )}

        {/* 口コミの傾向 */}
        {reviewTendency && (reviewTendency.good.length > 0 || reviewTendency.improvement.length > 0) && (
          <div>
            <SectionBadge
              color="bg-purple-100 text-purple-700"
              icon={<IconStar />}
              label="口コミの傾向"
            />
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
            <SectionBadge
              color="bg-amber-100 text-amber-700"
              icon={<IconChart />}
              label="項目別評価"
            />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {categoryRatings.map((r) => {
                const score = r.value as number;
                const diff = r.globalAvg != null ? parseFloat((score - r.globalAvg).toFixed(1)) : null;
                const diffLabel = diff == null ? null : diff > 0 ? `(+${diff.toFixed(1)})` : diff < 0 ? `(${diff.toFixed(1)})` : '(±0.0)';
                const diffColor = diff == null ? '' : diff > 0.05 ? 'text-emerald-600' : diff < -0.05 ? 'text-rose-500' : 'text-gray-400';
                return (
                  <div key={r.label} className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 w-16 flex-shrink-0">{r.label}</span>
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
