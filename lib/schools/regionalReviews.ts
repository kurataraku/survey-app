/**
 * 口コミの地域帰属集計。
 *
 * アンケートの必須項目「主に通っていたキャンパス都道府県」（answers.campus_prefecture）を使い、
 * 「学校全体の口コミ件数」と「その都道府県のキャンパスに通った回答の件数」を分けて数える。
 *
 * 全国に拠点を持つ学校は、学校全体の口コミ件数が各都道府県LPで同じ値として表示され、
 * 「その県の口コミ」に見えてしまう。地域別に数え直すことで、実際に県内で通った回答だけを
 * 地域の根拠として提示できるようにする。
 */
import { resolveReviewCampusArea } from '@/lib/schools/campusLocations';
import {
  REVIEW_REASON_GROUPS,
  type ReviewReasonGroupKey,
} from '@/lib/reviews/reason-groups';
import type { SchoolCampusLocation } from '@/lib/types/schools';

export type RegionalRespondentRole = '本人' | '保護者';
export type RegionalReasonGroupCounts = Record<ReviewReasonGroupKey, number>;
export type RegionalRespondentRoleCounts = Record<RegionalRespondentRole, number>;

/** 都道府県単位に絞った口コミ集計。件数と平均のみを持ち、口コミ本文は学校詳細・口コミ一覧へ集約する */
export type RegionalReviewStat = {
  prefecture: string;
  reviewCount: number;
  overallAvg: number | null;
  staffAvg: number | null;
  supportAvg: number | null;
  atmosphereAvg: number | null;
  creditAvg: number | null;
  careerSupportAvg: number | null;
  tuitionAvg: number | null;
  /** 通信制を選んだ理由を3つの大分類にまとめた件数。1口コミは各分類につき最大1件として数える */
  reasonGroups: RegionalReasonGroupCounts;
  /** 回答者の立場。既知の2区分だけを数える */
  respondentRoles: RegionalRespondentRoleCounts;
  /** 通学頻度の回答分布。「週5」「週1〜2」「ほぼオンライン/自宅」など */
  attendanceFrequencies: Record<string, number>;
  /** 入学タイミングの回答分布。「新入学（中学卒業後）」「転入学（他校から転校）」など */
  enrollmentTypes: Record<string, number>;
  /**
   * 任意項目「通っていたキャンパスの市区町村」（answers.campus_city）に回答があった口コミの市区町村別集計。
   * 政令指定都市は親市単位。未回答の口コミは含めない（都道府県の回答を市区町村へ振り分けない）。
   */
  municipalities: Record<string, { reviewCount: number; overallAvg: number | null }>;
};

type RatingKey =
  | 'overall'
  | 'staff'
  | 'support'
  | 'atmosphere'
  | 'credit'
  | 'careerSupport'
  | 'tuition';

type RegionalAccumulator = {
  reviewCount: number;
  ratings: Record<RatingKey, number[]>;
  reasonGroups: RegionalReasonGroupCounts;
  respondentRoles: RegionalRespondentRoleCounts;
  attendanceFrequencies: Map<string, number>;
  enrollmentTypes: Map<string, number>;
  municipalities: Map<string, { reviewCount: number; overall: number[] }>;
};

/** school_id → campus_prefecture → 集計 */
export type RegionalReviewIndex = Map<string, Map<string, RegionalAccumulator>>;

export function createRegionalReviewIndex(): RegionalReviewIndex {
  return new Map();
}

function emptyAccumulator(): RegionalAccumulator {
  return {
    reviewCount: 0,
    ratings: {
      overall: [],
      staff: [],
      support: [],
      atmosphere: [],
      credit: [],
      careerSupport: [],
      tuition: [],
    },
    reasonGroups: {
      mental_relationship: 0,
      learning_style: 0,
      health_development: 0,
    },
    respondentRoles: { 本人: 0, 保護者: 0 },
    attendanceFrequencies: new Map(),
    enrollmentTypes: new Map(),
    municipalities: new Map(),
  };
}

function bump(counter: Map<string, number>, value: unknown) {
  if (typeof value !== 'string') return;
  const trimmed = value.trim();
  if (!trimmed) return;
  counter.set(trimmed, (counter.get(trimmed) ?? 0) + 1);
}

export function matchReviewReasonGroupKeys(value: unknown): ReviewReasonGroupKey[] {
  if (!Array.isArray(value)) return [];
  const reasons = new Set(
    value
      .filter((reason): reason is string => typeof reason === 'string')
      .map((reason) => reason.trim())
      .filter(Boolean)
  );
  return REVIEW_REASON_GROUPS
    .filter((group) => group.reasons.some((reason) => reasons.has(reason)))
    .map((group) => group.key);
}

/**
 * 1件の公開口コミを、回答されたキャンパス都道府県の集計へ加える。
 * campus_prefecture が空の回答は地域の根拠にしないため、どの都道府県にも加算しない。
 * respondent_role は answers ではなく survey_responses のトップレベル列から渡す。
 * campusLocations は区名だけの市区町村回答を親市へ帰属させる判断に使う（resolveReviewCampusArea）。
 */
