import Link from 'next/link';
import SchoolHighlightList from '@/components/SchoolHighlightList';
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
  /** 学校全体の総合満足度 */
  rating: number | null;
  defaultOrder: number;
  tuition: ReturnType<typeof buildTuitionTableCell>;
  excerpt: string | null;
  stationFilterIds: string[];
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
      className="border-b border-gray-200 px-1 pb-5"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 180px' }}
    >
      <div className="grid gap-3 md:grid-cols-[minmax(12rem,1.25fr)_minmax(8rem,0.8fr)_minmax(9rem,0.8fr)] md:items-start md:gap-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {schoolHref ? (
              <Link
                href={schoolHref}
                prefetch={false}
                data-school-link="other_detail"
                className="text-base font-bold text-gray-950 hover:text-blue-800 hover:underline"
              >
                {school.name}
              </Link>
            ) : (
              <span className="text-base font-bold text-gray-950">{school.name}</span>
            )}
            {school.institutionType && (
              <span className="text-xs text-gray-500">
                {institutionTypeLabels[school.institutionType]}
              </span>
            )}
          </div>
          <SchoolHighlightList highlights={school.highlights} />
          {school.excerpt && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-600">
              「{school.excerpt}」
            </p>
          )}
        </div>

        <dl className="space-y-1 text-sm">
          <div className="flex gap-2 md:block">
            <dt className="shrink-0 text-gray-500">通える場所</dt>
            <dd className="font-medium text-gray-800">{location}</dd>
          </div>
          <div className="flex gap-2 md:block">
            <dt className="shrink-0 text-gray-500">初年度納入金</dt>
            <dd className="font-medium text-gray-800">{school.tuition?.value ?? '—'}</dd>
          </div>
        </dl>

        <div className="text-sm">
          {school.totalReviewCount > 0 ? (
            <>
              <p className="font-semibold text-gray-900">
                {school.rating != null ? `★ ${school.rating.toFixed(1)}　` : ''}
                口コミ{school.totalReviewCount}件
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                学校全体
                {school.regionalReviewCount > 0
                  ? `（うち${prefecture}内${school.regionalReviewCount}件）`
                  : ''}
              </p>
              {school.slug && (
                <Link
                  href={appPath(`/schools/${school.slug}/reviews`)}
                  prefetch={false}
                  data-school-link="other_reviews"
                  className="mt-2 inline-flex min-h-11 items-center font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:text-blue-900"
                >
                  口コミを読む
                </Link>
              )}
            </>
          ) : (
            <>
              <p className="text-gray-600">口コミ募集中</p>
              <Link
                href={appPath('/submit')}
                prefetch={false}
                className="mt-2 inline-flex min-h-11 items-center font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:text-blue-900"
              >
                口コミを書く
              </Link>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
