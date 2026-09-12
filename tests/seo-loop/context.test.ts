import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { collectFactContext } from '../../lib/seo-loop/context/collector';
import { identifyPageUrl, parseHtmlFacts } from '../../lib/seo-loop/context/html';
import { validateProposalAgainstContext } from '../../lib/seo-loop/context/validate';
import { proposalPayloadV2Schema } from '../../lib/seo-loop/types';

const siteUrl = 'https://example.invalid';
const targetUrl = 'https://example.invalid/tsushin-kuchikomi/schools/alpha';

function fakeSupabase(): SupabaseClient {
  return {
    from(table: string) {
      const result =
        table === 'schools'
          ? {
              data: {
                id: 'school-anon-001',
                name: '匿名校A',
                slug: 'alpha',
                is_public: true,
              },
              error: null,
            }
          : {
              data: {
                summary_text: '現在の公開要約',
                meta_title: 'DBタイトル',
                meta_description: 'DB説明',
              },
              error: null,
            };
      const builder = {
        select: () => builder,
        eq: () => builder,
        single: async () => result,
        maybeSingle: async () => result,
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

function fakeFeatureSupabase(metaDescription: string | null): SupabaseClient {
  return {
    from() {
      const builder = {
        select: () => builder,
        eq: () => builder,
        single: async () => ({
          data: {
            id: 'feature-anon-001',
            title: '匿名特集',
            slug: 'support',
            is_public: true,
            meta_title: null,
            meta_description: metaDescription,
          },
          error: null,
        }),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

describe('Fact Context HTML境界', () => {
  it('base pathを除いて学校・特集を識別する', () => {
    expect(identifyPageUrl(targetUrl, siteUrl)).toMatchObject({
      pageType: 'school',
      slug: 'alpha',
    });
    expect(
      identifyPageUrl('https://example.invalid/tsushin-kuchikomi/features/support', siteUrl)
    ).toMatchObject({ pageType: 'feature', slug: 'support' });
  });

  it('外部originを拒否する', () => {
    expect(() => identifyPageUrl('https://attacker.invalid/schools/alpha', siteUrl)).toThrow(
      '同一origin'
    );
  });

  it('title・description・canonical・robots・H1・内部リンクを抽出する', () => {
    const html = `<!doctype html><html><head>
      <title>匿名校A &amp; 口コミ</title>
      <meta content="説明文" name="description">
      <meta name="robots" content="index,follow">
      <link href="/tsushin-kuchikomi/schools/alpha" rel="canonical">
      </head><body><h1><span>匿名校A</span>の評判</h1>
      <a href="/tsushin-kuchikomi/reviews">口コミ</a>
      <a href="https://outside.invalid/">外部</a></body></html>`;
    expect(parseHtmlFacts(html, targetUrl)).toEqual({
      status: 200,
      title: '匿名校A & 口コミ',
      description: '説明文',
      canonical: targetUrl,
      robots: 'index,follow',
      h1: '匿名校A の評判',
      internalLinks: ['https://example.invalid/tsushin-kuchikomi/reviews'],
    });
  });
});

describe('collectFactContext', () => {
  it('HTMLとDBを結合しaction別currentValueを固定する', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        '<html><head><title>実表示タイトル</title><meta name="description" content="実表示説明"></head><body><h1>匿名校A</h1></body></html>',
        { status: 200, headers: { 'content-type': 'text/html' } }
      )
    );
    const context = await collectFactContext({
      supabase: fakeSupabase(),
      targetUrl,
      siteUrl,
      fetchImpl,
      now: () => new Date('2026-09-09T00:00:00.000Z'),
    });

    expect(context.target).toMatchObject({
      pageType: 'school',
      id: 'school-anon-001',
      slug: 'alpha',
    });
    expect(context.currentValues).toMatchObject({
      updateSchoolMetaTitle: 'DBタイトル',
      updateSeoSummary: '現在の公開要約',
      addApprovedInternalLink: expect.stringMatching(/^links:0:sha256:/),
    });
    expect(context.collectedAt).toBe('2026-09-09T00:00:00.000Z');
  });

  it('特集descriptionは表示fallbackではなくDB実値だけをcurrentValueにする', async () => {
    const featureUrl = 'https://example.invalid/tsushin-kuchikomi/features/support';
    const fetchImpl = async () =>
      new Response('<meta name="description" content="excerpt由来の表示説明">', {
        headers: { 'content-type': 'text/html' },
      });
    const withDbValue = await collectFactContext({
      supabase: fakeFeatureSupabase('DB説明'),
      targetUrl: featureUrl,
      siteUrl,
      fetchImpl,
    });
    const withoutDbValue = await collectFactContext({
      supabase: fakeFeatureSupabase(null),
      targetUrl: featureUrl,
      siteUrl,
      fetchImpl,
    });

    expect(withDbValue.currentValues.updateFeatureMetaDescription).toBe('DB説明');
    expect(withoutDbValue.currentValues.updateFeatureMetaDescription).toBeUndefined();
    expect(withoutDbValue.html.description).toBe('excerpt由来の表示説明');
  });
});

describe('Proposal v2とFact Contextの照合', () => {
  it('ID・URL・currentValue完全一致のみ受理する', async () => {
    const context = await collectFactContext({
      supabase: fakeSupabase(),
      targetUrl,
      siteUrl,
      fetchImpl: async () =>
        new Response('<title>実表示タイトル</title>', {
          headers: { 'content-type': 'text/html' },
        }),
    });
    const proposal = proposalPayloadV2Schema.parse({
      schemaVersion: 2,
      action: 'updateSchoolMetaTitle',
      targets: [
        {
          type: 'school',
          id: 'school-anon-001',
          url: targetUrl,
          currentValue: 'DBタイトル',
          proposedValue: '変更後タイトル',
        },
      ],
      facts: [{ source: 'html', statement: '実表示タイトルを確認' }],
      assumptions: [],
      diagnosis: '検索意図の明示が不足',
      targetMetric: 'ctr',
      confidence: 0.7,
      ruleIds: [],
      rollbackPlan: '元のタイトルへ戻す',
      rationale: '実測値に基づく変更',
      expectedImpact: 'CTR改善',
      evidence: ['HTML titleを取得'],
    });
    if (proposal.action !== 'updateSchoolMetaTitle') {
      throw new Error('test fixture actionが不正です');
    }

    expect(validateProposalAgainstContext(proposal, context)).toEqual([]);
    expect(
      validateProposalAgainstContext(
        {
          ...proposal,
          targets: [{ ...proposal.targets[0], currentValue: 'LLMが作った値' }],
        },
        context
      )
    ).toContain('currentValueが実測値と一致しません');
  });
});
