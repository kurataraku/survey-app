import type { SupabaseClient } from '@supabase/supabase-js';
import type { SeoLoopConfig } from './config';
import type { ProposalPayload } from './types';

function startOfUtcDay(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

async function countSince(
  supabase: SupabaseClient,
  table: string,
  sinceIso: string
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sinceIso);

  if (error) throw error;
  return count ?? 0;
}

/** 当日あと何件proposalを作れるか。0以下なら生成を止める */
export async function remainingDailyProposalBudget(
  supabase: SupabaseClient,
  config: SeoLoopConfig
): Promise<number> {
  const proposalCount = await countSince(supabase, 'seo_proposals', startOfUtcDay());
  return Math.max(0, config.maxDailyProposals - proposalCount);
}

export async function assertProposalLimits(
  supabase: SupabaseClient,
  config: SeoLoopConfig,
  payload: ProposalPayload
): Promise<void> {
  if (payload.targets.length > config.maxTargetsPerProposal) {
    throw new Error(
      `1 proposal あたりの対象上限を超えています: ${payload.targets.length}/${config.maxTargetsPerProposal}`
    );
  }

  const proposalCount = await countSince(supabase, 'seo_proposals', startOfUtcDay());
  if (proposalCount >= config.maxDailyProposals) {
    throw new Error(
      `1日あたりのproposal上限に達しています: ${proposalCount}/${config.maxDailyProposals}`
    );
  }
}

export async function assertExecutionLimits(
  supabase: SupabaseClient,
  config: SeoLoopConfig
): Promise<void> {
  const { count: executionCount, error } = await supabase
    .from('seo_experiments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'executed')
    .gte('executed_at', startOfUtcDay());
  if (error) throw error;
  const count = executionCount ?? 0;
  if (count >= config.maxDailyExecutions) {
    throw new Error(
      `1日あたりのexecution上限に達しています: ${count}/${config.maxDailyExecutions}`
    );
  }
}
