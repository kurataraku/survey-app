import Link from 'next/link';
import AdmissionBadgeList from '@/components/AdmissionBadgeList';
import NationalAverageDiff from '@/components/NationalAverageDiff';
import { appPath } from '@/lib/base-path';
import type { PrefectureSchoolRow } from '@/lib/schools/getPrefectureLandingData';
import {
  formatPrefectureLocation,
  regionalSchoolDataAttributes,
} from '@/lib/schools/regionalLanding';
import type { SchoolInstitutionType } from '@/lib/types/schools';

const institutionTypeLabels: Record<SchoolInstitutionType, string> = {
  public: '公立',
  private: '私立',
  support: 'サポート校',
};

const ROW_HIGHLIGHT_LIMIT = 2;

/**
 * 都道府県LPの一覧の1校分。東京など100校を超える県でも重くならないよう、
 * 要素数を旧比較表の1行と同程度に抑える（口コミの抜粋は載せず、カードに任せる）。
 */
export default function PrefectureSchoolListRow({
  school,
  prefecture,
  ratingDiff,
}: {
  school: PrefectureSchoolRow;
  prefecture: string;
  ratingDiff: number | null;
}) {
  const schoolHref = school.slug ? appPath(`/schools/${school.slug}`) : null;
  const headquarters =
    school.headquartersPrefecture && school.headquartersPrefecture !== '不明'
      ? school.headquartersPrefecture
      : null;
  const highlights = school.highlights.slice(0, ROW_HIGHLIGHT_LIMIT);

  return (
    <li
      {...regionalSchoolDataAttributes({
        ...school,
        rating: school.overallAvg,
        reviewCount: school.reviewCount,
      })}
      className="grid gap-2 border-b border-gray-200 px-1 py-4 text-sm md:grid-cols-[minmax(12rem,1.25fr)_minmax(8rem,0.9fr)_minmax(9rem,0.8fr)] md:gap-6"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 150px' }}
    >
      <div>
        {schoolHref ? (
          <Link
            href={schoolHref}
            prefetch={false}
            data-school-link="list"
            className="text-base font-bold text-gray-950 hover:text-blue-800 hover:underline"
          >
            {school.name}
          </Link>
        ) : (
          <span className="text-base font-bold text-gray-950">{school.name}</span>
        )}
        {school.institutionType && (
          <span className="ml-2 text-xs text-gray-500">
            {institutionTypeLabels[school.institutionType]}
          </span>
        )}
        {highlights.length > 0 && (
          <p className="mt-1 text-xs leading-relaxed text-blue-900">{highlights.join(' ／ ')}</p>
        )}
        <AdmissionBadgeList badges={school.admissionBadges} />
      </div>

      <p className="leading-relaxed text-gray-800">
        <span className="mr-2 text-gray-500">通える場所</span>
        {formatPrefectureLocation(school, prefecture)}
        {headquarters && (
          <span className="block text-xs text-gray-500">本校: {headquarters}</span>
        )}
        <span className="block">
          <span className="mr-2 text-gray-500">初年度納入金</span>
          {school.tuition?.value ?? '—'}
          {school.tuition?.basisLabel ? `（${school.tuition.basisLabel}）` : ''}
        </span>
      </p>

      {school.reviewCount > 0 ? (
        <p className="text-gray-900">
          <span className="font-semibold">
            {school.overallAvg != null ? `★ ${school.overallAvg.toFixed(1)}　` : ''}
            口コミ{school.reviewCount}件
          </span>
          <span className="block text-xs text-gray-500">
            学校全体
            {school.localReviewCount > 0 ? `（うち${prefecture}内${school.localReviewCount}件）` : ''}
            <NationalAverageDiff diff={ratingDiff} className="ml-2" />
          </span>
          {school.slug && (
            <Link
              href={appPath(`/schools/${school.slug}/reviews`)}
              prefetch={false}
              data-school-link="list_reviews"
              className="inline-flex min-h-11 items-center font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:text-blue-900"
            >
              口コミを読む
            </Link>
          )}
        </p>
      ) : (
        <p className="text-gray-600">
          口コミ募集中
          <Link
            href={appPath('/submit')}
            prefetch={false}
            className="flex min-h-11 w-fit items-center font-semibold text-blue-700 underline decoration-blue-200 underline-offset-4 hover:text-blue-900"
          >
            口コミを書く
          </Link>
        </p>
      )}
    </li>
  );
}
