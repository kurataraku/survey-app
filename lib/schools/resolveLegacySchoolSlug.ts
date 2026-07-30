import { cache } from 'react';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { normalizeText } from '@/lib/utils';
import { normalizeSlugValue } from '@/lib/schools/slug-history';

type ActiveSchoolRedirect = {
  id: string;
  slug: string | null;
  is_public: boolean | null;
  status: string | null;
};

type LegacySlugResolution = {
  slug: string;
};

function decodeSlugSegment(value: string): string {
  if (!value.includes('%')) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toResolution(row: ActiveSchoolRedirect | null | undefined): LegacySlugResolution | null {
  const slug = normalizeSlugValue(row?.slug);
  if (!slug || row?.status !== 'active' || row?.is_public !== true) return null;
  return { slug };
}

async function getActiveSchoolById(id: string): Promise<LegacySlugResolution | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('schools')
    .select('id, slug, is_public, status')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[resolveLegacySchoolSlug] active school lookup:', error);
    return null;
  }

  return toResolution(data as ActiveSchoolRedirect | null);
}

async function resolveMergedSchool(sourceSchoolId: string): Promise<LegacySlugResolution | null> {
  const supabase = createAdminSupabaseClient();
  const { data: sourceSchool, error: sourceError } = await supabase
    .from('schools')
    .select('name_normalized')
    .eq('id', sourceSchoolId)
    .maybeSingle();

  if (sourceError || !sourceSchool?.name_normalized) {
    if (sourceError) console.error('[resolveLegacySchoolSlug] merged source lookup:', sourceError);
    return null;
  }

  const { data: aliasRows, error } = await supabase
    .from('school_aliases')
    .select('school_id')
    .eq('alias_normalized', sourceSchool.name_normalized)
    .limit(5);

  if (error) {
    console.error('[resolveLegacySchoolSlug] merged alias lookup:', error);
    return null;
  }

  for (const row of (aliasRows as { school_id: string | null }[] | null) ?? []) {
    if (!row.school_id || row.school_id === sourceSchoolId) continue;
    const resolved = await getActiveSchoolById(row.school_id);
    if (resolved) return resolved;
  }

  return null;
}

async function resolveBySlugHistory(decodedSlug: string): Promise<LegacySlugResolution | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('school_slug_history')
    .select('school_id, schools(id, slug, is_public, status)')
    .eq('old_slug', decodedSlug)
    .maybeSingle();

  if (error) {
    // マイグレーション未適用時は履歴解決をスキップする
    if (error.code !== 'PGRST205') {
      console.error('[resolveLegacySchoolSlug] slug history lookup:', error);
    }
    return null;
  }

  const school = Array.isArray(data?.schools) ? data?.schools[0] : data?.schools;
  return toResolution(school as ActiveSchoolRedirect | null);
}

async function resolveBySchoolName(decodedSlug: string): Promise<LegacySlugResolution | null> {
  const normalized = normalizeText(decodedSlug);
  if (!normalized) return null;

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('schools')
    .select('id, slug, is_public, status')
    .eq('name_normalized', normalized)
    .eq('status', 'active')
    .eq('is_public', true)
    .maybeSingle();

  if (error) {
    console.error('[resolveLegacySchoolSlug] school name lookup:', error);
    return null;
  }

  return toResolution(data as ActiveSchoolRedirect | null);
}

async function resolveByExactSlug(decodedSlug: string): Promise<LegacySlugResolution | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('schools')
    .select('id, slug, is_public, status')
    .eq('slug', decodedSlug)
    .maybeSingle();

  if (error) {
    console.error('[resolveLegacySchoolSlug] exact slug lookup:', error);
    return null;
  }

  const school = data as ActiveSchoolRedirect | null;
  const active = toResolution(school);
  if (active) return active;
  if (school?.id && school.status === 'merged') return resolveMergedSchool(school.id);

  return null;
}

async function resolveByAlias(decodedSlug: string): Promise<LegacySlugResolution | null> {
  const normalized = normalizeText(decodedSlug);
  if (!normalized) return null;

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from('school_aliases')
    .select('school_id, schools(id, slug, is_public, status)')
    .eq('alias_normalized', normalized)
    .limit(5);

  if (error) {
    console.error('[resolveLegacySchoolSlug] alias lookup:', error);
    return null;
  }

  for (const row of
    (data as Array<{ school_id: string | null; schools: ActiveSchoolRedirect | ActiveSchoolRedirect[] | null }> | null) ??
    []) {
    const school = Array.isArray(row.schools) ? row.schools[0] : row.schools;
    const resolved = toResolution(school);
    if (resolved) return resolved;
  }

  return null;
}

export const resolveLegacySchoolSlug = cache(
  async (rawSlug: string): Promise<LegacySlugResolution | null> => {
    const decodedSlug = decodeSlugSegment(rawSlug).trim();
    if (!decodedSlug) return null;

    const resolvers = [
      resolveBySlugHistory,
      resolveBySchoolName,
      resolveByExactSlug,
      resolveByAlias,
    ];

    for (const resolver of resolvers) {
      const resolved = await resolver(decodedSlug);
      if (resolved && resolved.slug !== decodedSlug) return resolved;
    }

    return null;
  }
);
