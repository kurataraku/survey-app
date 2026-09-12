import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMProvider } from '@/lib/seo-generation/llm-client';
import type { AnalysisStage, StructuredAttempt } from './types';

export async function recordAnalysisAttempts(params: {
  supabase: SupabaseClient;
  runId: string;
  issueId: string;
  stage: AnalysisStage;
  promptVersion: string;
  provider: LLMProvider;
  model: string;
  attempts: StructuredAttempt<unknown>[];
}): Promise<void> {
  if (params.attempts.length === 0) return;

  const rows = params.attempts.map((attempt) => ({
    run_id: params.runId,
    issue_id: params.issueId,
    stage: params.stage,
    attempt: attempt.attempt,
    prompt_version: params.promptVersion,
    model_provider: params.provider,
    model: params.model,
    input_context_hash: attempt.inputHash,
    input_snapshot: attempt.inputSnapshot,
    raw_output: attempt.rawOutput,
    parsed_output: attempt.parsedOutput,
    status: attempt.status,
    error_message: attempt.error,
    token_usage: attempt.tokens,
  }));

  const { error } = await params.supabase
    .from('seo_analysis_traces')
    .upsert(rows, { onConflict: 'run_id,issue_id,stage,attempt' });
  if (error) throw error;
}
