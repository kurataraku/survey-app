import type { SupabaseClient } from '@supabase/supabase-js';
import type { SeoLoopConfig } from './config';
import type { SeoLoopRun } from './types';

function isoNow(): string {
  return new Date().toISOString();
}

function addSeconds(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export function dailyRunKey(date = new Date()): string {
  return `seo-loop:${date.toISOString().slice(0, 10)}`;
}

export async function createOrLoadRun(
  supabase: SupabaseClient,
  idempotencyKey: string
): Promise<SeoLoopRun> {
  const { data: existing, error: selectError } = await supabase
    .from('seo_loop_runs')
    .select('id,idempotency_key,status,retry_count,max_retries')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing as SeoLoopRun;

  const { data, error } = await supabase
    .from('seo_loop_runs')
    .insert({
      idempotency_key: idempotencyKey,
      status: 'observing',
      current_step: 'observe',
      next_action_at: isoNow(),
    })
    .select('id,idempotency_key,status,retry_count,max_retries')
    .single();

  if (error) {
    const { data: loaded, error: loadError } = await supabase
      .from('seo_loop_runs')
      .select('id,idempotency_key,status,retry_count,max_retries')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (loadError) throw error;
    return loaded as SeoLoopRun;
  }

  return data as SeoLoopRun;
}

export async function acquireRunLock(params: {
  supabase: SupabaseClient;
  runId: string;
  config: SeoLoopConfig;
  lockedBy: string;
}): Promise<SeoLoopRun | null> {
  const now = isoNow();
  const expires = addSeconds(params.config.lockTtlSeconds);

  const { data, error } = await params.supabase
    .from('seo_loop_runs')
    .update({
      locked_at: now,
      lock_expires_at: expires,
      locked_by: params.lockedBy,
    })
    .eq('id', params.runId)
    .or(`locked_at.is.null,lock_expires_at.lt.${now}`)
    .select('id,idempotency_key,status,retry_count,max_retries')
    .maybeSingle();

  if (error) throw error;
  return data ? (data as SeoLoopRun) : null;
}

export async function releaseRunLock(
  supabase: SupabaseClient,
  runId: string
): Promise<void> {
  const { error } = await supabase
    .from('seo_loop_runs')
    .update({
      locked_at: null,
      lock_expires_at: null,
      locked_by: null,
    })
    .eq('id', runId);

  if (error) throw error;
}
