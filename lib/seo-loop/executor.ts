import type { SupabaseClient } from '@supabase/supabase-js';
import type { SeoLoopConfig } from './config';
import { assertExecutionLimits } from './limits';
import {
  proposalPayloadV2Schema,
  type ProposalPayloadV2,
  type TypedAction,
} from './types';

type ExecutorContext = {
  supabase: SupabaseClient;
  config: SeoLoopConfig;
  proposalId: string;
  approvalId: string;
  payload: unknown;
  expectedHash: string;
  actualHash: string;
};

export type ExecutorResult = {
  executed: boolean;
  message: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
};

type LiveExecutorContext = ExecutorContext & { payload: ProposalPayloadV2 };
type TypedExecutor = (context: LiveExecutorContext) => Promise<ExecutorResult>;

function singleTarget(context: LiveExecutorContext) {
  return context.payload.targets.length === 1
    ? context.payload.targets[0]!
    : null;
}

async function updateSchoolSummaryColumn(
  context: LiveExecutorContext,
  column: 'meta_title' | 'summary_text'
): Promise<ExecutorResult> {
  const target = singleTarget(context);
  if (!target || target.type !== 'school') {
    return {
      executed: false,
      message: '安全な本番更新は1 proposal・1 school targetに限定しています',
    };
  }

  const { data, error } = await context.supabase
    .from('school_ai_summaries')
    .update({ [column]: target.proposedValue })
    .eq('school_id', target.id)
    .eq('kind', 'overall')
    .eq('status', 'published')
    .eq(column, target.currentValue)
    .select('id');
  if (error) throw error;
  if ((data ?? []).length !== 1) {
    return {
      executed: false,
      message: `公開済みoverall要約が1件でないか、${column}が承認時から変更されています`,
    };
  }

  return {
    executed: true,
    message: `school_ai_summaries.${column}を更新しました`,
    beforeState: {
      table: 'school_ai_summaries',
      targetId: target.id,
      column,
      value: target.currentValue,
    },
    afterState: {
      table: 'school_ai_summaries',
      targetId: target.id,
      column,
      value: target.proposedValue,
    },
  };
}

const updateSchoolMetaTitle: TypedExecutor = (context) =>
  updateSchoolSummaryColumn(context, 'meta_title');

const updateSeoSummary: TypedExecutor = (context) =>
  updateSchoolSummaryColumn(context, 'summary_text');

const updateFeatureMetaDescription: TypedExecutor = async (context) => {
  const target = singleTarget(context);
  if (!target || target.type !== 'feature') {
    return {
      executed: false,
      message: '安全な本番更新は1 proposal・1 feature targetに限定しています',
    };
  }

  const { data, error } = await context.supabase
    .from('articles')
    .update({ meta_description: target.proposedValue })
    .eq('id', target.id)
    .eq('is_public', true)
    .eq('meta_description', target.currentValue)
    .select('id');
  if (error) throw error;
  if ((data ?? []).length !== 1) {
    return {
      executed: false,
      message:
        '公開記事が1件でないか、meta_descriptionが承認時から変更されています',
    };
  }

  return {
    executed: true,
    message: 'articles.meta_descriptionを更新しました',
    beforeState: {
      table: 'articles',
      targetId: target.id,
      column: 'meta_description',
      value: target.currentValue,
    },
    afterState: {
      table: 'articles',
      targetId: target.id,
      column: 'meta_description',
      value: target.proposedValue,
    },
  };
};

function normalizedUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  url.pathname = url.pathname.replace(/\/+$/u, '') || '/';
  return url.toString();
}

async function fetchPageTitle(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(8_000),
      headers: { 'user-agent': 'survey-app-seo-loop-executor/1.0' },
    });
    if (!response.ok) return '関連ページを見る';
    const html = await response.text();
    const matched = html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu);
    return (
      matched?.[1]
        ?.replace(/<[^>]+>/gu, '')
        .replace(/\s+/gu, ' ')
        .trim()
        .slice(0, 120) || '関連ページを見る'
    );
  } catch {
    return '関連ページを見る';
  }
}

const addApprovedInternalLink: TypedExecutor = async (context) => {
  const target = singleTarget(context);
  if (!target || target.type !== 'url') {
    return {
      executed: false,
      message: '安全な本番更新は1 proposal・1 url targetに限定しています',
    };
  }

  const sourceUrl = normalizedUrl(target.url);
  const targetUrl = normalizedUrl(target.proposedValue);
  if (new URL(sourceUrl).origin !== new URL(targetUrl).origin) {
    return {
      executed: false,
      message: '内部リンク先が対象ページと同一originではありません',
    };
  }
  const anchorText = await fetchPageTitle(targetUrl);
  const { error } = await context.supabase
    .from('seo_approved_internal_links')
    .upsert(
      {
        source_url: sourceUrl,
        target_url: targetUrl,
        anchor_text: anchorText,
        proposal_id: context.proposalId,
        approval_id: context.approvalId,
        is_active: true,
      },
      { onConflict: 'source_url,target_url' }
    );
  if (error) throw error;

  return {
    executed: true,
    message: '承認済み内部リンクを関連リンク枠へ保存しました',
    beforeState: {
      table: 'seo_approved_internal_links',
      sourceUrl,
      targetUrl,
      active: false,
    },
    afterState: {
      table: 'seo_approved_internal_links',
      sourceUrl,
      targetUrl,
      anchorText,
      active: true,
    },
  };
};

export const typedExecutors: Record<TypedAction, TypedExecutor> = {
  updateSchoolMetaTitle,
  updateFeatureMetaDescription,
  updateSeoSummary,
  addApprovedInternalLink,
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

  const parsed = proposalPayloadV2Schema.safeParse(context.payload);
  if (!parsed.success) {
    return {
      executed: false,
      message: `本番実行にはproposal v2が必要です: ${parsed.error.message}`,
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
