import { createSupabaseClientWithLargeHeaders } from '@/lib/supabase/large-headers';
import { normalizeAreaName, type NormalizedArea } from '@/lib/regions/area-normalize';
import type { ReviewReasonGroupKey } from '@/lib/reviews/reason-groups';
import { resolveReviewCampusArea, resolveReviewCampusPlace } from '@/lib/schools/campusLocations';
import {
  matchReviewReasonGroupKeys,
  type RegionalRespondentRole,
} from '@/lib/schools/regionalReviews';
import type { SchoolCampusLocation } from '@/lib/types/schools';

/** 地域LPに載せる口コミ抜粋。回答者が申告したキャンパス所在地で絞り込んだもの */
export type RegionalReviewExcerpt = {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolSlug: string | null;
  respondentRole: RegionalRespondentRole | null;
  enrollmentType: string | null;
  reasonGroupKeys: ReviewReasonGroupKey[];
  overall: number | null;
  attendance: string | null;
  /** municipality 指定時、回答者が市区町村まで申告しそれが一致した場合のみ true */
  isCityCampus: boolean;
  /** 回答された市区町村の正規化値（例: 「大阪市北区」）。公開できない回答は null */
  campusArea: NormalizedArea | null;
  good: string | null;
  bad: string | null;
};

type ExcerptSourceSchool = {
  id: string;
  name: string;
  slug: string | null;
  /** 県内キャンパスの口コミ件数。0件の学校は取得対象から外す */
  localReviewCount: number;
  /** 区名だけの市区町村回答を親市へ帰属させる判断に使う */
  campusLocations?: SchoolCampusLocation[] | null;
};

const LIMIT = 12;
const GOOD_LENGTH = 120;
const BAD_LENGTH = 90;

export type RegionalReviewExcerptSource = {
  id: string;
  school_id: string;
  respondent_role?: unknown;
  overall_satisfaction?: unknown;
  good_comment?: string | null;
  bad_comment?: string | null;
  created_at?: string | null;
  answers?: Record<string, unknown> | string | null;
};

