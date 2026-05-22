import { cache } from 'react';
import { createSupabaseClientWithLargeHeaders } from '@/lib/supabase/large-headers';
import { getNormalizedSchoolSearchTerms } from '@/lib/utils';
import { DEFAULT_SCHOOL_LIST_SORT } from '@/lib/schools/school-search-constants';
import type { SchoolCampusLocation, SchoolInstitutionType } from '@/lib/types/schools';

export interface SearchSchool {
  id: string;
  name: string;
  prefecture: string;
  /** DBの prefectures（対応都道府県）。一覧カードの所在地表示に利用 */
  prefectures: string[] | null;
  institution_type: SchoolInstitutionType | null;
  campus_locations: SchoolCampusLocation[] | null;
  slug: string | null;
  highlights: string[] | null;
  intro: string | null;
  review_count: number;
  overall_avg: number | null;
  latest_good_comment: string | null;
  latest_bad_comment: string | null;
  review_excerpts: Array<{ good: string | null; bad: string | null }>;
  flexibility_avg: number | null;
  staff_avg: number | null;
  support_avg: number | null;
  atmosphere_avg: number | null;
  credit_avg: number | null;
  unique_course_avg: number | null;
  career_support_avg: number | null;
  campus_life_avg: number | null;
  tuition_avg: number | null;
  review_tendency: { good: string[]; improvement: string[] } | null;
}

export interface SearchSchoolsParams {
  q?: string;
  page?: number;
  limit?: number;
  prefecture?: string;
  campus_prefecture?: string;
  campus_city?: string;
  min_rating?: number | null;
  min_review_count?: number | null;
  sort?: string;
}

export interface SearchSchoolsResult {
  schools: SearchSchool[];
  total: number;
  total_pages: number;
  page: number;
  limit: number;
}

type SchoolEntry = {
  id: string;
  name: string;
  prefecture: string;
  prefectures: string[] | null;
  institution_type: SchoolInstitutionType | null;
  campus_locations: SchoolCampusLocation[] | null;
  status: string;
  slug: string | null;
  highlights: string[] | null;
  intro: string | null;
};

function parseRating(val: unknown): number | null {
  const n = typeof val === 'string' ? parseInt(val, 10) : typeof val === 'number' ? val : NaN;
  return !isNaN(n) && n >= 1 && n <= 5 && n !== 6 ? n : null;
}

function normalizeCampusLocations(value: unknown): SchoolCampusLocation[] | null {
  if (!Array.isArray(value)) return null;
  const locations = value
    .map((location) => {
      if (!location || typeof location !== 'object') return null;
      const record = location as Record<string, unknown>;
      const prefecture = typeof record.prefecture === 'string' ? record.prefecture.trim() : '';
      const city = typeof record.city === 'string' ? record.city.trim() : '';
      return prefecture && city ? { prefecture, city } : null;
    })
    .filter((location): location is SchoolCampusLocation => Boolean(location));
  return locations.length > 0 ? locations : null;
}

type SupabaseForSchools = ReturnType<typeof createSupabaseClientWithLargeHeaders>;

/**
 * 学校マスタ行に対し、公開口コミ・項目別評価・傾向を付与して SearchSchool 配列を返す（searchSchools と共有）
 */
