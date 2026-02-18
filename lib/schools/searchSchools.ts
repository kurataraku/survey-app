import { cache } from 'react';
import { createSupabaseClientWithLargeHeaders } from '@/lib/supabase/large-headers';
import { normalizeText } from '@/lib/utils';

export interface SearchSchool {
  id: string;
  name: string;
  prefecture: string;
  slug: string | null;
  review_count: number;
  overall_avg: number | null;
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
    sort = 'name',
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
    .select('id, name, prefecture, prefectures, status, slug')
    .eq('status', 'active')
    .eq('is_public', true);

  if (normalizedQuery) {
    schoolsQuery = schoolsQuery.ilike('name_normalized', `%${normalizedQuery}%`);
  }
  if (prefecture) {
    schoolsQuery = schoolsQuery.or(`prefecture.eq.${prefecture},prefectures.cs.{${prefecture}}`);
  }

  const { data: schoolsByName } = await schoolsQuery;

  const schoolMap = new Map<string, { id: string; name: string; prefecture: string; status: string; slug: string | null }>();

  if (schoolsByName) {
    for (const school of schoolsByName) {
      if (school.status === 'active') {
        const pref = school.prefecture || (Array.isArray(school.prefectures) && school.prefectures[0]) || '不明';
        schoolMap.set(school.id, { id: school.id, name: school.name, prefecture: pref, status: school.status, slug: school.slug });
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
        .select('id, name, prefecture, prefectures, status, slug')
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
          schoolMap.set(school.id, { id: school.id, name: school.name, prefecture: pref, status: school.status, slug: school.slug });
        }
      });
    }
  }

  let schoolsList = Array.from(schoolMap.values()).filter((s) => s.status === 'active');
  if (schoolsList.length === 0) {
    return { schools: [], total: 0, total_pages: 0, page, limit };
  }

  const schoolIds = schoolsList.map((s) => s.id);
  const { data: statsData } = await supabase
    .from('survey_responses')
    .select('school_id, overall_satisfaction')
    .in('school_id', schoolIds)
    .eq('is_public', true);

  const statsMap = new Map<string, { review_count: number; overall_avg: number | null }>();
  schoolIds.forEach((id) => statsMap.set(id, { review_count: 0, overall_avg: null }));

  if (statsData) {
    const schoolStats = new Map<string, { ratings: number[]; count: number }>();
    statsData.forEach((r) => {
      if (!schoolStats.has(r.school_id)) schoolStats.set(r.school_id, { ratings: [], count: 0 });
      const s = schoolStats.get(r.school_id)!;
      s.count++;
      if (r.overall_satisfaction != null && r.overall_satisfaction !== 6 && r.overall_satisfaction >= 1 && r.overall_satisfaction <= 5) {
        s.ratings.push(r.overall_satisfaction);
      }
    });
    schoolStats.forEach((s, id) => {
      const avg = s.ratings.length ? parseFloat((s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length).toFixed(2)) : null;
      statsMap.set(id, { review_count: s.count, overall_avg: avg });
    });
  }

  let schoolsWithStats: SearchSchool[] = schoolsList.map((school) => {
    const stats = statsMap.get(school.id) || { review_count: 0, overall_avg: null };
    return {
      id: school.id,
      name: school.name,
      prefecture: school.prefecture,
      slug: school.slug,
      review_count: stats.review_count,
      overall_avg: stats.overall_avg,
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
  } else {
    schoolsWithStats.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }

  const total = schoolsWithStats.length;
  const totalPages = Math.ceil(total / limit);
  const paginated = schoolsWithStats.slice(offset, offset + limit);

  return { schools: paginated, total, total_pages: totalPages, page, limit };
});
