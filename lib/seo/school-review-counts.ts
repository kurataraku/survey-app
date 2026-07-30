/**
 * 学校ごとの公開口コミ件数の集計。
 * school_id が未設定・無効な口コミは school_name で紐付けるため、
 * サイトマップと薄いページ集計で同じロジックを共有する。
 */

export type SchoolIdentity = {
  id: string;
  name: string;
};

export type ReviewSchoolLink = {
  school_id: string | null;
  school_name: string | null;
  schools: { id: string; status: string | null } | { id: string; status: string | null }[] | null;
};

function addCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function countReviewsBySchool(
  schools: SchoolIdentity[],
  reviews: ReviewSchoolLink[]
): Map<string, number> {
  const counts = new Map<string, number>();
  const activeSchoolIds = new Set(schools.map((school) => school.id));
  const schoolsByName = new Map<string, SchoolIdentity[]>();

  for (const school of schools) {
    const list = schoolsByName.get(school.name) ?? [];
    list.push(school);
    schoolsByName.set(school.name, list);
  }

  for (const review of reviews) {
    const linkedSchool = Array.isArray(review.schools) ? review.schools[0] : review.schools;

    if (review.school_id && activeSchoolIds.has(review.school_id)) {
      addCount(counts, review.school_id);
      continue;
    }

    if (!review.school_name) continue;

    const matchedSchools = schoolsByName.get(review.school_name) ?? [];
    const pointsToInactiveOrMissingSchool =
      review.school_id && (!linkedSchool || linkedSchool.status !== 'active');

    if (!review.school_id || pointsToInactiveOrMissingSchool) {
      for (const school of matchedSchools) {
        addCount(counts, school.id);
      }
    }
  }

  return counts;
}
