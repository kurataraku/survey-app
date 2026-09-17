import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getSeoLoopConfig } from '../lib/seo-loop/config';
import {
  evaluateProposalForApproval,
  type ProposalForEvaluation,
} from '../lib/seo-loop/evaluation/evaluate';
import { proposalPayloadV2Schema } from '../lib/seo-loop/types';

type Candidate = ProposalForEvaluation & {
  status: string;
  created_at: string;
  seo_approvals: Array<{
    id: string;
    status: string;
    proposal_version: number;
    proposal_payload_hash: string;
  }>;
};

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function targetActionKey(candidate: Candidate): string | null {
  const parsed = proposalPayloadV2Schema.safeParse(candidate.payload);
  if (!parsed.success || parsed.data.targets.length !== 1) return null;
  const target = parsed.data.targets[0]!;
  return `${candidate.action}:${target.type}:${target.id}:${target.url}`;
}

async function main(): Promise<void> {
  loadEnv({ path: '.env.local' });
  if (
    process.env.NEXT_PUBLIC_SITE_URL?.includes('localhost') &&
    process.env.GSC_SITE_URL
  ) {
    process.env.NEXT_PUBLIC_SITE_URL = new URL(process.env.GSC_SITE_URL).origin;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase service role環境変数が不足しています');
  }

  const apply = hasFlag('--apply');
  if (apply && !hasFlag('--yes')) {
    throw new Error('本番で再キューするには --apply --yes が必要です');
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from('seo_proposals')
    .select(
      'id,run_id,version,payload_hash,action,payload,context_snapshot,rulebook_version,rulebook_hash,status,created_at,seo_approvals!inner(id,status,proposal_version,proposal_payload_hash)'
    )
    .eq('status', 'execution_blocked')
    .eq('seo_approvals.status', 'approved')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;

  const unique = new Map<string, Candidate>();
  for (const row of (data ?? []) as Candidate[]) {
    const key = targetActionKey(row);
    if (!key || unique.has(key)) continue;
    const hasMatchingApproval = row.seo_approvals.some(
      (approval) =>
        approval.status === 'approved' &&
        approval.proposal_version === row.version &&
        approval.proposal_payload_hash === row.payload_hash
    );
    if (hasMatchingApproval) unique.set(key, row);
  }

  const config = getSeoLoopConfig();
  const eligible: Candidate[] = [];
  const blocked: Array<{ id: string; reasons: string[] }> = [];
  for (const candidate of unique.values()) {
    const evaluation = await evaluateProposalForApproval({
      supabase,
      config,
      proposal: candidate,
      forceFresh: true,
      phase: 'execution',
      persist: apply,
    });
    if (evaluation.passed) {
      eligible.push(candidate);
    } else {
      blocked.push({ id: candidate.id, reasons: evaluation.blockReasons });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        uniqueApprovedBlocked: unique.size,
        eligible: eligible.map((item) => ({
          id: item.id,
          runId: item.run_id,
          action: item.action,
          createdAt: item.created_at,
        })),
        blocked,
      },
      null,
      2
    )
  );

  if (!apply || eligible.length === 0) return;

  const runIds = [...new Set(eligible.map((item) => item.run_id))];
  const proposalIds = eligible.map((item) => item.id);
  const { error: proposalError } = await supabase
    .from('seo_proposals')
    .update({ status: 'approved' })
    .in('id', proposalIds)
    .eq('status', 'execution_blocked');
  if (proposalError) throw proposalError;

  const { error: runError } = await supabase
    .from('seo_loop_runs')
    .update({
      status: 'executing',
      current_step: 'execute',
      completed_at: null,
      next_action_at: new Date().toISOString(),
      error_message: null,
    })
    .in('id', runIds);
  if (runError) throw runError;

  console.log(`再実行対象へ戻しました: proposals=${proposalIds.length}, runs=${runIds.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