async function fetchSearchSchoolsWithStats(
  supabase: SupabaseForSchools,
  schoolsList: SchoolEntry[]
): Promise<SearchSchool[]> {
  if (schoolsList.length === 0) return [];

  const schoolIds = schoolsList.map((s) => s.id);

  const [statsResult, tendencyResult] = await Promise.all([
    supabase
      .from('survey_responses')
      .select('school_id, overall_satisfaction, good_comment, bad_comment, created_at, answers')
      .in('school_id', schoolIds)
      .eq('is_public', true),
    supabase
      .from('school_ai_summaries')
      .select('school_id, summary_text')
      .in('school_id', schoolIds)
      .eq('kind', 'review_tendency')
      .is('topic', null)
      .eq('status', 'published'),
  ]);

  type StatsEntry = {
    count: number;
    overall: number[];
    flexibility: number[];
    staff: number[];
    support: number[];
    atmosphere: number[];
    credit: number[];
    uniqueCourse: number[];
    careerSupport: number[];
    campusLife: number[];
    tuition: number[];
    latestGoodComment: { text: string; ts: string } | null;
    latestBadComment: { text: string; ts: string } | null;
    latestReviewExcerpts: Array<{ good: string | null; bad: string | null; ts: string }>;
  };

  const schoolStats = new Map<string, StatsEntry>();
  schoolIds.forEach((id) =>
    schoolStats.set(id, {
      count: 0,
      overall: [],
      flexibility: [],
      staff: [],
      support: [],
      atmosphere: [],
      credit: [],
      uniqueCourse: [],
      careerSupport: [],
      campusLife: [],
      tuition: [],
      latestGoodComment: null,
      latestBadComment: null,
      latestReviewExcerpts: [],
    })
  );

  if (statsResult.data) {
    for (const r of statsResult.data) {
      const s = schoolStats.get(r.school_id);
      if (!s) continue;
      s.count++;
      const ov = parseRating(r.overall_satisfaction);
      if (ov !== null) s.overall.push(ov);

      if (r.good_comment?.trim()) {
        if (!s.latestGoodComment || r.created_at > s.latestGoodComment.ts) {
          s.latestGoodComment = { text: r.good_comment.trim(), ts: r.created_at };
        }
      }
      if (r.bad_comment?.trim()) {
        if (!s.latestBadComment || r.created_at > s.latestBadComment.ts) {
          s.latestBadComment = { text: r.bad_comment.trim(), ts: r.created_at };
        }
      }
      const good = r.good_comment?.trim() || null;
      const bad = r.bad_comment?.trim() || null;
      if (good || bad) {
        s.latestReviewExcerpts.push({ good, bad, ts: r.created_at });
      }

      if (r.answers) {
        try {
          const ans = typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers;
          const fr = parseRating(ans.flexibility_rating);
          if (fr !== null) s.flexibility.push(fr);
          const sr = parseRating(ans.staff_rating);
          if (sr !== null) s.staff.push(sr);
          const spr = parseRating(ans.support_rating);
          if (spr !== null) s.support.push(spr);
          const ar = parseRating(ans.atmosphere_fit_rating);
          if (ar !== null) s.atmosphere.push(ar);
          const cr = parseRating(ans.credit_rating);
          if (cr !== null) s.credit.push(cr);
          const ur = parseRating(ans.unique_course_rating);
          if (ur !== null) s.uniqueCourse.push(ur);
          const car = parseRating(ans.career_support_rating);
          if (car !== null) s.careerSupport.push(car);
          const clr = parseRating(ans.campus_life_rating);
          if (clr !== null) s.campusLife.push(clr);
          const tr = parseRating(ans.tuition_rating);
          if (tr !== null) s.tuition.push(tr);
        } catch {
          // ignore malformed answers
        }
      }
    }
  }

  const avg = (arr: number[]) =>
    arr.length ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : null;

  const tendencyMap = new Map<string, { good: string[]; improvement: string[] }>();
  if (tendencyResult.data) {
    for (const t of tendencyResult.data) {
      try {
        const parsed = JSON.parse(t.summary_text) as {
          good_points?: string[];
          improvement_points?: string[];
        };
        const good = Array.isArray(parsed.good_points) ? parsed.good_points.slice(0, 2) : [];
        const improvement = Array.isArray(parsed.improvement_points)
          ? parsed.improvement_points.slice(0, 2)
          : [];
        if (good.length > 0 || improvement.length > 0) tendencyMap.set(t.school_id, { good, improvement });
      } catch {
        // ignore
      }
    }
  }

  return schoolsList.map((school) => {
    const s =
      schoolStats.get(school.id) ??
      ({
        count: 0,
        overall: [] as number[],
        flexibility: [] as number[],
        staff: [] as number[],
        support: [] as number[],
        atmosphere: [] as number[],
        credit: [] as number[],
        uniqueCourse: [] as number[],
        careerSupport: [] as number[],
        campusLife: [] as number[],
        tuition: [] as number[],
        latestGoodComment: null as { text: string; ts: string } | null,
        latestBadComment: null as { text: string; ts: string } | null,
        latestReviewExcerpts: [] as Array<{ good: string | null; bad: string | null; ts: string }>,
      } satisfies StatsEntry);
    const reviewExcerpts = [...s.latestReviewExcerpts]
      .sort((a, b) => b.ts.localeCompare(a.ts))
      .slice(0, 2)
      .map(({ good, bad }) => ({ good, bad }));
    return {
      id: school.id,
      name: school.name,
      prefecture: school.prefecture,
      prefectures: school.prefectures,
      institution_type: school.institution_type,
      campus_locations: school.campus_locations,
      slug: school.slug,
      highlights: school.highlights,
      intro: school.intro,
      review_count: s.count,
      overall_avg: avg(s.overall),
      latest_good_comment: s.latestGoodComment?.text ?? null,
      latest_bad_comment: s.latestBadComment?.text ?? null,
      review_excerpts: reviewExcerpts,
      flexibility_avg: avg(s.flexibility),
      staff_avg: avg(s.staff),
      support_avg: avg(s.support),
      atmosphere_avg: avg(s.atmosphere),
      credit_avg: avg(s.credit),
      unique_course_avg: avg(s.uniqueCourse),
      career_support_avg: avg(s.careerSupport),
      campus_life_avg: avg(s.campusLife),
      tuition_avg: avg(s.tuition),
      review_tendency: tendencyMap.get(school.id) ?? null,
    };
  });
}

