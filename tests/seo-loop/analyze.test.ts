import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractGscOpportunities } from '../../lib/gsc/analyze';
import type { GscComparedRow } from '../../lib/gsc/types';

const fixturePath = fileURLToPath(new URL('./fixtures/gsc-opportunities.json', import.meta.url));
const fixtureRows = JSON.parse(readFileSync(fixturePath, 'utf8')) as GscComparedRow[];

function row(overrides: Partial<GscComparedRow> = {}): GscComparedRow {
  return {
    keys: ['https://example.invalid/page', '匿名クエリ'],
    clicks: 10,
    impressions: 100,
    ctr: 0.02,
    position: 16,
    previous: null,
    delta: null,
    ...overrides,
  };
}

describe('extractGscOpportunities', () => {
  it('匿名fixtureから該当する課題だけを抽出し、スコア降順に並べる', () => {
    const opportunities = extractGscOpportunities(fixtureRows);

    expect(opportunities.map((item) => item.issueType)).toEqual([
      'striking_distance',
      'striking_distance',
      'declining_clicks',
      'striking_distance',
      'low_ctr_high_impressions',
    ]);
    expect(opportunities[0]?.targetUrl).toBe('https://example.invalid/schools/alpha');
    expect(opportunities[0]?.query).toBe('匿名校A 口コミ');
  });

  it('CTR条件の境界を判定する', () => {
    expect(
      extractGscOpportunities([row({ impressions: 200, ctr: 0.0199 })]).map((item) => item.issueType)
    ).toContain('low_ctr_high_impressions');
    expect(
      extractGscOpportunities([row({ impressions: 200, ctr: 0.02 })]).map((item) => item.issueType)
    ).not.toContain('low_ctr_high_impressions');
    expect(
      extractGscOpportunities([row({ impressions: 199, ctr: 0.0199 })]).map((item) => item.issueType)
    ).not.toContain('low_ctr_high_impressions');
  });

  it('掲載順位5〜20位と表示30回の境界を含む', () => {
    const issues = extractGscOpportunities([
      row({ keys: ['https://example.invalid/five'], position: 5 }),
      row({ keys: ['https://example.invalid/twenty'], position: 20 }),
      row({ keys: ['https://example.invalid/below'], position: 4.99 }),
      row({ keys: ['https://example.invalid/above'], position: 20.01 }),
      row({ keys: ['https://example.invalid/thirty'], position: 10, impressions: 30 }),
      row({ keys: ['https://example.invalid/few'], position: 10, impressions: 29 }),
    ]);

    expect(
      issues
        .filter((item) => item.issueType === 'striking_distance')
        .map((item) => item.targetUrl)
        .sort()
    ).toEqual([
      'https://example.invalid/five',
      'https://example.invalid/thirty',
      'https://example.invalid/twenty',
    ]);
  });

  it('クリック下落-10を境界として抽出する', () => {
    const declining = (clicks: number) =>
      extractGscOpportunities([
        row({ position: 25, delta: { clicks, impressions: 0, ctr: 0, position: 0 } }),
      ]).filter((item) => item.issueType === 'declining_clicks');
    expect(declining(-10)).toHaveLength(1);
    expect(declining(-9)).toHaveLength(0);
  });

  it('入力を破壊せず、結果を指定件数に制限する', () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      row({
        keys: [`https://example.invalid/${index}`],
        impressions: 100 + index,
        position: 10,
      })
    );
    const before = JSON.stringify(rows);

    expect(extractGscOpportunities(rows)).toHaveLength(25);
    const limited = extractGscOpportunities(rows, 20);
    expect(limited).toHaveLength(20);
    expect(limited[0]?.targetUrl).toBe('https://example.invalid/24');
    expect(JSON.stringify(rows)).toBe(before);
  });
});
