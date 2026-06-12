// 公開側のコース一覧取得（published のみ・内部管理フィールドは取得しない）

import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClientWithLargeHeaders } from '@/lib/supabase/large-headers';
import {
  PUBLIC_COURSE_SELECT,
  type CourseItem,
  type PublicCourseListing,
} from '@/lib/types/courses';

function normalizeCourses(value: unknown): CourseItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (c): c is CourseItem =>
      Boolean(c) && typeof c === 'object' && typeof (c as CourseItem).name === 'string'
  );
}

function toPublicListing(row: Record<string, unknown>): PublicCourseListing {
  return {
    school_id: String(row.school_id),
    courses: normalizeCourses(row.courses),
    public_note: typeof row.public_note === 'string' ? row.public_note : null,
  };
}

/**
 * 複数学校の公開済みコース一覧を一括取得する（searchSchools 等の集計と同パターン）。
 * school_id → PublicCourseListing のマップを返す。
 */
export async function fetchPublicCourseListings(
  supabase: SupabaseClient,
  schoolIds: string[]
): Promise<Map<string, PublicCourseListing>> {
  const out = new Map<string, PublicCourseListing>();
  if (schoolIds.length === 0) return out;

  const { data } = await supabase
    .from('school_course_listings')
    .select(PUBLIC_COURSE_SELECT)
    .in('school_id', schoolIds)
    .eq('status', 'published');

  for (const row of (data as Record<string, unknown>[] | null) || []) {
    const listing = toPublicListing(row);
    if (listing.courses.length > 0) {
      out.set(listing.school_id, listing);
    }
  }
  return out;
}

/**
 * 単一学校の公開済みコース一覧を取得する（学校詳細ページ用）。
 */
export const getPublicCourseListing = cache(
  async (schoolId: string): Promise<PublicCourseListing | null> => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return null;

    const supabase = createSupabaseClientWithLargeHeaders(supabaseUrl, supabaseServiceKey);
    const map = await fetchPublicCourseListings(supabase, [schoolId]);
    return map.get(schoolId) ?? null;
  }
);
