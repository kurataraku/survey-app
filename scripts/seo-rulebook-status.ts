import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { payloadHash } from '../lib/seo-loop/hash';
import { rulebookContentSchema } from '../lib/seo-loop/rulebook/schema';

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

const args = new Set(process.argv.slice(2));
const actorArg = process.argv
  .slice(2)
  .find((value) => value.startsWith('--actor='));
const actor = actorArg?.slice('--actor='.length);

const { data: active, error: activeError } = await supabase
  .from('seo_rulebook_versions')
  .select('id,version,content_hash,content,activated_at,created_by_kind')
  .eq('status', 'active')
  .maybeSingle();
if (activeError) throw activeError;
if (!active) throw new Error('active Rulebookがありません');

const parsed = rulebookContentSchema.safeParse(active.content);
const hashValid = parsed.success && payloadHash(parsed.data) === active.content_hash;
const { data: rollout, error: rolloutError } = await supabase
  .from('seo_rulebook_rollouts')
  .select(
    'id,candidate_id,candidate_version,patch_hash,status,base_rulebook_version,base_rulebook_hash,shadow_content_hash,run_count,evaluated_proposal_count,observed_decision_count,metrics_version,metrics,started_at,ready_at,promoted_at'
  )
  .in('status', ['shadowing', 'ready'])
  .order('started_at', { ascending: false })
  .limit(1)
  .maybeSingle();
if (
  rolloutError &&
  !['42P01', 'PGRST204', 'PGRST205'].includes(rolloutError.code ?? '')
) {
  throw rolloutError;
}
console.log(
  JSON.stringify(
    {
      active: {
        id: active.id,
        version: active.version,
        contentHash: active.content_hash,
        hashValid,
        activatedAt: active.activated_at,
        createdByKind: active.created_by_kind,
      },
      rollout: rollout
        ? {
            id: rollout.id,
            candidateId: rollout.candidate_id,
            status: rollout.status,
            baseVersion: rollout.base_rulebook_version,
            baseHash: rollout.base_rulebook_hash,
            shadowHash: rollout.shadow_content_hash,
            runCount: rollout.run_count,
            evaluatedProposalCount: rollout.evaluated_proposal_count,
            observedDecisionCount: rollout.observed_decision_count,
            metricsVersion: rollout.metrics_version,
            metrics: rollout.metrics,
            startedAt: rollout.started_at,
            readyAt: rollout.ready_at,
          }
        : null,
    },
    null,
    2
  )
);
if (!hashValid) throw new Error('active Rulebookのschema/hashが不正です');

if (args.has('--reject-rollout')) {
  const patchEnabled = ['true', '1'].includes(
    process.env.SEO_RULEBOOK_PATCH_ENABLED?.toLowerCase() ?? ''
  );
  const shadowEnabled = ['true', '1'].includes(
    process.env.SEO_RULEBOOK_SHADOW_ENABLED?.toLowerCase() ?? ''
  );
  if (!patchEnabled || !shadowEnabled || !args.has('--yes') || !actor) {
    throw new Error(
      'rollout却下には両switch=true、--reject-rollout --yes --actor=<ID>が必要です'
    );
  }
  if (!rollout) throw new Error('進行中のRulebook rolloutがありません');
  const { data, error } = await supabase.rpc('reject_seo_rulebook_rollout', {
    p_rollout_id: rollout.id,
    p_candidate_id: rollout.candidate_id,
    p_candidate_version: rollout.candidate_version,
    p_patch_hash: rollout.patch_hash,
    p_shadow_content_hash: rollout.shadow_content_hash,
    p_approver_id: actor,
    p_approver_name: 'seo-rulebook-status CLI',
  });
  if (error) throw error;
  console.log(JSON.stringify({ rolloutRejected: data }, null, 2));
  return;
}

if (args.has('--rollback-current')) {
  const patchEnabled = ['true', '1'].includes(
    process.env.SEO_RULEBOOK_PATCH_ENABLED?.toLowerCase() ?? ''
  );
  if (
    !patchEnabled ||
    !args.has('--yes') ||
    !actor
  ) {
    throw new Error(
      'rollbackにはSEO_RULEBOOK_PATCH_ENABLED=true、--rollback-current --yes --actor=<ID>が必要です'
    );
  }
  const { data: appliedEvent, error: eventError } = await supabase
    .from('seo_rulebook_activation_events')
    .select('from_version_id')
    .eq('event_type', 'applied')
    .eq('to_version_id', active.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (eventError) throw eventError;
  if (!appliedEvent) throw new Error('直前versionへのrollback情報がありません');

  const { data: target, error: targetError } = await supabase
    .from('seo_rulebook_versions')
    .select('id,content,content_hash,status')
    .eq('id', appliedEvent.from_version_id)
    .eq('status', 'retired')
    .maybeSingle();
  if (targetError) throw targetError;
  const targetParsed = rulebookContentSchema.safeParse(target?.content);
  if (
    !target ||
    !targetParsed.success ||
    payloadHash(targetParsed.data) !== target.content_hash
  ) {
    throw new Error('rollback対象のschema/hash検査に失敗しました');
  }

  const { data, error } = await supabase.rpc('rollback_seo_rulebook', {
    p_current_version_id: active.id,
    p_current_hash: active.content_hash,
    p_actor_id: actor,
    p_actor_name: 'seo-rulebook-status CLI',
    p_idempotency_key: `cli-rollback:${active.id}`,
  });
  if (error) throw error;
  console.log(JSON.stringify({ rollback: data }, null, 2));
}
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
