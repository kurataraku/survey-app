import Link from 'next/link';
import NationalAverageDiff from '@/components/NationalAverageDiff';
import { appPath } from '@/lib/base-path';
import {
  formatRegionalLocation,
  regionalSchoolDataAttributes,
  type RegionalSchoolTier,
} from '@/lib/schools/regionalLanding';
import type { SchoolInstitutionType } from '@/lib/types/schools';
import type { buildTuitionTableCell } from '@/lib/tuition/format';

export type RegionalSchoolListRowData = {
  id: string;
  name: string;
  slug: string | null;
  tier: RegionalSchoolTier;
  institutionType: SchoolInstitutionType | null;
  wards: string[];
  stations: string[];
  highlights: string[];
  regionalReviewCount: number;
  totalReviewCount: number;
  /** 学校全体の総合満足度と、全国平均との差 */
  rating: number | null;
  ratingDiff: number | null;
  defaultOrder: number;
  tuition: ReturnType<typeof buildTuitionTableCell>;
  excerpt: string | null;
  areaFilterIds: string[];
};

const institutionTypeLabels: Record<SchoolInstitutionType, string> = {
  public: '公立',
  private: '私立',
  support: 'サポート校',
};

export default function RegionalSchoolListRow({
  school,
  prefecture,
  municipality,
}: {
  school: RegionalSchoolListRowData;
  prefecture: string;
  municipality: string;
}) {
  const schoolHref = school.slug ? appPath(`/schools/${school.slug}`) : null;
  const location = formatRegionalLocation(school.wards, school.stations, `${municipality}内`);

  return (
    <li
      {...regionalSchoolDataAttributes({ ...school, reviewCount: school.totalReviewCount })}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-[border-color,box-shadow] hover:border-blue-200 hover:shadow-[0_6px_20px_rgba(15,23,42,0.08)] md:p-5"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 190px' }}
    >
      <div className="grid gap-3 md:grid-cols-[minmax(12rem,1.25fr)_minmax(8rem,0.8fr)_minmax(9rem,0.8fr)] md:items-start md:gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {schoolHref ? (
              <Link
                href={schoolHref}
                prefetch={false}
                data-school-link="other_detail"
                className="pref-row-name"
              >
                {school.name}
              </Link>
            ) : (
              <span className="text-base font-bold leading-snug text-slate-900">{school.name}</span>
            )}
            {school.institutionType && (
              <span className={`school-type school-type-${school.institutionType}`}>
                {institutionTypeLabels[school.institutionType]}
              </span>
            )}
          </div>
          {school.highlights.length > 0 && (
            <p className="pref-row-tags" aria-label="学校の特徴">
              {school.highlights.join(' ／ ')}
            </p>
          )}
          {school.excerpt && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
              「{school.excerpt}」
            </p>
          )}
        </div>

        <div className="space-y-1.5 text-sm md:border-l md:border-slate-100 md:pl-5">
          <p className="font-medium text-slate-800">
            <span className="pref-row-key-place">通える場所</span>
            {location}
          </p>
          <p className="font-medium text-slate-800">
            <span className="pref-row-key-fee">初年度納入金</span>
            {school.tuition?.value ?? '—'}
          </p>
        </div>

        <div className="text-sm">
          {school.totalReviewCount > 0 ? (
            <div className="pref-row-score">
              <p className="font-bold">
                {school.rating != null && <span className="rating-star">★</span>}
                {school.rating != null ? ` ${school.rating.toFixed(1)}　` : ''}
                口コミ{school.totalReviewCount}件
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                学校全体
                {school.regionalReviewCount > 0
                  ? `（うち${prefecture}内${school.regionalReviewCount}件）`
                  : ''}
                <NationalAverageDiff diff={school.ratingDiff} className="ml-2" />
              </p>
              {school.slug && (
                <Link
                  href={appPath(`/schools/${school.slug}/reviews`)}
                  prefetch={false}
                  data-school-link="other_reviews"
                  className="pref-row-link"
                >
                  口コミを読む
                </Link>
              )}
            </div>
          ) : (
            <div className="pref-row-empty">
              <p>口コミ募集中</p>
              <Link href={appPath('/submit')} prefetch={false} className="pref-row-write">
                口コミを書く
              </Link>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
