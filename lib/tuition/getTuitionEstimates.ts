// 公開側の学費目安取得（published のみ・内部管理フィールドは取得しない）

import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseClientWithLargeHeaders } from '@/lib/supabase/large-headers';
import {
  PUBLIC_TUITION_SELECT,
  type PublicTuitionEstimate,
  type TuitionPlan,
} from '@/lib/types/tuition';

function normalizePlans(value: unknown): TuitionPlan[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is TuitionPlan => Boolean(p) && typeof p === 'object');
}

function toPublicEstimate(row: Record<string, unknown>): PublicTuitionEstimate {
  return {
    school_id: String(row.school_id),
    display_mode:
      row.display_mode === 'varies' || row.display_mode === 'contact_required'
        ? row.display_mode
        : 'amounts',
    first_year_min: typeof row.first_year_min === 'number' ? row.first_year_min : null,
    first_year_max: typeof row.first_year_max === 'number' ? row.first_year_max : null,
    annual_min: typeof row.annual_min === 'number' ? row.annual_min : null,
    annual_max: typeof row.annual_max === 'number' ? row.annual_max : null,
    monthly_min: typeof row.monthly_min === 'number' ? row.monthly_min : null,
    monthly_max: typeof row.monthly_max === 'number' ? row.monthly_max : null,
    plans: normalizePlans(row.plans),
    support_fund_note: typeof row.support_fund_note === 'string' ? row.support_fund_note : null,
    public_note: typeof row.public_note === 'string' ? row.public_note : null,
  };
}

/**
 * 複数学校の公開済み学費目安を一括取得する（searchSchools 等の集計と同パターン）。
 * 既存の Supabase クライアントを受け取り、school_id → PublicTuitionEstimate のマップを返す。
 */
export async function fetchPublicTuitionEstimates(
  supabase: SupabaseClient,
  schoolIds: string[]
): Promise<Map<string, PublicTuitionEstimate>> {
  const out = new Map<string, PublicTuitionEstimate>();
  if (schoolIds.length === 0) return out;

  const { data } = await supabase
    .from('school_tuition_estimates')
    .select(PUBLIC_TUITION_SELECT)
    .in('school_id', schoolIds)
    .eq('status', 'published');

  for (const row of (data as Record<string, unknown>[] | null) || []) {
    const estimate = toPublicEstimate(row);
    out.set(estimate.school_id, estimate);
  }
  return out;
}

/**
 * 単一学校の公開済み学費目安を取得する（学校詳細ページ用）。
 */
export const getPublicTuitionEstimate = cache(
  async (schoolId: string): Promise<PublicTuitionEstimate | null> => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return null;

    const supabase = createSupabaseClientWithLargeHeaders(supabaseUrl, supabaseServiceKey);
    const map = await fetchPublicTuitionEstimates(supabase, [schoolId]);
    return map.get(schoolId) ?? null;
  }
);
