import { describe, expect, it } from 'vitest';
import {
  rankAndDedupeOpportunities,
  selectPriorityUrls,
  selectReplenishOpportunities,
} from '../../lib/seo-loop/observer';
import { extractGscOpportunities } from '../../lib/gsc/analyze';
import type { GscComparedRow } from '../../lib/gsc/types';
import { isWithinSeoLoopReplenishWindow } from '../../lib/seo-loop/schedule';
import { nextRunStateAfterExecute } from '../../lib/seo-loop/orchestrator';

function row(url: string, impressions: number, query?: string): GscComparedRow {
  return {
    keys: query ? [url, query] : [url],
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

  it('除外URLをpriority対象から外す', () => {
    const rows = [
      row('https://example.invalid/schools/high', 1200),
      row('https://example.invalid/schools/mid', 600),
    ];
    expect(
      selectPriorityUrls(rows, 2, new Set(['https://example.invalid/schools/high']))
    ).toEqual(['https://example.invalid/schools/mid']);
  });
});

describe('rankAndDedupeOpportunities', () => {
  it('page集約のスコアが高くても同じURLのpage×query課題を残す', () => {
    const url = 'https://example.invalid/schools/alpha';
    const pageIssue = extractGscOpportunities([row(url, 1800)]);
    const pageQueryIssue = extractGscOpportunities([
      row(url, 800, '匿名クエリ'),
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

  it('同じURLのquery付き候補同士ではopportunityが高いものを残す', () => {
    const url = 'https://example.invalid/schools/alpha';
    const queryIssues = extractGscOpportunities([
      row(url, 300, '低優先クエリ'),
      row(url, 900, '高優先クエリ'),
    ]).filter((item) => item.issueType === 'low_ctr_high_impressions');

    const result = rankAndDedupeOpportunities(queryIssues, 10);

    expect(result).toHaveLength(1);
    expect(result[0]?.query).toBe('高優先クエリ');
  });

  it('直近に扱ったURLはスコアが高くても後回しにする', () => {
    const recent = 'https://example.invalid/schools/recent';
    const fresh = 'https://example.invalid/schools/fresh';
    const opportunities = extractGscOpportunities([
      row(recent, 2000, '高スコアクエリ'),
      row(fresh, 300, '新規クエリ'),
    ]).filter((item) => item.issueType === 'low_ctr_high_impressions');

    const result = rankAndDedupeOpportunities(
      opportunities,
      10,
      new Set([recent])
    );

    expect(result.map((item) => item.targetUrl)).toEqual([fresh, recent]);
  });

  it('新規URLだけで上限に届かないときは直近URLで埋める', () => {
    const recent = 'https://example.invalid/schools/recent';
    const opportunities = extractGscOpportunities([
      row(recent, 2000, '高スコアクエリ'),
    ]).filter((item) => item.issueType === 'low_ctr_high_impressions');

    expect(
      rankAndDedupeOpportunities(opportunities, 5, new Set([recent]))
    ).toHaveLength(1);
  });
});

describe('selectReplenishOpportunities', () => {
  it('処理済みURLの課題は補充対象にしない', () => {
    const used = 'https://example.invalid/schools/used';
    const fresh = 'https://example.invalid/schools/fresh';
    const opportunities = extractGscOpportunities([
      row(used, 1500, '古いクエリ'),
      row(fresh, 800, '新しいクエリ'),
    ]);

    const result = selectReplenishOpportunities(
      opportunities,
      new Set([`low_ctr_high_impressions:${used}`, `striking_distance:${used}`]),
      new Set(),
      5
    );

    expect(result.every((item) => item.targetUrl === fresh)).toBe(true);
    expect(result.some((item) => item.query === '新しいクエリ')).toBe(true);
  });

  it('対象URLがないクエリ単独課題は補充しない', () => {
    const opportunities = extractGscOpportunities([
      {
        keys: ['通信制高校 口コミ'],
        clicks: 1,
        impressions: 2000,
        ctr: 0.005,
        position: 8,
        previous: null,
        delta: null,
      },
    ]);

    expect(
      selectReplenishOpportunities(opportunities, new Set(), new Set(), 5)
    ).toEqual([]);
  });

  it('既存issue_keyは再追加しない', () => {
    const url = 'https://example.invalid/schools/alpha';
    const opportunities = extractGscOpportunities([row(url, 800, '匿名クエリ')]);
    const existingKeys = new Set(opportunities.map((item) => item.issueKey));

    expect(
      selectReplenishOpportunities(opportunities, new Set(), existingKeys, 5)
    ).toEqual([]);
  });

  it('補充でも直近に扱ったURLより新規URLを先に選ぶ', () => {
    const recent = 'https://example.invalid/schools/recent';
    const fresh = 'https://example.invalid/schools/fresh';
    const opportunities = extractGscOpportunities([
      row(recent, 2000, '高スコアクエリ'),
      row(fresh, 300, '新規クエリ'),
    ]).filter((item) => item.issueType === 'low_ctr_high_impressions');

    const result = selectReplenishOpportunities(
      opportunities,
      new Set(),
      new Set(),
      1,
      new Set([recent])
    );

    expect(result.map((item) => item.targetUrl)).toEqual([fresh]);
  });
});

describe('isWithinSeoLoopReplenishWindow', () => {
  it('JST 9〜18時だけtrueになる', () => {
    // 2026-09-15 00:17 UTC = 09:17 JST
    expect(isWithinSeoLoopReplenishWindow(new Date('2026-09-15T00:17:00.000Z'))).toBe(
      true
    );
    // 2026-09-15 09:17 UTC = 18:17 JST
    expect(isWithinSeoLoopReplenishWindow(new Date('2026-09-15T09:17:00.000Z'))).toBe(
      true
    );
    // 2026-09-15 10:17 UTC = 19:17 JST
    expect(isWithinSeoLoopReplenishWindow(new Date('2026-09-15T10:17:00.000Z'))).toBe(
      false
    );
    // 2026-09-14 23:17 UTC = 08:17 JST
    expect(isWithinSeoLoopReplenishWindow(new Date('2026-09-14T23:17:00.000Z'))).toBe(
      false
    );
  });
});

describe('nextRunStateAfterExecute', () => {
  it('承認待ちが残っていればpending_approvalへ戻す', () => {
    expect(
      nextRunStateAfterExecute({
        remainingPending: 2,
        openIssues: 5,
        remainingBudget: 4,
      })
    ).toBe('pending_approval');
  });

  it('承認後でも未分析課題と予算が残ればanalyzingへ戻す', () => {
    expect(
      nextRunStateAfterExecute({
        remainingPending: 0,
        openIssues: 5,
        remainingBudget: 4,
      })
    ).toBe('analyzing');
  });

  it('課題が尽きても補充可能ならanalyzingへ戻す', () => {
    expect(
      nextRunStateAfterExecute({
        remainingPending: 0,
        openIssues: 0,
        remainingBudget: 4,
        canReplenish: true,
      })
    ).toBe('analyzing');
  });

  it('課題または予算が尽きていればcompletedにする', () => {
    expect(
      nextRunStateAfterExecute({
        remainingPending: 0,
        openIssues: 0,
        remainingBudget: 4,
        canReplenish: false,
      })
    ).toBe('completed');
    expect(
      nextRunStateAfterExecute({
        remainingPending: 0,
        openIssues: 5,
        remainingBudget: 0,
      })
    ).toBe('completed');
  });
});
