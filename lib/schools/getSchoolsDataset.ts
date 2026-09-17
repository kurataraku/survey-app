import { unstable_cache } from 'next/cache';
import { createSupabaseClientWithLargeHeaders } from '@/lib/supabase/large-headers';
import { normalizeCampusLocations } from '@/lib/schools/campusLocations';
import {
  fetchSearchSchoolsWithStats,
  type SchoolEntry,
  type SearchSchool,
} from '@/lib/schools/searchSchools';
import type { SchoolInstitutionType } from '@/lib/types/schools';

/**
 * 公開中の全学校を口コミ・評価付きで1回だけ取得する共有データセット。
 *
 * 地域LPは都道府県ごとに同じ問い合わせを繰り返さず、このデータセットから導出する。
 * 一覧で本文を表示しないため intro は取得せず、キャッシュ上限（2MB）に収まる大きさに保つ。
 */
const SCHOOL_DATASET_COLUMNS =
  'id, name, prefecture, prefectures, institution_type, campus_locations, status, slug, highlights';

async function fetchSchoolsDataset(): Promise<SearchSchool[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return [];

  const supabase = createSupabaseClientWithLargeHeaders(supabaseUrl, supabaseServiceKey);
  const { data, error } = await supabase
    .from('schools')
    .select(SCHOOL_DATASET_COLUMNS)
    .eq('status', 'active')
    .eq('is_public', true);

  if (error) throw error;

  const rows: SchoolEntry[] = (data ?? [])
    .filter((row) => row.status === 'active')
    .map((row) => ({
      id: row.id,
      name: row.name,
      prefecture:
        row.prefecture || (Array.isArray(row.prefectures) && row.prefectures[0]) || '不明',
      prefectures: Array.isArray(row.prefectures) ? row.prefectures : null,
      institution_type: (row.institution_type as SchoolInstitutionType | null) ?? null,
      campus_locations: normalizeCampusLocations(row.campus_locations),
      status: row.status,
      slug: row.slug,
      highlights: row.highlights ?? null,
      intro: null,
    }));

  if (rows.length === 0) return [];

  return fetchSearchSchoolsWithStats(supabase, rows);
}

export const getSchoolsDataset = unstable_cache(fetchSchoolsDataset, ['schools-dataset-v1'], {
  revalidate: 3600,
});
