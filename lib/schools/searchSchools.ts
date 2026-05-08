import { cache } from 'react';
import { createSupabaseClientWithLargeHeaders } from '@/lib/supabase/large-headers';
import { normalizeText } from '@/lib/utils';
import { DEFAULT_SCHOOL_LIST_SORT } from '@/lib/schools/school-search-constants';

export interface SearchSchool {
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
  highlights: string[] | null;
  intro: string | null;
  review_count: number;
  overall_avg: number | null;
  latest_good_comment: string | null;
  latest_bad_comment: string | null;
  staff_avg: number | null;
  atmosphere_avg: number | null;
  credit_avg: number | null;
  tuition_avg: number | null;
  review_tendency: { good: string[]; improvement: string[] } | null;
}

export interface SearchSchoolsParams {
  q?: string;
  page?: number;
  limit?: number;
  prefecture?: string;
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
  status: string;
  slug: string | null;
  highlights: string[] | null;
  intro: string | null;
};

function parseRating(val: unknown): number | null {
  const n = typeof val === 'string' ? parseInt(val, 10) : typeof val === 'number' ? val : NaN;
  return !isNaN(n) && n >= 1 && n <= 5 && n !== 6 ? n : null;
}

export const searchSchools = cache(async (
  params: SearchSchoolsParams = {}
): Promise<SearchSchoolsResult> => {
  const {
    q = '',
    page = 1,
    limit = 20,
    prefecture = '',
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
  const normalizedQuery = q ? normalizeText(q) : '';
  const offset = (page - 1) * limit;

  let schoolsQuery = supabase
    .from('schools')
    .select('id, name, prefecture, prefectures, status, slug, highlights, intro')
    .eq('status', 'active')
    .eq('is_public', true);

  if (normalizedQuery) {
    schoolsQuery = schoolsQuery.ilike('name_normalized', `%${normalizedQuery}%`);
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
        schoolMap.set(school.id, { id: school.id, name: school.name, prefecture: pref, status: school.status, slug: school.slug, highlights: school.highlights ?? null, intro: school.intro ?? null });
      }
    }
  }

  if (normalizedQuery) {
    const { data: aliases } = await supabase
      .from('school_aliases')
      .select('school_id, alias')
      .ilike('alias_normalized', `%${normalizedQuery}%`)
      .limit(100);

    if (aliases?.length) {
      const schoolIds = aliases.map((a: { school_id: string }) => a.school_id);
      let aliasQuery = supabase
        .from('schools')
        .select('id, name, prefecture, prefectures, status, slug, highlights, intro')
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
          schoolMap.set(school.id, { id: school.id, name: school.name, prefecture: pref, status: school.status, slug: school.slug, highlights: school.highlights ?? null, intro: school.intro ?? null });
        }
      });
    }
  }

  let schoolsList = Array.from(schoolMap.values()).filter((s) => s.status === 'active');
  if (schoolsList.length === 0) {
    return { schools: [], total: 0, total_pages: 0, page, limit };
  }

  const schoolIds = schoolsList.map((s) => s.id);

  // 口コミデータ取得（カテゴリ評価・口コミ本文・投稿日も含む）
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
    staff: number[];
    atmosphere: number[];
    credit: number[];
    tuition: number[];
    latestGoodComment: { text: string; ts: string } | null;
    latestBadComment: { text: string; ts: string } | null;
  };

  const schoolStats = new Map<string, StatsEntry>();
  schoolIds.forEach((id) => schoolStats.set(id, { count: 0, overall: [], staff: [], atmosphere: [], credit: [], tuition: [], latestGoodComment: null as { text: string; ts: string } | null, latestBadComment: null as { text: string; ts: string } | null }));

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

      if (r.answers) {
        const ans = typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers;
        const sr = parseRating(ans.staff_rating); if (sr !== null) s.staff.push(sr);
        const ar = parseRating(ans.atmosphere_fit_rating); if (ar !== null) s.atmosphere.push(ar);
        const cr = parseRating(ans.credit_rating); if (cr !== null) s.credit.push(cr);
        const tr = parseRating(ans.tuition_rating); if (tr !== null) s.tuition.push(tr);
      }
    }
  }

  const avg = (arr: number[]) => arr.length ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : null;

  // AI要約（review_tendency）のパース
  const tendencyMap = new Map<string, { good: string[]; improvement: string[] }>();
  if (tendencyResult.data) {
    for (const t of tendencyResult.data) {
      try {
        const parsed = JSON.parse(t.summary_text) as { good_points?: string[]; improvement_points?: string[] };
        const good = Array.isArray(parsed.good_points) ? parsed.good_points.slice(0, 2) : [];
        const improvement = Array.isArray(parsed.improvement_points) ? parsed.improvement_points.slice(0, 2) : [];
        if (good.length > 0 || improvement.length > 0) tendencyMap.set(t.school_id, { good, improvement });
      } catch {}
    }
  }

  let schoolsWithStats: SearchSchool[] = schoolsList.map((school) => {
    const s = schoolStats.get(school.id) ?? { count: 0, overall: [] as number[], staff: [] as number[], atmosphere: [] as number[], credit: [] as number[], tuition: [] as number[], latestGoodComment: null as { text: string; ts: string } | null, latestBadComment: null as { text: string; ts: string } | null };
    return {
      id: school.id,
      name: school.name,
      prefecture: school.prefecture,
      slug: school.slug,
      highlights: school.highlights,
      intro: school.intro,
      review_count: s.count,
      overall_avg: avg(s.overall),
      latest_good_comment: s.latestGoodComment?.text ?? null,
      latest_bad_comment: s.latestBadComment?.text ?? null,
      staff_avg: avg(s.staff),
      atmosphere_avg: avg(s.atmosphere),
      credit_avg: avg(s.credit),
      tuition_avg: avg(s.tuition),
      review_tendency: tendencyMap.get(school.id) ?? null,
    };
  });

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
