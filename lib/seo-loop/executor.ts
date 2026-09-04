import type { SupabaseClient } from '@supabase/supabase-js';
import type { SeoLoopConfig } from './config';
import { assertExecutionLimits } from './limits';
import { proposalPayloadSchema, type ProposalPayload, type TypedAction } from './types';

type ExecutorContext = {
  supabase: SupabaseClient;
  config: SeoLoopConfig;
  proposalId: string;
  approvalId: string;
  payload: unknown;
  expectedHash: string;
  actualHash: string;
};

type ExecutorResult = {
  executed: boolean;
  message: string;
};

type TypedExecutor = (context: ExecutorContext & { payload: ProposalPayload }) => Promise<ExecutorResult>;

const blockedUntilPhase2: TypedExecutor = async () => ({
  executed: false,
  message: 'Phase 1 では Typed Executor はdry-runです。本番書き込みはPhase 2で有効化します。',
});

export const typedExecutors: Record<TypedAction, TypedExecutor> = {
  updateSchoolMetaTitle: blockedUntilPhase2,
  updateFeatureMetaDescription: blockedUntilPhase2,
  updateSeoSummary: blockedUntilPhase2,
  addApprovedInternalLink: blockedUntilPhase2,
};

export async function executeApprovedProposal(context: ExecutorContext): Promise<ExecutorResult> {
  if (!context.config.executionEnabled) {
    return {
      executed: false,
      message: 'SEO_LOOP_EXECUTION_ENABLED=false のため変更実行を停止しました',
    };
  }

  if (context.expectedHash !== context.actualHash) {
    return {
      executed: false,
      message: '承認時と実行時の payload_hash が一致しないため再承認が必要です',
    };
  }

  const parsed = proposalPayloadSchema.safeParse(context.payload);
  if (!parsed.success) {
    return {
      executed: false,
      message: `proposal payload のschema検証に失敗しました: ${parsed.error.message}`,
    };
  }

  await assertExecutionLimits(context.supabase, context.config);

  const executor = typedExecutors[parsed.data.action];
  if (!executor) {
    return {
      executed: false,
      message: `Allowlist外のactionです: ${parsed.data.action}`,
    };
  }

  return executor({ ...context, payload: parsed.data });
}
