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
    },
    null,
    2
  )
);
if (!hashValid) throw new Error('active Rulebookのschema/hashが不正です');

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
