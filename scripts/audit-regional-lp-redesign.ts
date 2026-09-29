/**
 * 地域LP再設計前のデータ充足率とFinder候補数を読み取り専用で監査する。
 *
 * 実行:
 *   npx tsx scripts/audit-regional-lp-redesign.ts
 *   npx tsx scripts/audit-regional-lp-redesign.ts --out=.seo/regional-lp-redesign-audit.json
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import {
  getCampusNearestStations,
  isStandingCampus,
  normalizeCampusLocations,
} from '@/lib/schools/campusLocations';
import { normalizeAreaName, toDisplayStationName } from '@/lib/regions/area-normalize';
import { REVIEW_REASON_GROUPS } from '@/lib/reviews/reason-groups';
import type { SchoolCampusLocation } from '@/lib/types/schools';

type SchoolRow = {
  id: string;
  name: string;
  prefecture: string | null;
  prefectures: string[] | null;
  campus_locations: SchoolCampusLocation[] | null;
};

type ReviewRow = {
  school_id: string | null;
  respondent_role: string | null;
  good_comment: string | null;
  bad_comment: string | null;
  answers: Record<string, unknown> | string | null;
};

type NormalizedReview = {
  schoolId: string;
  prefecture: string | null;
  municipality: string | null;
  respondentRole: string | null;
  attendance: string | null;
  enrollmentType: string | null;
  reasons: string[];
  hasExcerpt: boolean;
};

const LOW_FREQUENCY_VALUES = new Set(['週1〜2', '月1〜数回', 'ほぼオンライン/自宅']);
const TRANSFER_VALUE = '転入学（他校から転校）';
const MENTAL_RELATIONSHIP_REASONS = new Set(
  REVIEW_REASON_GROUPS.find((group) => group.key === 'mental_relationship')?.reasons ?? []
);

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function parseAnswers(value: ReviewRow['answers']): Record<string, unknown> {
  if (!value) return {};
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function reasons(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
}

function rate(count: number, total: number): number {
  return total === 0 ? 0 : Number(((count / total) * 100).toFixed(1));
}

function relatedToPrefecture(school: SchoolRow, prefecture: string): boolean {
  if (school.prefecture === prefecture || school.prefectures?.includes(prefecture)) return true;
  return (
    school.campus_locations?.some(
      (location) => location.prefecture === prefecture && isStandingCampus(location)
    ) ?? false
  );
}

function locationsInMunicipality(
  school: SchoolRow,
  prefecture: string,
  municipality: string
): SchoolCampusLocation[] {
  return (school.campus_locations ?? []).filter(
    (location) =>
      location.prefecture === prefecture &&
      isStandingCampus(location) &&
      normalizeAreaName(location.city)?.municipality === municipality
  );
}

function conditionFlags(reviews: NormalizedReview[]) {
  return {
    lowFrequency: reviews.some((review) => review.attendance && LOW_FREQUENCY_VALUES.has(review.attendance)),
    transfer: reviews.some((review) => review.enrollmentType === TRANSFER_VALUE),
    mentalRelationship: reviews.some((review) =>
      review.reasons.some((reason) => MENTAL_RELATIONSHIP_REASONS.has(reason))
    ),
    parent: reviews.some((review) => review.respondentRole === '保護者'),
  };
}

function auditRegion(input: {
  label: string;
  prefecture: string;
  schools: SchoolRow[];
  reviews: NormalizedReview[];
  municipality?: string;
}) {
  const targetSchools = input.municipality
    ? input.schools.filter(
        (school) =>
          locationsInMunicipality(school, input.prefecture, input.municipality as string).length > 0
      )
    : input.schools.filter((school) => relatedToPrefecture(school, input.prefecture));
  const targetIds = new Set(targetSchools.map((school) => school.id));
  const regionalReviews = input.reviews.filter(
    (review) => targetIds.has(review.schoolId) && review.prefecture === input.prefecture
  );
  const reviewsBySchool = new Map<string, NormalizedReview[]>();
  for (const review of regionalReviews) {
    const list = reviewsBySchool.get(review.schoolId) ?? [];
    list.push(review);
    reviewsBySchool.set(review.schoolId, list);
  }

  const candidateRows = targetSchools.map((school) => {
    const schoolReviews = reviewsBySchool.get(school.id) ?? [];
    const stations = input.municipality
      ? locationsInMunicipality(school, input.prefecture, input.municipality)
          .flatMap((location) => getCampusNearestStations(location))
          .map((station) => toDisplayStationName(station))
          .filter((station): station is string => Boolean(station))
      : [];
    return {
      schoolId: school.id,
      schoolName: school.name,
      regionalReviewCount: schoolReviews.length,
      hasExcerpt: schoolReviews.some((review) => review.hasExcerpt),
      conditions: conditionFlags(schoolReviews),
      stations: [...new Set(stations)],
    };
  });

  const aCandidates = candidateRows.filter(
    (row) => row.regionalReviewCount > 0 && row.hasExcerpt
  );
  const bCandidates = candidateRows.filter(
    (row) => row.regionalReviewCount > 0 && !row.hasExcerpt
  );
  const cCandidates = candidateRows.filter((row) => row.regionalReviewCount === 0);
  const stationCounts = new Map<string, number>();
  for (const row of candidateRows) {
    for (const station of row.stations) {
      stationCounts.set(station, (stationCounts.get(station) ?? 0) + 1);
    }
  }

  return {
    label: input.label,
    totalSchools: targetSchools.length,
    regionalReviewCount: regionalReviews.length,
    schoolsWithRegionalReviews: candidateRows.filter((row) => row.regionalReviewCount > 0).length,
    tiers: {
      aCandidates: aCandidates.length,
      bCandidates: bCandidates.length,
      cCandidates: cCandidates.length,
    },
    finderSchools: {
      lowFrequency: candidateRows.filter((row) => row.conditions.lowFrequency).length,
      transfer: candidateRows.filter((row) => row.conditions.transfer).length,
      mentalRelationship: candidateRows.filter((row) => row.conditions.mentalRelationship).length,
      parent: candidateRows.filter((row) => row.conditions.parent).length,
    },
    topStations: [...stationCounts.entries()]
      .map(([station, schoolCount]) => ({ station, schoolCount }))
      .sort((a, b) => b.schoolCount - a.schoolCount || a.station.localeCompare(b.station, 'ja'))
      .slice(0, 8),
  };
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です');
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const [schoolsResult, reviewsResult] = await Promise.all([
    supabase
      .from('schools')
      .select('id, name, prefecture, prefectures, campus_locations')
      .eq('status', 'active')
      .eq('is_public', true),
    supabase
      .from('survey_responses')
      .select('school_id, respondent_role, good_comment, bad_comment, answers')
      .eq('is_public', true),
  ]);
  if (schoolsResult.error) throw schoolsResult.error;
  if (reviewsResult.error) throw reviewsResult.error;

  const schools: SchoolRow[] = (schoolsResult.data ?? []).map((school) => ({
    ...school,
    campus_locations: normalizeCampusLocations(school.campus_locations),
  }));
  const sourceReviews = (reviewsResult.data ?? []) as ReviewRow[];
  const reviews: NormalizedReview[] = sourceReviews.flatMap((review) => {
    if (!review.school_id) return [];
    const answers = parseAnswers(review.answers);
    return [
      {
        schoolId: review.school_id,
        prefecture: text(answers.campus_prefecture),
        municipality: normalizeAreaName(text(answers.campus_city))?.municipality ?? null,
        respondentRole: text(review.respondent_role),
        attendance: text(answers.attendance_frequency),
        enrollmentType: text(answers.enrollment_type),
        reasons: reasons(answers.reason_for_choosing),
        hasExcerpt: Boolean(review.good_comment?.trim() || review.bad_comment?.trim()),
      },
    ];
  });

  const fillRates = {
    totalPublicReviews: reviews.length,
    campusPrefecture: {
      count: reviews.filter((review) => review.prefecture).length,
      rate: rate(reviews.filter((review) => review.prefecture).length, reviews.length),
    },
    campusMunicipality: {
      count: reviews.filter((review) => review.municipality).length,
      rate: rate(reviews.filter((review) => review.municipality).length, reviews.length),
    },
    respondentRole: {
      count: reviews.filter((review) => review.respondentRole).length,
      rate: rate(reviews.filter((review) => review.respondentRole).length, reviews.length),
    },
    attendance: {
      count: reviews.filter((review) => review.attendance).length,
      rate: rate(reviews.filter((review) => review.attendance).length, reviews.length),
    },
    enrollmentType: {
      count: reviews.filter((review) => review.enrollmentType).length,
      rate: rate(reviews.filter((review) => review.enrollmentType).length, reviews.length),
    },
    reasonForChoosing: {
      count: reviews.filter((review) => review.reasons.length > 0).length,
      rate: rate(reviews.filter((review) => review.reasons.length > 0).length, reviews.length),
    },
  };

  const regions = [
    auditRegion({ label: '東京都', prefecture: '東京都', schools, reviews }),
    auditRegion({ label: '愛知県', prefecture: '愛知県', schools, reviews }),
    auditRegion({
      label: '名古屋市',
      prefecture: '愛知県',
      municipality: '名古屋市',
      schools,
      reviews,
    }),
    auditRegion({
      label: '町田市',
      prefecture: '東京都',
      municipality: '町田市',
      schools,
      reviews,
    }),
  ];

  const machidaSchools = schools.filter(
    (school) => locationsInMunicipality(school, '東京都', '町田市').length > 0
  );
  const machidaLocations = machidaSchools.flatMap((school) =>
    locationsInMunicipality(school, '東京都', '町田市')
  );
  const machidaSchoolIds = new Set(machidaSchools.map((school) => school.id));
  const machidaGate = {
    standingCampusLocations: machidaLocations.length,
    schoolCount: machidaSchools.length,
    addressFillRate: rate(
      machidaLocations.filter((location) => Boolean(location.address?.trim() || location.city?.trim()))
        .length,
      machidaLocations.length
    ),
    stationFillRate: rate(
      machidaLocations.filter((location) => getCampusNearestStations(location).length > 0).length,
      machidaLocations.length
    ),
    schoolsWithTokyoReviews: new Set(
      reviews
        .filter(
          (review) => machidaSchoolIds.has(review.schoolId) && review.prefecture === '東京都'
        )
        .map((review) => review.schoolId)
    ).size,
    schoolsWithMachidaReviews: new Set(
      reviews
        .filter(
          (review) => machidaSchoolIds.has(review.schoolId) && review.municipality === '町田市'
        )
        .map((review) => review.schoolId)
    ).size,
    gscGeneralQueryConfirmed: false,
    gscNote: '直近28日の「町田」page-queryは0行。検索需要をGSCで確認できない。',
  };

  const output = {
    auditedAt: new Date().toISOString(),
    fillRates,
    regions,
    machidaGate,
  };
  console.log(JSON.stringify(output, null, 2));

  const outPath = getArg('out');
  if (outPath) {
    const resolved = path.resolve(process.cwd(), outPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(output, null, 2), 'utf8');
    console.log(`\n結果を ${outPath} に保存しました`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
