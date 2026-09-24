import type { SupabaseClient } from '@supabase/supabase-js';
import { proposalPayloadV2Schema, type TypedAction } from './types';

/** 未完了提案が同じ対象を押さえ続ける期間 */
const UNFINISHED_WINDOW_DAYS = 7;

/** 承認待ち・承認済みで、まだ実行も却下もされていない提案 */
const UNFINISHED_STATUSES = ['pending_approval', 'approved'];

export function normalizedTargetKey(
  type: string,
  id: string,
  urlValue: string
): string {
  const url = new URL(urlValue);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return `${type}:${id}:${url.toString()}`;
}

export function proposalLockKey(action: string, targetKey: string): string {
  return `${action}|${targetKey}`;
}

export function targetTypeForAction(
  action: TypedAction
): 'school' | 'feature' | 'url' {
  if (action === 'updateFeatureMetaDescription') return 'feature';
  if (action === 'addApprovedInternalLink') return 'url';
  return 'school';
}

/**
 * 未完了提案が押さえているaction×対象の集合。
 * 分析時は生成前のスキップ判定に、評価時は重複提案の検出に使う。
 */
export async function loadUnfinishedProposalLocks(params: {
  supabase: SupabaseClient;
  action?: TypedAction;
  excludeProposalId?: string;
}): Promise<Set<string>> {
  const since = new Date(
    Date.now() - UNFINISHED_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  let query = params.supabase
    .from('seo_proposals')
    .select('id,action,payload')
    .in('status', UNFINISHED_STATUSES)
    .gte('created_at', since);
  if (params.action) query = query.eq('action', params.action);
  if (params.excludeProposalId) query = query.neq('id', params.excludeProposalId);

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  const locks = new Set<string>();
  for (const row of data ?? []) {
    const parsed = proposalPayloadV2Schema.safeParse(row.payload);
    if (!parsed.success) continue;
    for (const target of parsed.data.targets) {
      locks.add(
        proposalLockKey(
          parsed.data.action,
          normalizedTargetKey(target.type, target.id, target.url)
        )
      );
    }
  }
  return locks;
}
