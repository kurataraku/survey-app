import { config as loadEnv } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { factContextSnapshotSchema } from '../lib/seo-loop/context/types';
import { runHardGate } from '../lib/seo-loop/evaluation/hard-gate';
import { runSoftEval } from '../lib/seo-loop/evaluation/soft-eval';
import { changeOverview } from '../lib/seo-loop/slack';
import { proposalPayloadV2Schema } from '../lib/seo-loop/types';

type ProposalRow = {
  id: string;
  run_id: string;
  action: string;
  status: string;
  payload_hash: string;
  payload: unknown;
  context_snapshot: unknown;
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

function textBlock(value: string): string {
  return ['```text', value, '```'].join('\n');
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
  const days = numberArg('days', 1);
  const limit = numberArg('limit', 20);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('seo_proposals')
    .select('id,run_id,action,status,payload_hash,payload,context_snapshot,created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const proposals = (data ?? []) as ProposalRow[];
  const sections = proposals.map((row, index) => {
    const parsed = proposalPayloadV2Schema.safeParse(row.payload);
    if (!parsed.success) {
      return [
        `## ${index + 1}. ${row.action} / ${row.status}`,
        `proposal: ${row.id}`,
        `payload hash: ${row.payload_hash}`,
        'Proposal v2 schemaに適合しません。',
        textBlock(parsed.error.message),
      ].join('\n');
    }
    const proposal = parsed.data;
    const context = factContextSnapshotSchema.safeParse(row.context_snapshot);
    const hardGate = runHardGate({
      payload: proposal,
      context: context.success ? context.data : null,
      duplicateProposal: false,
      dailyProposalCount: 1,
      maxDailyProposals: 10,
      maxTargetsPerProposal: 3,
    });
    const softEval = runSoftEval(proposal);
    const hardGateWarnings = hardGate.results
      .filter((result) => result.severity === 'warn' && !result.passed)
      .map((result) => `- ${result.ruleId}: ${result.message}`);
    const hardGateBlocks = hardGate.results
      .filter((result) => result.severity === 'block' && !result.passed)
      .map((result) => `- ${result.ruleId}: ${result.message}`);
    const targetTexts = proposal.targets.flatMap((target) => [
      `### target: ${target.type}:${target.id}`,
      `URL: ${target.url}`,
      '変更前:',
      textBlock(target.currentValue),
      '変更後:',
      textBlock(target.proposedValue),
    ]);
    return [
      `## ${index + 1}. ${proposal.action} / ${row.status}`,
      `proposal: ${row.id}`,
      `run: ${row.run_id}`,
      `created: ${row.created_at}`,
      `payload hash: ${row.payload_hash}`,
      '',
      '### 変更サマリ',
      changeOverview(proposal),
      '',
      '### 判定',
      `Soft Eval: ${softEval.totalScore}/100`,
      hardGateBlocks.length > 0 ? ['Hard Gate block:', ...hardGateBlocks].join('\n') : 'Hard Gate block: なし',
      hardGateWarnings.length > 0 ? ['Hard Gate warning:', ...hardGateWarnings].join('\n') : 'Hard Gate warning: なし',
      softEval.warnings.length > 0 ? ['Soft Eval warning:', ...softEval.warnings.map((warning) => `- ${warning}`)].join('\n') : 'Soft Eval warning: なし',
      '',
      '### 変更前後',
      ...targetTexts,
      '',
      '### 根拠Fact',
      ...proposal.facts.map((fact) => `- [${fact.source}] ${fact.statement}`),
    ].join('\n');
  });

  console.log(
    [
      `# SEO Proposal Review`,
      `since: ${since}`,
      `count: ${sections.length}`,
      '',
      ...sections,
    ].join('\n\n')
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
