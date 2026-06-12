import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { normalizeCampusLocations } from '@/lib/schools/campusLocations';
import type { SchoolCampusLocation, SchoolInstitutionType } from '@/lib/types/schools';

export interface RelatedSchool {
  id: string;
  name: string;
  prefecture: string;
  prefectures: string[] | null;
  institution_type: SchoolInstitutionType | null;
  campus_locations: SchoolCampusLocation[] | null;
  slug: string | null;
  highlights: string[] | null;
  intro: string | null;
  review_count: number;
  overall_avg: number | null;
  tuition_avg: number | null;
  support_avg: number | null;
  flexibility_avg: number | null;
}

interface GetRelatedSchoolsParams {
  schoolId: string;
  prefecture: string | null;
  prefectures?: string[] | null;
  limit?: number;
}

function parseRating(value: unknown): number | null {
  const n = typeof value === 'string' ? parseInt(value, 10) : typeof value === 'number' ? value : NaN;
  return !isNaN(n) && n >= 1 && n <= 5 && n !== 6 ? n : null;
}

function average(values: number[]): number | null {
  return values.length > 0
    ? parseFloat((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
    : null;
}

export async function getRelatedSchools({
  schoolId,
  prefecture,
  prefectures,
  limit = 6,
}: GetRelatedSchoolsParams): Promise<RelatedSchool[]> {
  const supabase = createAdminSupabaseClient();
  const comparisonPrefectures = new Set(
    [prefecture, ...(prefectures ?? [])].filter(
      (value): value is string => Boolean(value && value !== '不明')
    )
  );

  const { data: schoolsData, error } = await supabase
    .from('schools')
    .select('id, name, prefecture, prefectures, institution_type, campus_locations, slug, highlights, intro')
    .neq('id', schoolId)
    .eq('is_public', true)
    .eq('status', 'active')
    .limit(200);

  if (error || !schoolsData?.length) {
    if (error) console.error('[getRelatedSchools] schools:', error);
    return [];
  }

  const scoredSchools = schoolsData
    .map((school) => {
      const schoolPrefectures = new Set(
        [school.prefecture, ...((school.prefectures as string[] | null) ?? [])].filter(
          (value): value is string => Boolean(value && value !== '不明')
        )
      );
      const prefectureOverlap = [...comparisonPrefectures].some((pref) =>
        schoolPrefectures.has(pref)
      );
      const isWideAreaSchool = schoolPrefectures.size >= 8;
      const score = (prefectureOverlap ? 3 : 0) + (isWideAreaSchool ? 1 : 0);
      return { school, score, prefectureOverlap };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(limit * 4, 24));

  if (scoredSchools.length === 0) return [];

  const candidateIds = scoredSchools.map(({ school }) => school.id);
  const { data: reviewsData, error: reviewsError } = await supabase
    .from('survey_responses')
    .select('school_id, overall_satisfaction, answers')
    .in('school_id', candidateIds)
    .eq('is_public', true);

  if (reviewsError) {
    console.error('[getRelatedSchools] survey_responses:', reviewsError);
  }

  const stats = new Map<
    string,
    {
      count: number;
      overall: number[];
      tuition: number[];
      support: number[];
      flexibility: number[];
    }
  >();
  candidateIds.forEach((id) =>
    stats.set(id, { count: 0, overall: [], tuition: [], support: [], flexibility: [] })
  );

  for (const review of reviewsData ?? []) {
    const entry = stats.get(review.school_id);
    if (!entry) continue;
    entry.count++;
    const overall = parseRating(review.overall_satisfaction);
    if (overall !== null) entry.overall.push(overall);
    let answers: unknown = review.answers;
    if (typeof answers === 'string') {
      try {
        answers = JSON.parse(answers);
      } catch {
        answers = null;
      }
    }
    if (answers && typeof answers === 'object') {
      const answerRecord = answers as Record<string, unknown>;
      const tuition = parseRating(answerRecord.tuition_rating);
      const support = parseRating(answerRecord.support_rating);
      const flexibility = parseRating(answerRecord.flexibility_rating);
      if (tuition !== null) entry.tuition.push(tuition);
      if (support !== null) entry.support.push(support);
      if (flexibility !== null) entry.flexibility.push(flexibility);
    }
  }

  return scoredSchools
    .map(({ school, score }) => {
      const entry = stats.get(school.id);
      const reviewCount = entry?.count ?? 0;
      return {
        id: school.id,
        name: school.name,
        prefecture: school.prefecture,
        prefectures: (school.prefectures as string[] | null) ?? null,
        institution_type: (school.institution_type as SchoolInstitutionType | null) ?? null,
        campus_locations: normalizeCampusLocations(school.campus_locations),
        slug: school.slug,
        highlights: Array.isArray(school.highlights) ? school.highlights : null,
        intro: school.intro,
        review_count: reviewCount,
        overall_avg: average(entry?.overall ?? []),
        tuition_avg: average(entry?.tuition ?? []),
        support_avg: average(entry?.support ?? []),
        flexibility_avg: average(entry?.flexibility ?? []),
        sortScore: score * 1000 + reviewCount * 10 + (average(entry?.overall ?? []) ?? 0),
      };
    })
    .sort((a, b) => b.sortScore - a.sortScore)
    .slice(0, limit)
    .map((school) => ({
      id: school.id,
      name: school.name,
      prefecture: school.prefecture,
      prefectures: school.prefectures,
      institution_type: school.institution_type,
      campus_locations: school.campus_locations,
      slug: school.slug,
      highlights: school.highlights,
      intro: school.intro,
      review_count: school.review_count,
      overall_avg: school.overall_avg,
      tuition_avg: school.tuition_avg,
      support_avg: school.support_avg,
      flexibility_avg: school.flexibility_avg,
    }));
}
