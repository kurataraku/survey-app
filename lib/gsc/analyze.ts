import type { GscComparedRow } from './types';

export type GscOpportunity = {
  issueKey: string;
  issueType: 'low_ctr_high_impressions' | 'striking_distance' | 'declining_clicks';
  title: string;
  description: string;
  targetUrl?: string;
  query?: string;
  gscSnapshot: Record<string, unknown>;
  scores: {
    impact: number;
    confidence: number;
    opportunity: number;
  };
};

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function asUrl(row: GscComparedRow): string | undefined {
  return row.keys.find((key) => key.startsWith('http://') || key.startsWith('https://'));
}

function asQuery(row: GscComparedRow): string | undefined {
  return row.keys.find((key) => !key.startsWith('http://') && !key.startsWith('https://'));
}

function snapshot(row: GscComparedRow): Record<string, unknown> {
  return {
    keys: row.keys,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
    previous: row.previous,
    delta: row.delta,
  };
}

export function extractGscOpportunities(rows: GscComparedRow[]): GscOpportunity[] {
  const opportunities: GscOpportunity[] = [];

  for (const row of rows) {
    const targetUrl = asUrl(row);
    const query = asQuery(row);

    if (row.impressions >= 200 && row.ctr < 0.02) {
      opportunities.push({
        issueKey: `low-ctr:${row.keys.join('|')}`,
        issueType: 'low_ctr_high_impressions',
        title: '表示回数が多いがCTRが低い',
        description: `表示回数 ${row.impressions} に対してCTRが ${pct(row.ctr)} です。`,
        targetUrl,
        query,
        gscSnapshot: snapshot(row),
        scores: {
          impact: Math.min(1, row.impressions / 5000),
          confidence: 0.75,
          opportunity: Math.min(1, row.impressions / 5000) * (0.02 - row.ctr + 0.02),
        },
      });
    }

    if (row.position >= 5 && row.position <= 15 && row.impressions >= 100) {
      opportunities.push({
        issueKey: `striking-distance:${row.keys.join('|')}`,
        issueType: 'striking_distance',
        title: '5〜15位圏で改善余地がある',
        description: `平均掲載順位が ${row.position.toFixed(1)} 位で、表示回数が ${row.impressions} あります。`,
        targetUrl,
        query,
        gscSnapshot: snapshot(row),
        scores: {
          impact: Math.min(1, row.impressions / 3000),
          confidence: 0.7,
          opportunity: Math.min(1, row.impressions / 3000) * 0.8,
        },
      });
    }

    if (row.delta && row.delta.clicks <= -10) {
      opportunities.push({
        issueKey: `declining-clicks:${row.keys.join('|')}`,
        issueType: 'declining_clicks',
        title: '前期間からクリックが下落している',
        description: `前期間比でクリックが ${row.delta.clicks} 減少しています。`,
        targetUrl,
        query,
        gscSnapshot: snapshot(row),
        scores: {
          impact: Math.min(1, Math.abs(row.delta.clicks) / 100),
          confidence: 0.65,
          opportunity: Math.min(1, Math.abs(row.delta.clicks) / 100) * 0.7,
        },
      });
    }
  }

  return opportunities
    .sort((a, b) => b.scores.opportunity - a.scores.opportunity)
    .slice(0, 20);
}
