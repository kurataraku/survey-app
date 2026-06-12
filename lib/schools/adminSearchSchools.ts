import type { SupabaseClient } from '@supabase/supabase-js';
import { getNormalizedSchoolSearchTerms, normalizeText } from '@/lib/utils';

export interface AdminSchoolSearchParams {
  q?: string;
  status?: string;
  prefecture?: string;
  page?: number;
  limit?: number;
}

export interface AdminSchoolSearchResult {
  schools: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

type SchoolRow = {
  id: string;
  name: string;
  name_normalized?: string | null;
  slug?: string | null;
};

/**
 * 連続一致しない検索語向けの AND セグメント。
 * 例: 「大原美空」→「大原学園美空高校」は「大原」「美空」が両方含まれる。
 */
export function getSchoolSearchAndSegments(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized || normalized.length < 4) return [];
  if (/[\s\u3000/／｜|,，、]/.test(text)) return [];

  const mid = Math.ceil(normalized.length / 2);
  const first = normalized.slice(0, mid);
  const second = normalized.slice(mid);
  const segments: string[] = [];
  if (first.length >= 2) segments.push(first);
  if (second.length >= 2 && second !== first) segments.push(second);
  return segments;
}

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

function schoolMatchesQuery(
  school: SchoolRow,
  filterTerms: string[],
  andSegments: string[],
  aliasNormals: string[]
): boolean {
  const normalizedName = school.name_normalized || normalizeText(school.name);
  const slug = (school.slug || '').toLowerCase();
  const searchable = [normalizedName, normalizeText(school.name), slug, ...aliasNormals];

  if (andSegments.length >= 2) {
    return andSegments.every((segment) => searchable.some((value) => value.includes(segment)));
  }

  if (filterTerms.length === 0) return true;

  return filterTerms.some((term) =>
    searchable.some((value) => value.includes(term) || value.toLowerCase().includes(term.toLowerCase()))
  );
}

function matchScore(
  school: SchoolRow,
  rawQuery: string,
  filterTerms: string[],
  andSegments: string[],
  aliasNormals: string[]
): number {
  const normalizedName = school.name_normalized || normalizeText(school.name);
  const normalizedQuery = normalizeText(rawQuery);
  let score = 0;

  if (normalizedQuery && normalizedName === normalizedQuery) score += 100;
  if (normalizedQuery && normalizedName.startsWith(normalizedQuery)) score += 50;
  if (normalizedQuery && normalizedName.includes(normalizedQuery)) score += 30;

  if (andSegments.length >= 2 && andSegments.every((segment) => normalizedName.includes(segment))) {
    score += 20;
  }

  for (const term of filterTerms) {
    if (normalizedName.includes(term)) score += 10;
    if (aliasNormals.some((alias) => alias.includes(term))) score += 8;
    if ((school.slug || '').toLowerCase().includes(term.toLowerCase())) score += 5;
  }

  return score;
}

export async function searchAdminSchools(
  supabase: SupabaseClient,
  params: AdminSchoolSearchParams = {}
): Promise<AdminSchoolSearchResult> {
  const { q = '', status = '', prefecture = '', page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  const normalizedTerms = getNormalizedSchoolSearchTerms(q);
  const filterTerms = normalizedTerms
    .map((term) => escapeIlikePattern(term))
    .filter((term) => term.length >= 2 && !/[(),]/.test(term));
  const andSegments = getSchoolSearchAndSegments(q).map(escapeIlikePattern);
  const hasSearch = q.trim().length > 0;

  const applyFilters = <T extends { eq: (col: string, val: string) => T }>(query: T): T => {
    let next = query;
    if (status) next = next.eq('status', status);
    if (prefecture) next = next.eq('prefecture', prefecture);
    return next;
  };

  if (!hasSearch) {
    let query = supabase.from('schools').select('*', { count: 'exact' });
    query = applyFilters(query);
    query = query.order('name', { ascending: true }).range(offset, offset + limit - 1);
    const { data, error, count } = await query;
    if (error) throw error;

    const total = count || 0;
    return {
      schools: data || [],
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  const dbTerms = [...new Set([...filterTerms, ...andSegments])];
  const orClauses = dbTerms.flatMap((term) => [
    `name_normalized.ilike.%${term}%`,
    `name.ilike.%${term}%`,
    `slug.ilike.%${term}%`,
  ]);

  let schoolsQuery = supabase.from('schools').select('*');
  schoolsQuery = applyFilters(schoolsQuery);
  if (orClauses.length > 0) {
    schoolsQuery = schoolsQuery.or(orClauses.join(','));
  }
  schoolsQuery = schoolsQuery.limit(500);

  const [{ data: candidateSchools, error: schoolsError }, { data: aliasHits, error: aliasError }] =
    await Promise.all([
      schoolsQuery,
      dbTerms.length > 0
        ? supabase
            .from('school_aliases')
            .select('school_id, alias_normalized')
            .or(dbTerms.map((term) => `alias_normalized.ilike.%${term}%`).join(','))
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (schoolsError) throw schoolsError;
  if (aliasError) throw aliasError;

  const schoolMap = new Map<string, Record<string, unknown>>();
  for (const school of candidateSchools || []) {
    schoolMap.set(school.id as string, school);
  }

  const aliasSchoolIds = [...new Set((aliasHits || []).map((row) => row.school_id as string))];
  const missingAliasIds = aliasSchoolIds.filter((id) => !schoolMap.has(id));

  if (missingAliasIds.length > 0) {
    let aliasSchoolsQuery = supabase.from('schools').select('*').in('id', missingAliasIds);
    aliasSchoolsQuery = applyFilters(aliasSchoolsQuery);
    const { data: aliasSchools, error: aliasSchoolsError } = await aliasSchoolsQuery;
    if (aliasSchoolsError) throw aliasSchoolsError;
    for (const school of aliasSchools || []) {
      schoolMap.set(school.id as string, school);
    }
  }

  const candidateIds = [...schoolMap.keys()];
  const aliasMap = new Map<string, string[]>();

  if (candidateIds.length > 0) {
    const { data: aliases, error: aliasesError } = await supabase
      .from('school_aliases')
      .select('school_id, alias_normalized')
      .in('school_id', candidateIds);

    if (aliasesError) throw aliasesError;

    for (const alias of aliases || []) {
      const schoolId = alias.school_id as string;
      const list = aliasMap.get(schoolId) || [];
      list.push(alias.alias_normalized as string);
      aliasMap.set(schoolId, list);
    }
  }

  const matched = [...schoolMap.values()]
    .filter((row) =>
      schoolMatchesQuery(
        row as SchoolRow,
        filterTerms,
        andSegments,
        aliasMap.get(row.id as string) || []
      )
    )
    .sort((a, b) => {
      const scoreA = matchScore(
        a as SchoolRow,
        q,
        filterTerms,
        andSegments,
        aliasMap.get(a.id as string) || []
      );
      const scoreB = matchScore(
        b as SchoolRow,
        q,
        filterTerms,
        andSegments,
        aliasMap.get(b.id as string) || []
      );
      if (scoreB !== scoreA) return scoreB - scoreA;
      return String(a.name).localeCompare(String(b.name), 'ja');
    });

  const total = matched.length;
  const paginated = matched.slice(offset, offset + limit);

  return {
    schools: paginated,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  };
}
