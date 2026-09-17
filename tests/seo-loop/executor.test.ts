import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeoLoopConfig } from '../../lib/seo-loop/config';
import { executeApprovedProposal } from '../../lib/seo-loop/executor';

vi.mock('../../lib/seo-loop/limits', () => ({
  assertExecutionLimits: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/rag/sync', () => ({
  syncRagForSchoolIds: vi.fn().mockResolvedValue(1),
  syncRagForArticleIds: vi.fn().mockResolvedValue(1),
}));

const config: SeoLoopConfig = {
  enabled: true,
  executionEnabled: true,
  maxDailyProposals: 10,
  maxDailyExecutions: 10,
  maxTargetsPerProposal: 1,
  lockTtlSeconds: 240,
  gscDays: 28,
  gscRowLimit: 50,
  softEvalMinScore: 75,
};

function payload(
  action:
    | 'updateSchoolMetaTitle'
    | 'updateFeatureMetaDescription'
    | 'updateSeoSummary'
    | 'addApprovedInternalLink',
  target: Record<string, unknown>
) {
  return {
    schemaVersion: 2,
    action,
    targets: [target],
    facts: [{ source: 'database', statement: '公開DBの実測値' }],
    assumptions: [],
    diagnosis: '検索結果上のクリック獲得に改善余地があります。',
    targetMetric: 'ctr',
    confidence: 0.8,
    ruleIds: ['test-rule'],
    rollbackPlan: '監査ログの変更前値へ戻します。',
    rationale: 'ページFactで裏付けた情報を追加します。',
    expectedImpact: '検索意図との一致によりCTR改善を狙います。',
    evidence: ['公開DBの実測値'],
  };
}

function updateSupabase(data: unknown[] = [{ id: 'row-1' }]) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  builder.update = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.is = vi.fn(() => builder);
  builder.select = vi.fn().mockResolvedValue({ data, error: null });
  const from = vi.fn(() => builder);
  return { client: { from } as never, from, builder };
}

describe('SEO Loop Typed Executor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('公開済みoverall要約のmeta_titleをcurrentValue一致時だけ更新する', async () => {
    const db = updateSupabase();
    const result = await executeApprovedProposal({
      supabase: db.client,
      config,
      proposalId: 'proposal-1',
      approvalId: 'approval-1',
      payload: payload('updateSchoolMetaTitle', {
        type: 'school',
        id: 'school-1',
        url: 'https://example.invalid/tsushin-kuchikomi/schools/test',
        currentValue: '現在の学校タイトル',
        proposedValue: '現在の学校タイトル｜週1〜5日の通学',
      }),
      expectedHash: 'same',
      actualHash: 'same',
    });

    expect(result.executed).toBe(true);
    expect(db.from).toHaveBeenCalledWith('school_ai_summaries');
    expect(db.builder.update).toHaveBeenCalledWith({
      meta_title: '現在の学校タイトル｜週1〜5日の通学',
    });
    expect(db.builder.is).toHaveBeenCalledWith('topic', null);
    expect(db.builder.eq).toHaveBeenCalledWith('meta_title', '現在の学校タイトル');
  });

  it('currentValueが変わっていて更新件数0なら上書きしない', async () => {
    const db = updateSupabase([]);
    const result = await executeApprovedProposal({
      supabase: db.client,
      config,
      proposalId: 'proposal-1',
      approvalId: 'approval-1',
      payload: payload('updateFeatureMetaDescription', {
        type: 'feature',
        id: 'article-1',
        url: 'https://example.invalid/tsushin-kuchikomi/features/test',
        currentValue:
          '現在の説明文です。承認後に変更された場合は上書きしないための十分な長さがあります。',
        proposedValue:
          '提案の説明文です。承認時の値と一致した場合だけ安全に反映する十分な長さがあります。',
      }),
      expectedHash: 'same',
      actualHash: 'same',
    });

    expect(result.executed).toBe(false);
    expect(result.message).toContain('承認時から変更');
  });

  it('承認済み内部リンクを公開記事本文へappend-onlyで追記する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '<html><title>通信制高校の学費ガイド</title></html>',
      })
    );
    const currentContent = '# 通信制高校の選び方\n\n本文です。';
    const readBuilder: Record<string, ReturnType<typeof vi.fn>> = {};
    readBuilder.select = vi.fn(() => readBuilder);
    readBuilder.eq = vi.fn(() => readBuilder);
    readBuilder.is = vi.fn(() => readBuilder);
    readBuilder.maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'article-1', content: currentContent },
      error: null,
    });
    const updateBuilder: Record<string, ReturnType<typeof vi.fn>> = {};
    updateBuilder.update = vi.fn(() => updateBuilder);
    updateBuilder.eq = vi.fn(() => updateBuilder);
    updateBuilder.select = vi.fn().mockResolvedValue({
      data: [{ id: 'article-1' }],
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce(readBuilder)
      .mockReturnValueOnce(updateBuilder);

    const result = await executeApprovedProposal({
      supabase: { from } as never,
      config,
      proposalId: 'proposal-2',
      approvalId: 'approval-2',
      payload: payload('addApprovedInternalLink', {
        type: 'url',
        id: 'article-1',
        url: 'https://example.invalid/tsushin-kuchikomi/features/test',
        currentValue: 'links:2:sha256:test',
        proposedValue:
          'https://example.invalid/tsushin-kuchikomi/features/tuition',
      }),
      expectedHash: 'same',
      actualHash: 'same',
    });

    expect(result.executed).toBe(true);
    expect(from).toHaveBeenNthCalledWith(1, 'articles');
    expect(from).toHaveBeenNthCalledWith(2, 'articles');
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        content: `${currentContent}\n\n関連ページ: [通信制高校の学費ガイド](https://example.invalid/tsushin-kuchikomi/features/tuition)`,
      })
    );
    vi.unstubAllGlobals();
  });

  it('payload hash不一致ならDBへ触れない', async () => {
    const from = vi.fn();
    const result = await executeApprovedProposal({
      supabase: { from } as never,
      config,
      proposalId: 'proposal-1',
      approvalId: 'approval-1',
      payload: payload('updateSeoSummary', {
        type: 'school',
        id: 'school-1',
        url: 'https://example.invalid/tsushin-kuchikomi/schools/test',
        currentValue:
          '現在の要約本文です。十分な長さを持つ既存の本文として、安全な更新のテストに利用します。',
        proposedValue:
          '現在の要約本文に、学費と週1〜5日の通学頻度という具体情報を追加した安全な本文です。',
      }),
      expectedHash: 'approved',
      actualHash: 'changed',
    });

    expect(result.executed).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});
