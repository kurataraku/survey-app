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
  const tuitionText = `${school.tuition?.value ?? '—'}${
    school.tuition?.basisLabel ? `（${school.tuition.basisLabel}）` : ''
  }`;
  const reviewCountText = `${
    school.overallAvg != null ? `★ ${school.overallAvg.toFixed(1)}　` : ''
  }口コミ${school.reviewCount}件`;
  const reviewScopeText = `学校全体${
    school.localReviewCount > 0 ? `（うち${prefecture}内${school.localReviewCount}件）` : ''
  }`;

  return (
    <li
      {...regionalSchoolDataAttributes({
        ...school,
        rating: school.overallAvg,
        reviewCount: school.reviewCount,
      })}
      className="pref-row"
    >
      <div>
        {schoolHref ? (
          <Link href={schoolHref} prefetch={false} data-school-link="list" className="pref-row-name">
            {school.name}
          </Link>
        ) : (
          <span className="text-base font-bold text-gray-950">{school.name}</span>
        )}
        {school.institutionType && (
          <span className="pref-row-type">{institutionTypeLabels[school.institutionType]}</span>
        )}
        {highlights.length > 0 && <p className="pref-row-tags">{highlights.join(' ／ ')}</p>}
        <AdmissionBadgeList badges={school.admissionBadges} />
      </div>

      <p className="pref-row-place">
        <span className="pref-row-label">通える場所</span>
        {formatPrefectureLocation(school, prefecture)}
        {headquarters && <span className="pref-row-sub">{`本校: ${headquarters}`}</span>}
        <span className="block">
          <span className="pref-row-label">初年度納入金</span>
          {tuitionText}
        </span>
      </p>

      {school.reviewCount > 0 ? (
        <p className="text-gray-900">
          <span className="font-semibold">{reviewCountText}</span>
          <span className="pref-row-sub">
            {reviewScopeText}
            <NationalAverageDiff diff={ratingDiff} className="ml-2" />
          </span>
          {school.slug && (
            <Link
              href={appPath(`/schools/${school.slug}/reviews`)}
              prefetch={false}
              data-school-link="list_reviews"
              className="pref-row-link"
            >
              口コミを読む
            </Link>
          )}
        </p>
      ) : (
        <p className="text-gray-600">
          口コミ募集中
          <Link href={appPath('/submit')} prefetch={false} className="pref-row-write">
            口コミを書く
          </Link>
        </p>
      )}
    </li>
  );
}
