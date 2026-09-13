import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

type ProposalRow = {
  id: string;
  run_id: string;
  issue_id: string | null;
  action: string;
  status: string;
  revision_number: number;
  revision_retry_count: number;
  revision_error: string | null;
  revision_next_action_at: string | null;
  revision_resolved_at: string | null;
  updated_at: string | null;
};

type FeedbackRow = {
  id: string;
  proposal_id: string;
  decision: string;
  category: string;
  reason: string;
  desired_change: string | null;
  general_rule_candidate: boolean;
  created_at: string;
};

type TraceRow = {
  parent_proposal_id: string;
  feedback_id: string;
  cycle: number;
  attempt: number;
  status: string;
  error_message: string | null;
  created_at: string;
};

function numberArg(name: string, fallback: number): number {
  const raw = process.argv.find((value) => value.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const value = Number(raw.slice(name.length + 3));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`--${name} は正の数で指定してください`);
  }
  return Math.floor(value);
}

async function main(): Promise<void> {
  loadEnv({ path: '.env.local' });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Supabase service role環境変数が不足しています');
  }
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const limit = numberArg('limit', 20);

  const { data: proposals, error: proposalError } = await supabase
    .from('seo_proposals')
    .select(
      'id,run_id,issue_id,action,status,revision_number,revision_retry_count,revision_error,revision_next_action_at,revision_resolved_at,updated_at'
    )
    .in('status', ['revision_requested', 'rejected', 'failed'])
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (proposalError) throw proposalError;

  const proposalRows = (proposals ?? []) as ProposalRow[];
  const proposalIds = proposalRows.map((proposal) => proposal.id);
  const { data: feedbacks, error: feedbackError } =
    proposalIds.length > 0
      ? await supabase
          .from('seo_feedback')
          .select(
            'id,proposal_id,decision,category,reason,desired_change,general_rule_candidate,created_at'
          )
          .in('proposal_id', proposalIds)
          .order('created_at', { ascending: false })
      : { data: [], error: null };
  if (feedbackError) throw feedbackError;

  const feedbackRows = (feedbacks ?? []) as FeedbackRow[];
  const feedbackIds = feedbackRows.map((feedback) => feedback.id);
  const { data: traces, error: traceError } =
    feedbackIds.length > 0
      ? await supabase
          .from('seo_revision_traces')
          .select(
            'parent_proposal_id,feedback_id,cycle,attempt,status,error_message,created_at'
          )
          .in('feedback_id', feedbackIds)
          .order('created_at', { ascending: false })
      : { data: [], error: null };
  if (traceError) throw traceError;

  const traceRows = (traces ?? []) as TraceRow[];
  const items = proposalRows.map((proposal) => {
    const proposalFeedbacks = feedbackRows.filter(
      (feedback) => feedback.proposal_id === proposal.id
    );
    const latestFeedback = proposalFeedbacks[0] ?? null;
    const latestTrace =
      latestFeedback === null
        ? null
        : traceRows.find((trace) => trace.feedback_id === latestFeedback.id) ?? null;
    return {
      proposal,
      latestFeedback,
      latestTrace,
      traceCount: traceRows.filter(
        (trace) => trace.parent_proposal_id === proposal.id
      ).length,
    };
  });

  console.log(JSON.stringify({ count: items.length, items }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
