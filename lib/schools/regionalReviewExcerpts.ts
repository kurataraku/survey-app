import { createSupabaseClientWithLargeHeaders } from '@/lib/supabase/large-headers';
import { normalizeAreaName } from '@/lib/regions/area-normalize';

/** 地域LPに載せる口コミ抜粋。回答者が申告したキャンパス所在地で絞り込んだもの */
export type RegionalReviewExcerpt = {
  id: string;
  schoolName: string;
  schoolSlug: string | null;
  overall: number | null;
  attendance: string | null;
  /** municipality 指定時、回答者が市区町村まで申告しそれが一致した場合のみ true */
  isCityCampus: boolean;
  good: string | null;
  bad: string | null;
};

type ExcerptSourceSchool = {
  id: string;
  name: string;
  slug: string | null;
  /** 県内キャンパスの口コミ件数。0件の学校は取得対象から外す */
  localReviewCount: number;
};

const PER_SCHOOL = 2;
const LIMIT = 12;
const GOOD_LENGTH = 120;
const BAD_LENGTH = 90;

function truncate(text: string | null | undefined, max: number): string | null {
  const trimmed = text?.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

/**
 * 回答で「主に通っていたキャンパス都道府県」が prefecture の公開口コミを、新しい順に抜粋する。
 * 口コミの多い学校から1件ずつ順番に並べ、特定校に偏らないようにする。
 * 市区町村まで申告されていない口コミを市の口コミとは表示しない（isCityCampus で区別する）。
 */
export async function fetchRegionalReviewExcerpts(input: {
  schools: ExcerptSourceSchool[];
  prefecture: string;
  municipality?: string;
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
    .select('id, school_id, overall_satisfaction, good_comment, bad_comment, created_at, answers')
    .in('school_id', targets.map((school) => school.id))
    .eq('is_public', true)
    .eq('answers->>campus_prefecture', input.prefecture)
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    console.error('[regionalReviewExcerpts] 口コミ抜粋の取得エラー:', error.message);
    return [];
  }

  const schoolById = new Map(targets.map((school) => [school.id, school]));
  const perSchool = new Map<string, RegionalReviewExcerpt[]>();
  for (const review of data ?? []) {
    const school = schoolById.get(review.school_id);
    if (!school) continue;
    const list = perSchool.get(school.id) ?? [];
    if (list.length >= PER_SCHOOL) continue;
    const good = truncate(review.good_comment, GOOD_LENGTH);
    const bad = truncate(review.bad_comment, BAD_LENGTH);
    if (!good && !bad) continue;
    const answers = (review.answers ?? {}) as Record<string, unknown>;
    const campusCity =
      input.municipality && typeof answers.campus_city === 'string'
        ? normalizeAreaName(answers.campus_city)
        : null;
    const overall = Number(review.overall_satisfaction);
    list.push({
      id: review.id,
      schoolName: school.name,
      schoolSlug: school.slug,
      overall: overall >= 1 && overall <= 5 ? overall : null,
      attendance: typeof answers.attendance_frequency === 'string' ? answers.attendance_frequency : null,
      isCityCampus: Boolean(input.municipality) && campusCity?.municipality === input.municipality,
      good,
      bad,
    });
    perSchool.set(school.id, list);
  }

  const result: RegionalReviewExcerpt[] = [];
  for (let round = 0; round < PER_SCHOOL; round++) {
    for (const school of targets) {
      const excerpt = perSchool.get(school.id)?.[round];
      if (excerpt) result.push(excerpt);
      if (result.length >= LIMIT) return result;
    }
  }
  return result;
}
