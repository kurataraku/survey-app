import { describe, expect, it } from 'vitest';
import { extractGscOpportunities } from '../../lib/gsc/analyze';
import type { GscComparedRow } from '../../lib/gsc/types';
import {
  rankAndDedupeOpportunities,
  selectPriorityUrls,
} from '../../lib/seo-loop/observer';

function row(url: string, impressions: number): GscComparedRow {
  return {
    keys: [url],
    clicks: 1,
    impressions,
    ctr: 0.005,
    position: 8,
    previous: null,
    delta: null,
  };
}

describe('selectPriorityUrls', () => {
  it('GSC opportunity順で重複のないURLに限定する', () => {
    const rows = [
      row('https://example.invalid/schools/low', 300),
      row('https://example.invalid/schools/high', 1200),
      row('https://example.invalid/schools/mid', 600),
    ];

    expect(selectPriorityUrls(rows, 2)).toEqual([
      'https://example.invalid/schools/high',
      'https://example.invalid/schools/mid',
    ]);
  });

  it('課題条件を満たさないURLはpage×query対象にしない', () => {
    expect(
      selectPriorityUrls([
        {
          ...row('https://example.invalid/schools/no-opportunity', 50),
          ctr: 0.1,
          position: 30,
        },
      ])
    ).toEqual([]);
  });

  it('同じURL・issueTypeのpageとpage×query課題を1件にまとめる', () => {
    const url = 'https://example.invalid/schools/alpha';
    const pageIssue = extractGscOpportunities([row(url, 1000)]);
    const pageQueryIssue = extractGscOpportunities([
      { ...row(url, 1000), keys: [url, '匿名クエリ'] },
    ]);

    const result = rankAndDedupeOpportunities(
      [...pageQueryIssue, ...pageIssue].filter(
        (item) => item.issueType === 'low_ctr_high_impressions'
      ),
      10
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.query).toBe('匿名クエリ');
  });
});
