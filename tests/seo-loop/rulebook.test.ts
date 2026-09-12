import type { SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { candidateActionsForIssue } from '../../lib/seo-loop/analysis/policy';
import type { FactContextSnapshot } from '../../lib/seo-loop/context/types';
import { payloadHash } from '../../lib/seo-loop/hash';
import {
  effectiveActionValueLimits,
  effectiveRulebookLimits,
  getFallbackRulebook,
  isRulebookBindingConflict,
  isRulebookSchemaUnavailable,
  loadRulebookForRun,
} from '../../lib/seo-loop/rulebook/runtime';
import {
  FALLBACK_RULEBOOK,
  rulebookContentSchema,
} from '../../lib/seo-loop/rulebook/schema';

const versionId = '11111111-1111-4111-8111-111111111111';
const runId = '22222222-2222-4222-8222-222222222222';

type Binding = {
  rulebook_version_id: string;
  rulebook_version: number;
  content_hash: string;
  content_snapshot: unknown;
};

function rulebookSupabase(params?: {
  activeContent?: unknown;
  activeHash?: string;
  fail?: boolean;
  insertConflict?: boolean;
}) {
  const bindings = new Map<string, Binding>();
  let activeContent: unknown = params?.activeContent ?? FALLBACK_RULEBOOK;
  let activeHash = params?.activeHash ?? payloadHash(activeContent);

  const supabase = {
    from(table: string) {
      let operation: 'select' | 'insert' = 'select';
      let insertValue: Record<string, unknown> | null = null;
      const filters = new Map<string, unknown>();
      const builder = {
        select() {
          return builder;
        },
        eq(column: string, value: unknown) {
          filters.set(column, value);
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        insert(value: Record<string, unknown>) {
          operation = 'insert';
          insertValue = value;
          return builder;
        },
        async maybeSingle() {
          if (params?.fail) {
            return { data: null, error: { code: 'PGRST000', message: 'offline' } };
          }
          if (table === 'seo_rulebook_bindings') {
            if (operation === 'insert' && insertValue) {
              const binding: Binding = {
                rulebook_version_id:
                  insertValue.rulebook_version_id as string,
                rulebook_version: insertValue.rulebook_version as number,
                content_hash: insertValue.content_hash as string,
                content_snapshot: insertValue.content_snapshot,
              };
              bindings.set(insertValue.run_id as string, binding);
              if (params?.insertConflict) {
                return {
                  data: null,
                  error: { code: '23505', message: 'duplicate run binding' },
                };
              }
              return { data: binding, error: null };
            }
            return {
              data: bindings.get(filters.get('run_id') as string) ?? null,
              error: null,
            };
          }
          if (table === 'seo_rulebook_versions') {
            return {
              data: {
                id: versionId,
                version: 1,
                content_hash: activeHash,
                content: activeContent,
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;

  return {
    supabase,
    replaceActive(content: unknown) {
      activeContent = content;
      activeHash = payloadHash(content);
    },
  };
}

const schoolContext: FactContextSnapshot = {
  version: 1,
  collectedAt: '2026-09-11T00:00:00.000Z',
  target: {
    pageType: 'school',
    id: 'school-1',
    slug: 'school-1',
    url: 'https://example.invalid/schools/school-1',
  },
  html: {
    status: 200,
    title: '学校',
    description: null,
    canonical: null,
    robots: null,
    h1: '学校',
    internalLinks: [],
  },
  database: {
    type: 'school',
    id: 'school-1',
    name: '学校',
    slug: 'school-1',
    isPublic: true,
    aiSummary: null,
  },
  currentValues: {
    updateSchoolMetaTitle: '現在の学校タイトル',
    updateSeoSummary: '現在の学校要約',
  },
};

describe('Versioned Rulebook', () => {
  it('fallbackはZod適合し固定hashを持つ', () => {
    expect(rulebookContentSchema.safeParse(FALLBACK_RULEBOOK).success).toBe(true);
    expect(getFallbackRulebook().contentHash).toBe(
      'ac0f3b6225efc5b0343dd2600c35d9e9bb2baded66e472ff4f19cfed2d23046d'
    );
  });

  it('migration・fallback・人間向けsnapshotのhashが一致する', () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        'supabase-migrations/add-seo-loop-versioned-rulebook.sql'
      ),
      'utf8'
    );
    const seed = migration.match(
      /\(\s*1,\s*1,\s*'active',\s*'([\s\S]*?)'::jsonb,\s*'([a-f0-9]{64})'/
    );
    expect(seed).not.toBeNull();
    const content = JSON.parse(seed![1]!) as unknown;
    expect(rulebookContentSchema.safeParse(content).success).toBe(true);
    expect(payloadHash(content)).toBe(seed![2]);
    expect(payloadHash(content)).toBe(getFallbackRulebook().contentHash);

    const snapshot = readFileSync(
      resolve(process.cwd(), 'docs/seo-rulebook/v1.md'),
      'utf8'
    );
    expect(snapshot).toContain(getFallbackRulebook().contentHash);
  });

  it('runへ固定したsnapshotはactive版が変わっても変化しない', async () => {
    const store = rulebookSupabase();
    const first = await loadRulebookForRun({ supabase: store.supabase, runId });
    const changed = {
      ...FALLBACK_RULEBOOK,
      risk: { ...FALLBACK_RULEBOOK.risk, softEvalMinScore: 90 },
    };
    store.replaceActive(changed);
    const second = await loadRulebookForRun({ supabase: store.supabase, runId });

    expect(first.source).toBe('database');
    expect(second.contentHash).toBe(first.contentHash);
    expect(second.content.risk.softEvalMinScore).toBe(75);
  });

  it('DB取得失敗時は安全なfallbackを返す', async () => {
    const { supabase } = rulebookSupabase({ fail: true });
    const loaded = await loadRulebookForRun({ supabase, runId });
    expect(loaded.source).toBe('fallback');
    expect(loaded.content.ops.humanApprovalRequired).toBe(true);
  });

  it('DB版のcontent hash不一致時は採用しない', async () => {
    const { supabase } = rulebookSupabase({
      activeHash: '0'.repeat(64),
    });
    const loaded = await loadRulebookForRun({ supabase, runId });
    expect(loaded.source).toBe('fallback');
    expect(loaded.contentHash).toBe(payloadHash(FALLBACK_RULEBOOK));
  });

  it('schema欠落と整合性違反を混同しない', () => {
    expect(
      isRulebookSchemaUnavailable({
        code: 'PGRST204',
        message: 'column not found',
      })
    ).toBe(true);
    expect(
      isRulebookSchemaUnavailable({
        code: '23503',
        message:
          'violates foreign key constraint seo_proposals_rulebook_version_id_fkey',
      })
    ).toBe(false);
    expect(
      isRulebookBindingConflict({
        code: 'P0001',
        message: 'proposal rulebook hash differs from run binding',
      })
    ).toBe(true);
  });

  it('同時binding作成で競合しても勝者のsnapshotを再読込する', async () => {
    const { supabase } = rulebookSupabase({ insertConflict: true });
    const loaded = await loadRulebookForRun({ supabase, runId });
    expect(loaded.source).toBe('database');
    expect(loaded.version).toBe(1);
    expect(loaded.contentHash).toBe(payloadHash(FALLBACK_RULEBOOK));
  });

  it('環境設定とRulebookのうち厳しい上限・閾値を採用する', () => {
    expect(
      effectiveRulebookLimits(
        {
          maxDailyProposals: 20,
          maxTargetsPerProposal: 5,
          softEvalMinScore: 70,
        },
        getFallbackRulebook()
      )
    ).toEqual({
      maxDailyProposals: 10,
      maxTargetsPerProposal: 3,
      softEvalMinScore: 75,
    });
  });

  it('DB版が緩くてもコード内の安全境界を弱めない', () => {
    const weakened = {
      ...FALLBACK_RULEBOOK,
      risk: {
        ...FALLBACK_RULEBOOK.risk,
        actionValueLimits: {
          ...FALLBACK_RULEBOOK.risk.actionValueLimits,
          updateSchoolMetaTitle: { min: 1, max: 100 },
        },
        softEvalMinScore: 50,
        highRiskConfidenceBelow: 0.1,
      },
      ops: {
        ...FALLBACK_RULEBOOK.ops,
        maxDailyProposals: 100,
        maxTargetsPerProposal: 20,
      },
    };
    const bound = {
      ...getFallbackRulebook(),
      source: 'database' as const,
      version: 2,
      contentHash: payloadHash(weakened),
      content: weakened,
    };
    expect(effectiveActionValueLimits(bound).updateSchoolMetaTitle).toEqual({
      min: 10,
      max: 60,
    });
    expect(
      effectiveRulebookLimits(
        {
          maxDailyProposals: 100,
          maxTargetsPerProposal: 20,
          softEvalMinScore: 0,
        },
        bound
      )
    ).toEqual({
      maxDailyProposals: 10,
      maxTargetsPerProposal: 3,
      softEvalMinScore: 75,
    });
  });

  it('analyzerの候補actionを固定版Rulebookから読む', () => {
    const analyzer = {
      ...FALLBACK_RULEBOOK.analyzer,
      issueActionCandidates: {
        ...FALLBACK_RULEBOOK.analyzer.issueActionCandidates,
        declining_clicks: ['updateSeoSummary' as const],
      },
    };
    expect(
      candidateActionsForIssue('declining_clicks', schoolContext, analyzer)
    ).toEqual(['updateSeoSummary']);
  });
});
