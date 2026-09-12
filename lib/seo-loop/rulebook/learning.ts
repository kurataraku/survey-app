import type { SupabaseClient } from '@supabase/supabase-js';
import { payloadHash } from '../hash';
import { notifySlackRulePatchApproval } from '../slack';
import {
  evaluateRulePatchQuality,
  nextStrictPatch,
  pathForFeedback,
  rulePatchHash,
  type RulePatchPath,
} from './patch';
import { rulebookContentSchema } from './schema';
import { isRulebookSchemaUnavailable } from './runtime';

const FEEDBACK_WINDOW_DAYS = 60;
const PATH_COOLDOWN_DAYS = 30;
const MIN_INDEPENDENT_ISSUES = 2;

type FeedbackRow = {
  id: string;
  proposal_id: string;
  category: string;
};

type ProposalRow = {
  id: string;
  issue_key: string | null;
  action: string;
};

export function collectIndependentPatchEvidence(
  feedbacks: FeedbackRow[],
  proposals: ProposalRow[]
): Array<{
  path: RulePatchPath;
  feedbackIds: string[];
  independentIssueKeyCount: number;
}> {
  const proposalById = new Map(
    proposals.map((proposal) => [proposal.id, proposal])
  );
  const grouped = new Map<
    RulePatchPath,
    Array<{ feedbackId: string; issueKey: string }>
  >();
  for (const feedback of feedbacks) {
    const proposal = proposalById.get(feedback.proposal_id);
    if (!proposal?.issue_key) continue;
    const path = pathForFeedback(feedback.category, proposal.action);
    if (!path) continue;
    const rows = grouped.get(path) ?? [];
    rows.push({ feedbackId: feedback.id, issueKey: proposal.issue_key });
    grouped.set(path, rows);
  }
  return [...grouped.entries()]
    .map(([path, rows]) => {
      const byIssue = new Map<string, string[]>();
      for (const row of rows) {
        const ids = byIssue.get(row.issueKey) ?? [];
        ids.push(row.feedbackId);
        byIssue.set(row.issueKey, ids);
      }
      const buckets = [...byIssue.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, ids]) => ids.sort());
      const feedbackIds: string[] = [];
      for (let index = 0; feedbackIds.length < 20; index += 1) {
        let added = false;
        for (const bucket of buckets) {
          if (bucket[index] && feedbackIds.length < 20) {
            feedbackIds.push(bucket[index]);
            added = true;
          }
        }
        if (!added) break;
      }
      return {
        path,
        feedbackIds,
        independentIssueKeyCount: Math.min(buckets.length, feedbackIds.length),
      };
    })
    .filter(
      (group) => group.independentIssueKeyCount >= MIN_INDEPENDENT_ISSUES
    )
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function isRulePatchEnabled(): boolean {
  const value = process.env.SEO_RULEBOOK_PATCH_ENABLED?.toLowerCase();
  return value === 'true' || value === '1';
}