function truncate(text: string | null | undefined, max: number): string | null {
  const trimmed = text?.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function parseAnswers(value: RegionalReviewExcerptSource['answers']): Record<string, unknown> {
  if (!value) return {};
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function toOverall(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const overall = Number(value);
  return Number.isFinite(overall) && overall >= 1 && overall <= 5 ? overall : null;
}

type RankedExcerpt = {
  excerpt: RegionalReviewExcerpt;
  /** 都市LPなど同じ地域の別ページで使っている口コミ。ほかに候補がない学校でだけ選ぶ */
  excluded: boolean;
  completeness: number;
  specificity: number;
  createdAt: string;
};

function isBetterExcerpt(candidate: RankedExcerpt, current: RankedExcerpt): boolean {
  if (candidate.excluded !== current.excluded) return !candidate.excluded;
  if (candidate.completeness !== current.completeness) {
    return candidate.completeness > current.completeness;
  }
  if (candidate.specificity !== current.specificity) {
    return candidate.specificity > current.specificity;
  }
  return candidate.createdAt > current.createdAt;
}

function rankExcerpt(
  review: RegionalReviewExcerptSource,
  school: ExcerptSourceSchool,
  municipality?: string
): RankedExcerpt | null {
  const fullGood = optionalText(review.good_comment);
  const fullBad = optionalText(review.bad_comment);
  if (!fullGood && !fullBad) return null;

  const answers = parseAnswers(review.answers);
  const combinedLength = (fullGood?.length ?? 0) + (fullBad?.length ?? 0);
  const hasBoth = Boolean(fullGood && fullBad);
  // 両面が書かれ、十分な情報量がある口コミを優先する。評価値や回答者属性の値は順位に使わない。
  const completeness = hasBoth ? (combinedLength >= 120 ? 3 : 2) : combinedLength >= 80 ? 1 : 0;
  const campusCity = municipality
    ? resolveReviewCampusArea(answers.campus_city, answers.campus_prefecture, school.campusLocations)
    : null;
  const respondentRole =
    review.respondent_role === '本人' || review.respondent_role === '保護者'
      ? review.respondent_role
      : null;

  return {
    excerpt: {
      id: review.id,
      schoolId: school.id,
      schoolName: school.name,
      schoolSlug: school.slug,
      respondentRole,
      enrollmentType: optionalText(answers.enrollment_type),
      reasonGroupKeys: matchReviewReasonGroupKeys(answers.reason_for_choosing),
      overall: toOverall(review.overall_satisfaction),
      attendance: optionalText(answers.attendance_frequency),
      isCityCampus: Boolean(municipality) && campusCity?.municipality === municipality,
      campusArea:
        resolveReviewCampusPlace(answers.campus_prefecture, answers.campus_city, school.campusLocations)
          ?.area ?? null,
      good: truncate(fullGood, GOOD_LENGTH),
      bad: truncate(fullBad, BAD_LENGTH),
    },
    excluded: false,
    completeness,
    // 原文の情報量を具体性の再現可能な代理指標にする。長文だけが過度に有利にならないよう上限を設ける。
    specificity: Math.min(combinedLength, 400),
    createdAt: review.created_at ?? '',
  };
}

/**
 * 地域口コミから学校ごとの代表1件を選ぶ純粋関数。
 * 完全性、具体性、新しさの順で比較し、回答者属性・理由・入学区分・評価の値は順位に使わない。
 * excludeReviewIds の口コミは、同じ学校にほかの候補がない場合にだけ選ぶ。
 */
export function selectRepresentativeRegionalReviewExcerpts(input: {
  schools: ExcerptSourceSchool[];
  reviews: RegionalReviewExcerptSource[];
  municipality?: string;
  limit?: number;
  excludeReviewIds?: Iterable<string>;
}): RegionalReviewExcerpt[] {
  const excludeReviewIds = new Set(input.excludeReviewIds ?? []);
  const requestedLimit = input.limit ?? LIMIT;
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(0, Math.floor(requestedLimit))
    : LIMIT;
  if (limit === 0) return [];

  const targets = input.schools
    .filter((school) => school.localReviewCount > 0)
    .sort((a, b) => b.localReviewCount - a.localReviewCount || a.name.localeCompare(b.name, 'ja'));
  const schoolById = new Map(targets.map((school) => [school.id, school]));
  const bestBySchool = new Map<string, RankedExcerpt>();
  const municipality = input.municipality
    ? normalizeAreaName(input.municipality)?.municipality ?? input.municipality
    : undefined;

  for (const review of input.reviews) {
    const school = schoolById.get(review.school_id);
    if (!school) continue;
    const candidate = rankExcerpt(review, school, municipality);
    if (!candidate) continue;
    candidate.excluded = excludeReviewIds.has(review.id);
    const current = bestBySchool.get(school.id);
    if (!current || isBetterExcerpt(candidate, current)) {
      bestBySchool.set(school.id, candidate);
    }
  }

  const result: RegionalReviewExcerpt[] = [];
  for (const school of targets) {
    const selected = bestBySchool.get(school.id);
    if (selected) result.push(selected.excerpt);
    if (result.length >= limit) break;
  }
  return result;
}

/**
 * 回答で「主に通っていたキャンパス都道府県」が prefecture の公開口コミから、
 * 各学校の代表1件を選ぶ。
 * 市区町村まで申告されていない口コミを市の口コミとは表示しない（isCityCampus で区別する）。
 */
export async function fetchRegionalReviewExcerpts(input: {
  schools: ExcerptSourceSchool[];
  prefecture: string;
  municipality?: string;
  limit?: number;
  excludeReviewIds?: Iterable<string>;
}): Promise<RegionalReviewExcerpt[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const targets = input.schools
    .filter((school) => school.localReviewCount > 0)
    .sort((a, b) => b.localReviewCount - a.localReviewCount);
  if (!url || !key || targets.length === 0) return [];

  const supabase = createSupabaseClientWithLargeHeaders(url, key);
  const { data, error } = await supabase
    .from('survey_responses')
    .select(
      'id, school_id, respondent_role, overall_satisfaction, good_comment, bad_comment, created_at, answers'
    )
    .in('school_id', targets.map((school) => school.id))
    .eq('is_public', true)
    .eq('answers->>campus_prefecture', input.prefecture)
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    console.error('[regionalReviewExcerpts] 口コミ抜粋の取得エラー:', error.message);
    return [];
  }

  return selectRepresentativeRegionalReviewExcerpts({
    schools: targets,
    reviews: (data ?? []) as RegionalReviewExcerptSource[],
    municipality: input.municipality,
    limit: input.limit,
    excludeReviewIds: input.excludeReviewIds,
  });
}