/**
 * 学校IDの並びを保ったまま SearchSchool を一括取得（特集記事の関連学校など）
 */
export const getSearchSchoolsByIds = cache(async (ids: string[]): Promise<Map<string, SearchSchool>> => {
  const out = new Map<string, SearchSchool>();
  const uniqueOrdered: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    uniqueOrdered.push(id);
  }
  if (uniqueOrdered.length === 0) return out;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return out;

  const supabase = createSupabaseClientWithLargeHeaders(supabaseUrl, supabaseServiceKey);
  const { data: rows } = await supabase
    .from('schools')
    .select('*')
    .in('id', uniqueOrdered)
    .eq('status', 'active')
    .eq('is_public', true);

  const byId = new Map<string, SchoolEntry>();
  for (const row of rows || []) {
    if (row.status !== 'active') continue;
    const pref =
      row.prefecture || (Array.isArray(row.prefectures) && row.prefectures[0]) || '不明';
    byId.set(row.id, {
      id: row.id,
      name: row.name,
      prefecture: pref,
      prefectures: Array.isArray(row.prefectures) ? row.prefectures : null,
      institution_type: (row.institution_type as SchoolInstitutionType | null) ?? null,
      campus_locations: normalizeCampusLocations(row.campus_locations),
      status: row.status,
      slug: row.slug,
      highlights: row.highlights ?? null,
      intro: row.intro ?? null,
    });
  }

  const schoolsList = uniqueOrdered.map((id) => byId.get(id)).filter((s): s is SchoolEntry => Boolean(s));
  if (schoolsList.length === 0) return out;

  const hydrated = await fetchSearchSchoolsWithStats(supabase, schoolsList);
  for (const s of hydrated) {
    out.set(s.id, s);
  }
  return out;
});