async function generateCandidate(
  supabase: SupabaseClient
): Promise<number> {
  const { data: active, error: activeError } = await supabase
    .from('seo_rulebook_versions')
    .select('id,version,content_hash,content')
    .eq('status', 'active')
    .maybeSingle();
  if (activeError) throw activeError;
  const content = rulebookContentSchema.safeParse(active?.content);
  if (
    !active ||
    !content.success ||
    payloadHash(content.data) !== active.content_hash
  ) {
    return 0;
  }

  const since = new Date(
    Date.now() - FEEDBACK_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: feedbackData, error: feedbackError } = await supabase
    .from('seo_feedback')
    .select('id,proposal_id,category')
    .eq('general_rule_candidate', true)
    .is('rule_patch_consumed_at', null)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (feedbackError) throw feedbackError;
  const feedbacks = (feedbackData ?? []) as FeedbackRow[];
  if (feedbacks.length < MIN_INDEPENDENT_ISSUES) return 0;

  const available = feedbacks;
  if (available.length < MIN_INDEPENDENT_ISSUES) return 0;

  const { data: proposalData, error: proposalError } = await supabase
    .from('seo_proposals')
    .select('id,issue_id,action')
    .in(
      'id',
      available.map((feedback) => feedback.proposal_id)
    );
  if (proposalError) throw proposalError;
  const proposalRows = (proposalData ?? []) as Array<{
    id: string;
    issue_id: string | null;
    action: string;
  }>;
  const issueIds = [
    ...new Set(
      proposalRows
        .map((proposal) => proposal.issue_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (issueIds.length < MIN_INDEPENDENT_ISSUES) return 0;
  const { data: issueData, error: issueError } = await supabase
    .from('seo_issues')
    .select('id,issue_key')
    .in('id', issueIds);
  if (issueError) throw issueError;
  const issueKeyById = new Map(
    (issueData ?? []).map((issue) => [
      issue.id as string,
      issue.issue_key as string,
    ])
  );
  const groups = collectIndependentPatchEvidence(
    available,
    proposalRows.map((proposal) => ({
      id: proposal.id,
      action: proposal.action,
      issue_key: proposal.issue_id
        ? (issueKeyById.get(proposal.issue_id) ?? null)
        : null,
    }))
  );
  for (const group of groups) {
    const { path } = group;
    const cooldownSince = new Date(
      Date.now() - PATH_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const [eventResult, candidateResult] = await Promise.all([
      supabase
        .from('seo_rulebook_activation_events')
        .select('id')
        .eq('patch_path', path)
        .gte('created_at', cooldownSince)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('seo_rule_patch_candidates')
        .select('id')
        .eq('patch_path', path)
        .in('status', ['draft', 'pending_approval', 'shadowing', 'rejected'])
        .gte('created_at', cooldownSince)
        .limit(1)
        .maybeSingle(),
    ]);
    if (eventResult.error) throw eventResult.error;
    if (candidateResult.error) throw candidateResult.error;
    const event = eventResult.data;
    const recentCandidate = candidateResult.data;
    if (event || recentCandidate) continue;

    const patch = nextStrictPatch(content.data, path);
    if (!patch) continue;
    const quality = evaluateRulePatchQuality(content.data, patch);
    if (!quality.passed || !quality.proposedContent) continue;
    const proposedContent = quality.proposedContent;
    const feedbackIds = group.feedbackIds;
    const candidateKey = payloadHash({
      baseHash: active.content_hash,
      patch,
      feedbackIds,
    });
    const qualityResult = {
      version: 'rule-patch-quality-v1',
      passed: quality.passed,
      checks: {
        ...quality.checks,
        independentIssueKeyCount: group.independentIssueKeyCount,
        feedbackWindowDays: FEEDBACK_WINDOW_DAYS,
        cooldownDays: PATH_COOLDOWN_DAYS,
      },
    };
    const { data, error } = await supabase.rpc(
      'create_seo_rule_patch_candidate_v2',
      {
        p_candidate_key: candidateKey,
        p_base_version_id: active.id,
        p_base_version: active.version,
        p_base_hash: active.content_hash,
        p_patch_path: path,
        p_patch: patch,
        p_patch_hash: rulePatchHash(patch),
        p_proposed_content: proposedContent,
        p_proposed_content_hash: payloadHash(proposedContent),
        p_feedback_ids: feedbackIds,
        p_quality_result: qualityResult,
      }
    );
    if (error) {
      if (error.code === '23505') continue;
      if (
        error.code === 'P0001' &&
        /insufficient independent feedback evidence|insufficient independent issue keys|stale base rulebook/i.test(
          error.message ?? ''
        )
      ) {
        continue;
      }
      throw error;
    }
    return data ? 1 : 0;
  }
  return 0;
}

async function notifyCandidates(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase
    .from('seo_rule_patch_candidates')
    .select(
      'id,candidate_version,base_rulebook_version,base_rulebook_hash,patch_path,patch,patch_hash,proposed_content_hash,evidence_count,status,slack_message_ts'
    )
    .eq('status', 'pending_approval')
    .is('slack_message_ts', null)
    .is('notify_attempted_at', null)
    .order('created_at', { ascending: true })
    .limit(3);
  if (error) throw error;
  let count = 0;
  for (const candidate of data ?? []) {
    if (await notifySlackRulePatchApproval({ supabase, candidate })) {
      count += 1;
    }
  }
  return count;
}

async function ensureActiveRulebookIntegrity(
  supabase: SupabaseClient
): Promise<void> {
  const { data: active, error } = await supabase
    .from('seo_rulebook_versions')
    .select('id,content,content_hash')
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  const parsed = rulebookContentSchema.safeParse(active?.content);
  if (
    active &&
    parsed.success &&
    payloadHash(parsed.data) === active.content_hash
  ) {
    return;
  }
  if (!active) throw new Error('active Rulebookがありません');
  const rollback = await supabase.rpc('rollback_seo_rulebook', {
    p_current_version_id: active.id,
    p_current_hash: active.content_hash,
    p_actor_id: 'seo-rulebook-integrity-check',
    p_actor_name: 'SEO Rulebook integrity check',
    p_idempotency_key: `integrity-rollback:${active.id}`,
  });
  if (
    rollback.error ||
    !rollback.data ||
    typeof rollback.data !== 'object' ||
    (rollback.data as { status?: unknown }).status !== 'rolled_back'
  ) {
    throw new Error(
      `active Rulebook不整合の自動rollbackに失敗しました: ${
        rollback.error?.message ?? 'unknown error'
      }`
    );
  }
}

export async function processRulePatchLearning(
  supabase: SupabaseClient
): Promise<{ generated: number; notified: number; message: string }> {
  if (!isRulePatchEnabled()) {
    return {
      generated: 0,
      notified: 0,
      message: 'SEO_RULEBOOK_PATCH_ENABLED=false',
    };
  }
  try {
    await ensureActiveRulebookIntegrity(supabase);
    const { error: expireError } = await supabase
      .from('seo_rule_patch_candidates')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('status', 'pending_approval')
      .lt('expires_at', new Date().toISOString());
    if (expireError) throw expireError;
    const generated = await generateCandidate(supabase);
    const notified = await notifyCandidates(supabase);
    return {
      generated,
      notified,
      message: `Rule Patch候補生成 ${generated}件 / Slack通知 ${notified}件`,
    };
  } catch (error) {
    if (isRulebookSchemaUnavailable(error)) {
      return {
        generated: 0,
        notified: 0,
        message: 'Rule Patch migration未適用のため安全停止',
      };
    }
    throw error;
  }
}
