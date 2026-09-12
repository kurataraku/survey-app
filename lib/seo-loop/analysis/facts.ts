import { stableJson } from '../hash';
import type { FactContextSnapshot } from '../context/types';
import type { AnalysisFact, AnalystOutput } from './types';

type IssueForFacts = {
  issueType: string;
  title: string;
  description: string | null;
  query: string | null;
  gscSnapshot: unknown;
  scores: unknown;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function minimumFactErrors(
  issue: Pick<IssueForFacts, 'issueType' | 'gscSnapshot'>,
  context: FactContextSnapshot
): string[] {
  const errors: string[] = [];
  if (!context.target.id || context.target.pageType === 'other') {
    errors.push('対象ページの内部IDまたはページ種別が不明です');
  }
  const snapshot = record(issue.gscSnapshot);
  if (!snapshot) return [...errors, 'GSC snapshotがありません'];

  const impressions = finiteNumber(snapshot.impressions);
  const ctr = finiteNumber(snapshot.ctr);
  const position = finiteNumber(snapshot.position);
  if (impressions === null || impressions <= 0) {
    errors.push('GSC impressionsの実測値がありません');
  }

  if (
    issue.issueType === 'low_ctr_high_impressions' &&
    (impressions === null || impressions < 200 || ctr === null || ctr >= 0.02)
  ) {
    errors.push('低CTR課題を裏付けるGSC実測値が不足しています');
  }
  if (
    issue.issueType === 'striking_distance' &&
    (impressions === null ||
      impressions < 100 ||
      position === null ||
      position < 5 ||
      position > 15)
  ) {
    errors.push('5〜15位圏の課題を裏付けるGSC実測値が不足しています');
  }
  if (issue.issueType === 'declining_clicks') {
    const deltaClicks = finiteNumber(record(snapshot.delta)?.clicks);
    if (deltaClicks === null || deltaClicks > -10) {
      errors.push('クリック下落を裏付ける前期間差分が不足しています');
    }
  }
  return errors;
}

function compact(value: unknown, maxLength = 1200): string {
  const serialized = stableJson(value);
  return serialized.length <= maxLength
    ? serialized
    : `${serialized.slice(0, maxLength)}…`;
}

export function buildFactInventory(
  issue: IssueForFacts,
  context: FactContextSnapshot
): AnalysisFact[] {
  const facts: AnalysisFact[] = [
    {
      id: 'gsc.issue',
      source: 'gsc',
      statement: `${issue.issueType}: ${issue.title}${issue.description ? ` / ${issue.description}` : ''}`,
    },
    {
      id: 'gsc.snapshot',
      source: 'gsc',
      statement: `GSC snapshot: ${compact(issue.gscSnapshot)}`,
    },
    {
      id: 'html.status',
      source: 'html',
      statement: `HTTP status: ${context.html.status}`,
    },
  ];

  if (issue.query) {
    facts.push({
      id: 'gsc.query',
      source: 'gsc',
      statement: `Query: ${issue.query}`,
    });
  }

  const htmlValues: Array<[string, string | null]> = [
    ['title', context.html.title],
    ['description', context.html.description],
    ['canonical', context.html.canonical],
    ['robots', context.html.robots],
    ['h1', context.html.h1],
  ];
  for (const [key, value] of htmlValues) {
    if (value !== null) {
      facts.push({
        id: `html.${key}`,
        source: 'html',
        statement: `${key}: ${value}`,
      });
    }
  }

  facts.push({
    id: 'database.target',
    source: 'database',
    statement: `Target: ${context.target.pageType}/${context.target.id}/${context.target.url}`,
  });
  facts.push({
    id: 'database.snapshot',
    source: 'database',
    statement: `Database snapshot: ${compact(context.database)}`,
  });
  facts.push({
    id: 'gsc.scores',
    source: 'gsc',
    statement: `Opportunity scores: ${compact(issue.scores)}`,
  });

  return facts;
}

export function validateAnalystGrounding(
  output: AnalystOutput,
  inventory: AnalysisFact[]
): string[] {
  const factIds = new Set(inventory.map((fact) => fact.id));
  const errors = output.selectedFactIds
    .filter((id) => !factIds.has(id))
    .map((id) => `Fact inventoryに存在しないIDです: ${id}`);
  if (new Set(output.selectedFactIds).size !== output.selectedFactIds.length) {
    errors.push('selectedFactIdsに重複があります');
  }
  return errors;
}

export function selectedFacts(
  output: AnalystOutput,
  inventory: AnalysisFact[]
): AnalysisFact[] {
  const selected = new Set(output.selectedFactIds);
  return inventory.filter((fact) => selected.has(fact.id));
}
