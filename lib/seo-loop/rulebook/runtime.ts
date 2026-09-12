import type { SupabaseClient } from '@supabase/supabase-js';
import { payloadHash } from '../hash';
import {
  FALLBACK_RULEBOOK,
  rulebookContentSchema,
  type RulebookContent,
} from './schema';
import type { TypedAction } from '../types';

export type BoundRulebook = {
  source: 'database' | 'fallback';
  versionId: string | null;
  version: number;
  contentHash: string;
  content: RulebookContent;
};

const fallbackRulebook: BoundRulebook = {
  source: 'fallback',
  versionId: null,
  version: 0,
  contentHash: payloadHash(FALLBACK_RULEBOOK),
  content: FALLBACK_RULEBOOK,
};

function parseBoundRulebook(row: {
  rulebook_version_id?: unknown;
  rulebook_version?: unknown;
  content_hash?: unknown;
  content_snapshot?: unknown;
}): BoundRulebook | null {
  const content = rulebookContentSchema.safeParse(row.content_snapshot);
  if (
    !content.success ||
    typeof row.rulebook_version_id !== 'string' ||
    typeof row.rulebook_version !== 'number' ||
    typeof row.content_hash !== 'string' ||
    payloadHash(content.data) !== row.content_hash
  ) {
    return null;
  }
  return {
    source: 'database',
    versionId: row.rulebook_version_id,
    version: row.rulebook_version,
    contentHash: row.content_hash,
    content: content.data,
  };
}

export function getFallbackRulebook(): BoundRulebook {
  return fallbackRulebook;
}

export function isRulebookSchemaUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: string; message?: string };
  return ['42703', '42P01', 'PGRST202', 'PGRST204', 'PGRST205'].includes(
    value.code ?? ''
  );
}

export function isRulebookBindingConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: string; message?: string };
  return (
    value.code === 'P0001' &&
    /proposal rulebook (?:hash|rule IDs) differs from run binding/i.test(
      value.message ?? ''
    )
  );
}

export async function loadRulebookForRun(params: {
  supabase: SupabaseClient;
  runId: string;
}): Promise<BoundRulebook> {
  try {
    const { data: binding, error: bindingError } = await params.supabase
      .from('seo_rulebook_bindings')
      .select(
        'rulebook_version_id,rulebook_version,content_hash,content_snapshot'
      )
      .eq('run_id', params.runId)
      .maybeSingle();
    if (bindingError) throw bindingError;
    if (binding) return parseBoundRulebook(binding) ?? fallbackRulebook;

    const { data: active, error: activeError } = await params.supabase
      .from('seo_rulebook_versions')
      .select('id,version,content_hash,content')
      .eq('status', 'active')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeError) throw activeError;
    const content = rulebookContentSchema.safeParse(active?.content);
    if (
      !active ||
      !content.success ||
      payloadHash(content.data) !== active.content_hash
    ) {
      return fallbackRulebook;
    }

    const candidate = {
      source: 'database' as const,
      versionId: active.id as string,
      version: active.version as number,
      contentHash: active.content_hash as string,
      content: content.data,
    };
    const { data: inserted, error: insertError } = await params.supabase
      .from('seo_rulebook_bindings')
      .insert({
        run_id: params.runId,
        rulebook_version_id: candidate.versionId,
        rulebook_version: candidate.version,
        content_hash: candidate.contentHash,
        content_snapshot: candidate.content,
      })
      .select(
        'rulebook_version_id,rulebook_version,content_hash,content_snapshot'
      )
      .maybeSingle();
    if (!insertError && inserted) {
      return parseBoundRulebook(inserted) ?? fallbackRulebook;
    }

    const { data: winner, error: winnerError } = await params.supabase
      .from('seo_rulebook_bindings')
      .select(
        'rulebook_version_id,rulebook_version,content_hash,content_snapshot'
      )
      .eq('run_id', params.runId)
      .maybeSingle();
    if (winnerError) throw winnerError;
    return winner ? parseBoundRulebook(winner) ?? fallbackRulebook : fallbackRulebook;
  } catch (error) {
    console.error('SEO Rulebook load failed; using safe fallback', {
      runId: params.runId,
      message: error instanceof Error ? error.message : String(error),
    });
    return fallbackRulebook;
  }
}

export function effectiveRulebookLimits(
  config: {
    maxDailyProposals: number;
    maxTargetsPerProposal: number;
    softEvalMinScore: number;
  },
  rulebook: BoundRulebook
): {
  maxDailyProposals: number;
  maxTargetsPerProposal: number;
  softEvalMinScore: number;
} {
  return {
    maxDailyProposals: Math.min(
      config.maxDailyProposals,
      rulebook.content.ops.maxDailyProposals,
      FALLBACK_RULEBOOK.ops.maxDailyProposals
    ),
    maxTargetsPerProposal: Math.min(
      config.maxTargetsPerProposal,
      rulebook.content.ops.maxTargetsPerProposal,
      FALLBACK_RULEBOOK.ops.maxTargetsPerProposal
    ),
    softEvalMinScore: Math.max(
      config.softEvalMinScore,
      rulebook.content.risk.softEvalMinScore,
      FALLBACK_RULEBOOK.risk.softEvalMinScore
    ),
  };
}

export function effectiveActionValueLimits(
  rulebook: BoundRulebook
): Record<TypedAction, { min: number; max: number }> {
  return Object.fromEntries(
    Object.entries(FALLBACK_RULEBOOK.risk.actionValueLimits).map(
      ([action, fallback]) => {
        const configured =
          rulebook.content.risk.actionValueLimits[action as TypedAction];
        return [
          action,
          {
            min: Math.max(fallback.min, configured.min),
            max: Math.min(fallback.max, configured.max),
          },
        ];
      }
    )
  ) as Record<TypedAction, { min: number; max: number }>;
}
