import Link from 'next/link';
import AdmissionBadgeList from '@/components/AdmissionBadgeList';
import { appPath } from '@/lib/base-path';
import { getReviewReasonGroup, type ReviewReasonGroupKey } from '@/lib/reviews/reason-groups';
import type { RegionalReviewExcerpt } from '@/lib/schools/regionalReviewExcerpts';
import {
  regionalSchoolDataAttributes,
  type RegionalSchoolTier,
} from '@/lib/schools/regionalLanding';
import type { AdmissionBadge } from '@/lib/schools/admissionProfiles';
import type { SchoolInstitutionType } from '@/lib/types/schools';
import type { buildTuitionTableCell } from '@/lib/tuition/format';

type CardExcerpt = RegionalReviewExcerpt & {
  respondentRole?: string | null;
  enrollmentType?: string | null;
  reasonGroupKeys?: ReviewReasonGroupKey[];
};

export type RegionalSchoolCardData = {
  id: string;
  name: string;
  slug: string | null;
  tier: RegionalSchoolTier;
  institutionType: SchoolInstitutionType | null;
  headquartersPrefecture: string;
  stations: string[];
  regionalReviewCount: number;
  totalReviewCount: number;
  /** 学校全体の総合満足度 */
  rating: number | null;
  defaultOrder: number;
  staffAvg: number | null;
  atmosphereAvg: number | null;
  ratingScopeLabel: string;
  tuition: ReturnType<typeof buildTuitionTableCell>;
  admissionBadges: AdmissionBadge[];
  excerpt: CardExcerpt;
  stationFilterIds: string[];
};

const institutionTypeLabels: Record<SchoolInstitutionType, string> = {
  public: '公立',
  private: '私立',
  support: 'サポート校',
};

function shortEnrollment(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('新入学')) return '新入学';
  if (value.startsWith('転入学')) return '転入';
  if (value.startsWith('編入学')) return '編入';
  return value;
}

function formatRating(value: number | null): string {
  return value == null ? '—' : value.toFixed(1);
}

export default function RegionalSchoolCard({
  school,
  prefecture,
  municipality,
}: {
  school: RegionalSchoolCardData;
  prefecture: string;
  municipality?: string;
}) {
  const { excerpt } = school;
  const situationTags = [
    excerpt.respondentRole,
    shortEnrollment(excerpt.enrollmentType),
    excerpt.attendance,
    ...(excerpt.reasonGroupKeys ?? [])
      .map((key) => getReviewReasonGroup(key)?.shortLabel ?? null)
      .filter((label): label is string => Boolean(label)),
  ]
    .filter((tag): tag is string => Boolean(tag))
    .slice(0, 4);
  const locationLabel =
    school.stations.length > 0
      ? school.stations.join('・')
      : municipality
        ? `${municipality}内`
        : `${prefecture}内`;
  const reviewsHref = school.slug
    ? appPath(`/schools/${school.slug}/reviews`)
    : appPath(`/reviews/${excerpt.id}`);

  return (
    <li
      {...regionalSchoolDataAttributes({ ...school, reviewCount: school.totalReviewCount })}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 520px' }}
    >
      <article className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-[0_8px_30px_rgba(30,64,175,0.06)]">
        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-sky-400 to-sky-200" />
        <div className="p-5 sm:p-6 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)] lg:gap-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold leading-snug text-gray-950">{school.name}</h3>
              {school.institutionType && (
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                  {institutionTypeLabels[school.institutionType]}
                </span>
              )}
            </div>

            <p className="mt-3 text-sm leading-relaxed text-gray-700">
              <span className="font-semibold text-gray-900">通える場所:</span> {locationLabel}
            </p>
            {school.headquartersPrefecture !== prefecture &&
              school.headquartersPrefecture !== '不明' && (
                <p className="mt-1 text-xs text-gray-500">本校: {school.headquartersPrefecture}</p>
              )}

            <AdmissionBadgeList badges={school.admissionBadges} />

            <dl className="mt-5 space-y-2 border-t border-blue-100 pt-4 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-gray-600">総合満足度</dt>
                <dd className="text-right font-bold text-gray-950">
                  {school.rating != null ? `★ ${school.rating.toFixed(1)}` : '—'}
                  <span className="ml-1 text-[11px] font-normal text-gray-500">
                    （学校全体{school.totalReviewCount}件）
                  </span>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-gray-600">先生・雰囲気</dt>
                <dd className="text-right font-semibold text-gray-900">
                  {formatRating(school.staffAvg)}・{formatRating(school.atmosphereAvg)}
                  <span className="ml-1 text-[11px] font-normal text-gray-500">
                    （{school.ratingScopeLabel}）
                  </span>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-gray-600">初年度納入金の目安</dt>
                <dd className="text-right font-semibold text-gray-900">
                  {school.tuition?.value ?? '—'}
                  {school.tuition?.basisLabel && (
                    <span className="block text-[11px] font-normal text-gray-500">
                      {school.tuition.basisLabel}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 border-t border-blue-100 pt-5 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <p className="text-xs font-bold tracking-wide text-blue-800">
              {excerpt.isCityCampus && municipality
                ? `${municipality}のキャンパスに通った人の声`
                : `${prefecture}内のキャンパスに通った人の声`}
            </p>
            {excerpt.good && (
              <blockquote className="relative mt-3 rounded-r-xl border-l-4 border-blue-300 bg-blue-50/70 py-4 pl-5 pr-4">
                <span
                  aria-hidden
                  className="absolute left-1.5 top-0 text-3xl leading-none text-blue-300"
                >
                  “
                </span>
                <p className="text-sm leading-7 text-gray-800">{excerpt.good}</p>
              </blockquote>
            )}
            {situationTags.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="この口コミの回答者情報">
                {situationTags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-600"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            )}
            {excerpt.bad && (
              <p className="mt-3 text-sm leading-relaxed text-gray-700">
                <span className="font-semibold text-gray-900">気になった点:</span> {excerpt.bad}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link
                href={reviewsHref}
                prefetch={false}
                data-school-link="featured_reviews"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
              >
                この学校の口コミを読む（{school.totalReviewCount}件）
              </Link>
              {school.slug && (
                <Link
                  href={appPath(`/schools/${school.slug}`)}
                  prefetch={false}
                  data-school-link="featured_detail"
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:text-blue-900"
                >
                  学校の詳細を見る →
                </Link>
              )}
            </div>
          </div>
        </div>
      </article>
    </li>
  );
}
