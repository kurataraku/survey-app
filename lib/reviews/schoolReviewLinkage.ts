import type { SupabaseClient } from '@supabase/supabase-js';

/** PostgREST の `.or('...,school_name.eq....')` 用（カンマ・括弧等を含む校名対策） */
export function postgrestEqString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** 公開口コミ一覧用: school_id 一致 OR 校名一致（管理画面の学校口コミ一覧と同スコープ） */
export function publicSurveyResponsesOrFilter(schoolId: string, schoolName: string): string {
  return `school_id.eq.${schoolId},school_name.eq.${postgrestEqString(schoolName)}`;
}

type SchoolJoin = { id?: string; status?: string } | null | undefined;

/**
 * この学校のハブページ（/schools/[slug]・一覧API）に載せる口コミか。
 * school_id が別の active 校を指している場合は重複掲載を避け、その校のページのみに載せる。
 */
export function shouldIncludeSurveyOnSchoolHubPage(
  review: {
    school_id: string | null | undefined;
    school_name: string | null | undefined;
    schools?: SchoolJoin | SchoolJoin[];
  },
  pageSchoolId: string,
  pageSchoolName: string
): boolean {
  const schoolJoin = Array.isArray(review.schools) ? review.schools[0] : review.schools;

  if (review.school_id === pageSchoolId) {
    return !!(schoolJoin && schoolJoin.status === 'active');
  }

  if (!review.school_name || review.school_name !== pageSchoolName) {
    return false;
  }

  if (review.school_id === null || review.school_id === undefined) {
    return true;
  }

  if (!schoolJoin || schoolJoin.status !== 'active') {
    return true;
  }

  return false;
}

/**
 * 学校名から公開中・active の学校 ID を1件に特定できるときだけ返す（曖昧一致は使わない）
 */
export async function resolveSchoolIdFromSchoolName(
  supabase: SupabaseClient,
  schoolName: string | null | undefined
): Promise<string | null> {
  const name = schoolName?.trim();
  if (!name) return null;

  const { data, error } = await supabase
    .from('schools')
    .select('id')
    .eq('name', name)
    .eq('is_public', true)
    .eq('status', 'active');

  if (error || !data?.length) return null;
  if (data.length !== 1) return null;
  return data[0].id;
}

/**
 * school の schools JOIN が無いときの簡易判定（school_id または校名+未設定ID）
 */
export function isPublicReviewForSchoolPage(
  review: { school_id: string | null | undefined; school_name: string | null | undefined },
  schoolId: string,
  schoolName: string
): boolean {
  if (review.school_id === schoolId) return true;
  if (
    (review.school_id === null || review.school_id === undefined) &&
    review.school_name &&
    review.school_name === schoolName
  ) {
    return true;
  }
  return false;
}
