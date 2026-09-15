import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PAGE_TOP_QUERY_LIMIT } from '../../lib/seo-loop/analysis/page-queries';

vi.mock('@/lib/gsc/client', () => ({
  getGscSiteUrl: vi.fn(() => 'https://example.invalid/'),
  compareSearchAnalytics: vi.fn(),
}));

vi.mock('@/lib/gsc/periods', () => ({
  getGscComparisonPeriods: vi.fn(() => ({
    current: { startDate: '2026-08-01', endDate: '2026-08-28' },
    previous: { startDate: '2026-07-04', endDate: '2026-07-31' },
  })),
}));

describe('fetchPageTopQueries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('対象ページのquery次元を上位件数で取得する', async () => {
    const { compareSearchAnalytics } = await import('@/lib/gsc/client');
    const { fetchPageTopQueries } = await import(
      '../../lib/seo-loop/analysis/page-queries'
    );

    vi.mocked(compareSearchAnalytics).mockResolvedValue({
      current: { startDate: '2026-08-01', endDate: '2026-08-28' },
      previous: { startDate: '2026-07-04', endDate: '2026-07-31' },
      rows: [
        {
          keys: ['匿名校 口コミ'],
          clicks: 3,
          impressions: 500,
          ctr: 0.006,
          position: 8.5,
          previous: null,
          delta: { clicks: 1, impressions: 20, ctr: 0.001, position: -0.5 },
        },
        {
          keys: ['  '],
          clicks: 0,
          impressions: 10,
          ctr: 0,
          position: 20,
          previous: null,
          delta: { clicks: 0, impressions: 0, ctr: 0, position: 0 },
        },
      ],
    });

    const rows = await fetchPageTopQueries({
      pageUrl: 'https://example.invalid/tsushin-kuchikomi/schools/anonymous',
      gscDays: 28,
    });

    expect(compareSearchAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        dimensions: ['query'],
        rowLimit: PAGE_TOP_QUERY_LIMIT,
        page: 'https://example.invalid/tsushin-kuchikomi/schools/anonymous',
      })
    );
    expect(rows).toEqual([
      {
        query: '匿名校 口コミ',
        clicks: 3,
        impressions: 500,
        ctr: 0.006,
        position: 8.5,
        deltaClicks: 1,
      },
    ]);
  });
});
