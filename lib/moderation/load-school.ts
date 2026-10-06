import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeText } from '@/lib/utils';
import type { CampusLocation, SchoolModerationContext } from './types';

const SCHOOL_COLUMNS = 'id, name, status, institution_type, official_url, campus_locations';

export async function loadSchoolModerationContext(
  supabase: SupabaseClient,
  input: { schoolId: string | null; schoolName: string }
): Promise<SchoolModerationContext> {
  try {
    let row = input.schoolId ? await fetchSchoolById(supabase, input.schoolId) : null;
    if (!row && input.schoolName) row = await fetchSchoolByName(supabase, input.schoolName);
    const normalized = normalizeText(input.schoolName);
    if (!row && normalized) row = await fetchSchoolByNormalizedName(supabase, normalized);
    if (!row && normalized) row = await fetchSchoolByAlias(supabase, normalized);
    if (!row) return emptyContext('missing', input.schoolName);

    const [courseNames, tuitionText] = await Promise.all([
      fetchCourseNames(supabase, row.id),
      fetchTuitionText(supabase, row.id),
    ]);

    return {
      lookup: 'found',
      schoolId: row.id,
      schoolName: row.name,
      status: row.status,
      institutionType: row.institutionType,
      officialUrl: row.officialUrl,
      campusLocations: row.campusLocations,
      courseNames,
      tuitionText,
    };
  } catch (error) {
    console.error('[moderate] 学校材料の取得に失敗:', error);
    return emptyContext('error', input.schoolName);
  }
}

type SchoolRow = {
  id: string;
  name: string | null;
  status: string | null;
  institutionType: string | null;
  officialUrl: string | null;
  campusLocations: CampusLocation[];
};

async function fetchSchoolById(supabase: SupabaseClient, schoolId: string): Promise<SchoolRow | null> {
  const { data, error } = await supabase
    .from('schools')
    .select(SCHOOL_COLUMNS)
    .eq('id', schoolId)
    .maybeSingle();
  if (error) throw error;
  return data ? toSchoolRow(data) : null;
}

async function fetchSchoolByName(supabase: SupabaseClient, schoolName: string): Promise<SchoolRow | null> {
  const { data, error } = await supabase
    .from('schools')
    .select(SCHOOL_COLUMNS)
    .eq('name', schoolName)
    .limit(1);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return row ? toSchoolRow(row) : null;
}

async function fetchSchoolByNormalizedName(
  supabase: SupabaseClient,
  normalized: string
): Promise<SchoolRow | null> {
  const { data, error } = await supabase
    .from('schools')
    .select(SCHOOL_COLUMNS)
    .eq('name_normalized', normalized)
    .limit(1);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return row ? toSchoolRow(row) : null;
}

async function fetchSchoolByAlias(supabase: SupabaseClient, normalized: string): Promise<SchoolRow | null> {
  const { data, error } = await supabase
    .from('school_aliases')
    .select('school_id')
    .eq('alias_normalized', normalized)
    .maybeSingle();
  if (error) throw error;
  const schoolId = typeof data?.school_id === 'string' ? data.school_id : null;
  if (!schoolId) return null;
  return fetchSchoolById(supabase, schoolId);
}

async function fetchCourseNames(supabase: SupabaseClient, schoolId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('school_course_listings')
    .select('courses')
    .eq('school_id', schoolId)
    .eq('status', 'published')
    .limit(1);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return parseCourseNames(row?.courses);
}

async function fetchTuitionText(supabase: SupabaseClient, schoolId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('school_tuition_estimates')
    .select('display_mode, first_year_min, first_year_max, annual_min, annual_max, public_note')
    .eq('school_id', schoolId)
    .eq('status', 'published')
    .limit(1);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return formatTuition(row);
}

function toSchoolRow(row: Record<string, unknown>): SchoolRow {
  return {
    id: String(row.id),
    name: textOrNull(row.name),
    status: textOrNull(row.status),
    institutionType: textOrNull(row.institution_type),
    officialUrl: textOrNull(row.official_url),
    campusLocations: parseCampuses(row.campus_locations),
  };
}

function emptyContext(lookup: 'missing' | 'error', schoolName: string): SchoolModerationContext {
  return {
    lookup,
    schoolId: null,
    schoolName: schoolName || null,
    status: null,
    institutionType: null,
    officialUrl: null,
    campusLocations: [],
    courseNames: [],
    tuitionText: null,
  };
}

function parseCampuses(value: unknown): CampusLocation[] {
  if (!Array.isArray(value)) return [];
  const campuses: CampusLocation[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const prefecture = textOrNull(record.prefecture);
    if (!prefecture) continue;
    campuses.push({ prefecture, city: textOrNull(record.city) });
  }
  return campuses;
}

function parseCourseNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const name = textOrNull(record.name);
    if (!name) continue;
    const attendance = textOrNull(record.attendance);
    names.push(attendance ? `${name}（通学: ${attendance}）` : name);
  }
  return names;
}

function formatTuition(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  const parts: string[] = [];
  if (row.display_mode === 'varies') parts.push('コースにより金額が変動する');
  if (row.display_mode === 'contact_required') parts.push('金額は個別確認');
  const annual = rangeYen(row.annual_min, row.annual_max);
  if (annual) parts.push(`年間目安 ${annual}`);
  const firstYear = rangeYen(row.first_year_min, row.first_year_max);
  if (firstYear) parts.push(`初年度目安 ${firstYear}`);
  const note = textOrNull(row.public_note);
  if (note) parts.push(note);
  return parts.length > 0 ? parts.join('。') : null;
}

function rangeYen(min: unknown, max: unknown): string | null {
  const left = typeof min === 'number' ? min : null;
  const right = typeof max === 'number' ? max : null;
  if (left == null && right == null) return null;
  if (left != null && right != null && left !== right) {
    return `${left.toLocaleString('ja-JP')}〜${right.toLocaleString('ja-JP')}円`;
  }
  const one = left ?? right;
  return one == null ? null : `${one.toLocaleString('ja-JP')}円`;
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}