export const searchSchools = cache(async (
  params: SearchSchoolsParams = {}
): Promise<SearchSchoolsResult> => {
  const {
    q = '',
    page = 1,
    limit = 20,
    prefecture = '',
    campus_prefecture = '',
    campus_city = '',
    min_rating = null,
    min_review_count = null,
    sort = DEFAULT_SCHOOL_LIST_SORT,
  } = params;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { schools: [], total: 0, total_pages: 0, page, limit };
  }

  const supabase = createSupabaseClientWithLargeHeaders(supabaseUrl, supabaseServiceKey);
  const normalizedTerms = getNormalizedSchoolSearchTerms(q);
  const filterTerms = normalizedTerms.filter((term) => !/[(),]/.test(term));
  const offset = (page - 1) * limit;

  let schoolsQuery = supabase
    .from('schools')
    .select('*')
    .eq('status', 'active')
    .eq('is_public', true);

  if (filterTerms.length > 0) {
    schoolsQuery = schoolsQuery.or(
      filterTerms.map((term) => `name_normalized.ilike.%${term}%`).join(',')
    );
  }
  if (prefecture) {
    schoolsQuery = schoolsQuery.or(`prefecture.eq.${prefecture},prefectures.cs.{${prefecture}}`);
  }

  const { data: schoolsByName } = await schoolsQuery;

  const schoolMap = new Map<string, SchoolEntry>();

  if (schoolsByName) {
    for (const school of schoolsByName) {
      if (school.status === 'active') {
        const pref = school.prefecture || (Array.isArray(school.prefectures) && school.prefectures[0]) || '不明';
        schoolMap.set(school.id, {
          id: school.id,
          name: school.name,
          prefecture: pref,
          prefectures: Array.isArray(school.prefectures) ? school.prefectures : null,
          institution_type: (school.institution_type as SchoolInstitutionType | null) ?? null,
          campus_locations: normalizeCampusLocations(school.campus_locations),
          status: school.status,
          slug: school.slug,
          highlights: school.highlights ?? null,
          intro: school.intro ?? null,
        });
      }
    }
  }

  if (filterTerms.length > 0) {
    const { data: aliases } = await supabase
      .from('school_aliases')
      .select('school_id, alias')
      .or(filterTerms.map((term) => `alias_normalized.ilike.%${term}%`).join(','))
      .limit(100);

    if (aliases?.length) {
      const schoolIds = aliases.map((a: { school_id: string }) => a.school_id);
      let aliasQuery = supabase
        .from('schools')
        .select('*')
        .in('id', schoolIds)
        .eq('status', 'active')
        .eq('is_public', true);
      if (prefecture) {
        aliasQuery = aliasQuery.or(`prefecture.eq.${prefecture},prefectures.cs.{${prefecture}}`);
      }
      const { data: aliasSchools } = await aliasQuery;
      aliasSchools?.forEach((school) => {
        if (school.status === 'active') {
          const pref = school.prefecture || (Array.isArray(school.prefectures) && school.prefectures[0]) || '不明';
          schoolMap.set(school.id, {
          id: school.id,
          name: school.name,
          prefecture: pref,
          prefectures: Array.isArray(school.prefectures) ? school.prefectures : null,
          institution_type: (school.institution_type as SchoolInstitutionType | null) ?? null,
          campus_locations: normalizeCampusLocations(school.campus_locations),
          status: school.status,
          slug: school.slug,
          highlights: school.highlights ?? null,
          intro: school.intro ?? null,
        });
        }
      });
    }
  }

  let schoolsList = Array.from(schoolMap.values()).filter((s) => s.status === 'active');
  if (campus_prefecture) {
    schoolsList = schoolsList.filter((school) =>
      school.campus_locations?.some((location) => location.prefecture === campus_prefecture)
    );
  }
  if (campus_city) {
    schoolsList = schoolsList.filter((school) =>
      school.campus_locations?.some((location) =>
        (!campus_prefecture || location.prefecture === campus_prefecture) &&
        location.city === campus_city
      )
    );
  }
  if (schoolsList.length === 0) {
    return { schools: [], total: 0, total_pages: 0, page, limit };
  }

  let schoolsWithStats = await fetchSearchSchoolsWithStats(supabase, schoolsList);

  if (min_rating != null) {
    schoolsWithStats = schoolsWithStats.filter((s) => s.overall_avg != null && s.overall_avg >= min_rating);
  }
  if (min_review_count != null) {
    schoolsWithStats = schoolsWithStats.filter((s) => s.review_count >= min_review_count);
  }

  if (sort === 'rating_desc') {
    schoolsWithStats.sort((a, b) => (b.overall_avg ?? 0) - (a.overall_avg ?? 0));
  } else if (sort === 'rating_asc') {
    schoolsWithStats.sort((a, b) => (a.overall_avg ?? 0) - (b.overall_avg ?? 0));
  } else if (sort === 'flexibility_desc') {
    schoolsWithStats.sort((a, b) => (b.flexibility_avg ?? 0) - (a.flexibility_avg ?? 0));
  } else if (sort === 'staff_desc') {
    schoolsWithStats.sort((a, b) => (b.staff_avg ?? 0) - (a.staff_avg ?? 0));
  } else if (sort === 'support_desc') {
    schoolsWithStats.sort((a, b) => (b.support_avg ?? 0) - (a.support_avg ?? 0));
  } else if (sort === 'atmosphere_desc') {
    schoolsWithStats.sort((a, b) => (b.atmosphere_avg ?? 0) - (a.atmosphere_avg ?? 0));
  } else if (sort === 'credit_desc') {
    schoolsWithStats.sort((a, b) => (b.credit_avg ?? 0) - (a.credit_avg ?? 0));
  } else if (sort === 'unique_course_desc') {
    schoolsWithStats.sort((a, b) => (b.unique_course_avg ?? 0) - (a.unique_course_avg ?? 0));
  } else if (sort === 'career_support_desc') {
    schoolsWithStats.sort((a, b) => (b.career_support_avg ?? 0) - (a.career_support_avg ?? 0));
  } else if (sort === 'campus_life_desc') {
    schoolsWithStats.sort((a, b) => (b.campus_life_avg ?? 0) - (a.campus_life_avg ?? 0));
  } else if (sort === 'tuition_desc') {
    schoolsWithStats.sort((a, b) => (b.tuition_avg ?? 0) - (a.tuition_avg ?? 0));
  } else if (sort === 'review_count_desc') {
    schoolsWithStats.sort((a, b) => b.review_count - a.review_count);
  } else if (sort === 'review_count_asc') {
    schoolsWithStats.sort((a, b) => a.review_count - b.review_count);
  } else if (sort === 'name') {
    schoolsWithStats.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  } else {
    schoolsWithStats.sort((a, b) => b.review_count - a.review_count);
  }

  const total = schoolsWithStats.length;
  const totalPages = Math.ceil(total / limit);
  const paginated = schoolsWithStats.slice(offset, offset + limit);

  return { schools: paginated, total, total_pages: totalPages, page, limit };
});