export function addRegionalReview(
  index: RegionalReviewIndex,
  schoolId: string,
  answers: Record<string, unknown>,
  overallSatisfaction: number | null,
  parseRating: (value: unknown) => number | null,
  respondentRole?: unknown,
  campusLocations?: SchoolCampusLocation[] | null
): void {
  const campusPrefecture =
    typeof answers.campus_prefecture === 'string' ? answers.campus_prefecture.trim() : '';
  if (!campusPrefecture) return;

  const bySchool = index.get(schoolId) ?? new Map<string, RegionalAccumulator>();
  const entry = bySchool.get(campusPrefecture) ?? emptyAccumulator();

  entry.reviewCount += 1;
  if (overallSatisfaction !== null) entry.ratings.overall.push(overallSatisfaction);

  const push = (key: RatingKey, value: unknown) => {
    const rating = parseRating(value);
    if (rating !== null) entry.ratings[key].push(rating);
  };
  push('staff', answers.staff_rating);
  push('support', answers.support_rating);
  push('atmosphere', answers.atmosphere_fit_rating);
  push('credit', answers.credit_rating);
  push('careerSupport', answers.career_support_rating);
  push('tuition', answers.tuition_rating);

  bump(entry.attendanceFrequencies, answers.attendance_frequency);
  bump(entry.enrollmentTypes, answers.enrollment_type);
  for (const groupKey of matchReviewReasonGroupKeys(answers.reason_for_choosing)) {
    entry.reasonGroups[groupKey] += 1;
  }
  if (respondentRole === '本人' || respondentRole === '保護者') {
    entry.respondentRoles[respondentRole] += 1;
  }

  const municipality = resolveReviewCampusArea(
    answers.campus_city,
    campusPrefecture,
    campusLocations
  )?.municipality;
  if (municipality) {
    const cityEntry = entry.municipalities.get(municipality) ?? { reviewCount: 0, overall: [] };
    cityEntry.reviewCount += 1;
    if (overallSatisfaction !== null) cityEntry.overall.push(overallSatisfaction);
    entry.municipalities.set(municipality, cityEntry);
  }

  bySchool.set(campusPrefecture, entry);
  index.set(schoolId, bySchool);
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
}

export function finalizeRegionalReviews(
  index: RegionalReviewIndex,
  schoolId: string
): RegionalReviewStat[] | null {
  const bySchool = index.get(schoolId);
  if (!bySchool || bySchool.size === 0) return null;

  return [...bySchool.entries()]
    .map(([prefecture, entry]) => ({
      prefecture,
      reviewCount: entry.reviewCount,
      overallAvg: average(entry.ratings.overall),
      staffAvg: average(entry.ratings.staff),
      supportAvg: average(entry.ratings.support),
      atmosphereAvg: average(entry.ratings.atmosphere),
      creditAvg: average(entry.ratings.credit),
      careerSupportAvg: average(entry.ratings.careerSupport),
      tuitionAvg: average(entry.ratings.tuition),
      reasonGroups: { ...entry.reasonGroups },
      respondentRoles: { ...entry.respondentRoles },
      attendanceFrequencies: Object.fromEntries(entry.attendanceFrequencies),
      enrollmentTypes: Object.fromEntries(entry.enrollmentTypes),
      municipalities: Object.fromEntries(
        [...entry.municipalities.entries()].map(([name, cityEntry]) => [
          name,
          { reviewCount: cityEntry.reviewCount, overallAvg: average(cityEntry.overall) },
        ])
      ),
    }))
    .sort((a, b) => b.reviewCount - a.reviewCount || a.prefecture.localeCompare(b.prefecture, 'ja'));
}

export function findRegionalReviewStat(
  stats: RegionalReviewStat[] | null,
  prefecture: string
): RegionalReviewStat | null {
  return stats?.find((stat) => stat.prefecture === prefecture) ?? null;
}

/** 複数校の地域集計を1つの都道府県単位のサマリへまとめる */
export type RegionalReviewSummary = {
  prefecture: string;
  reviewCount: number;
  schoolCount: number;
  overallAvg: number | null;
  attendanceFrequencies: Array<{ label: string; count: number }>;
  enrollmentTypes: Array<{ label: string; count: number }>;
};

export function summarizeRegionalReviews(
  stats: RegionalReviewStat[],
  prefecture: string
): RegionalReviewSummary {
  let reviewCount = 0;
  let weightedOverall = 0;
  let weightedCount = 0;
  const attendance = new Map<string, number>();
  const enrollment = new Map<string, number>();

  for (const stat of stats) {
    reviewCount += stat.reviewCount;
    if (stat.overallAvg != null) {
      weightedOverall += stat.overallAvg * stat.reviewCount;
      weightedCount += stat.reviewCount;
    }
    for (const [label, count] of Object.entries(stat.attendanceFrequencies)) {
      attendance.set(label, (attendance.get(label) ?? 0) + count);
    }
    for (const [label, count] of Object.entries(stat.enrollmentTypes)) {
      enrollment.set(label, (enrollment.get(label) ?? 0) + count);
    }
  }

  const toSortedList = (counter: Map<string, number>) =>
    [...counter.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ja'));

  return {
    prefecture,
    reviewCount,
    schoolCount: stats.length,
    overallAvg:
      weightedCount > 0 ? parseFloat((weightedOverall / weightedCount).toFixed(2)) : null,
    attendanceFrequencies: toSortedList(attendance),
    enrollmentTypes: toSortedList(enrollment),
  };
}
