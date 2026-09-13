import type { ProposalPayloadV2 } from '../types';
import { isStructuredTextAction, summarizeTextChange } from '../content-change';
import type { SoftEvalDimension, SoftEvalResult } from './types';

function clamp(value: number): number {
  return Math.max(0, Math.min(20, value));
}

function targetMetricPattern(metric: ProposalPayloadV2['targetMetric']): RegExp {
  if (metric === 'ctr') return /CTR|クリック率/iu;
  if (metric === 'clicks') return /クリック/iu;
  if (metric === 'impressions') return /表示回数|インプレッション/iu;
  return /掲載順位|平均順位|順位/iu;
}

function textChangeWarnings(proposal: ProposalPayloadV2): string[] {
  if (!isStructuredTextAction(proposal.action)) return [];
  return proposal.targets.flatMap((target) => {
    const change = summarizeTextChange(target.currentValue, target.proposedValue);
    const changeRate =
      change.currentLength === 0
        ? 1
        : Math.abs(change.proposedLength - change.currentLength) / change.currentLength;
    const warnings: string[] = [];
    if (changeRate < 0.05) {
      warnings.push(`言い換えのみの可能性があります（文字数変化 ${(changeRate * 100).toFixed(1)}%）`);
    }
    if (
      change.proposedLength < change.currentLength &&
      change.addedHeadings.length === 0 &&
      change.addedBulletCount === 0 &&
      change.addedLineCount === 0
    ) {
      warnings.push('短縮のみの変更です。検索意図に対する情報追加がありません');
    }
    return warnings;
  });
}

export function runSoftEval(proposal: ProposalPayloadV2): SoftEvalResult {
  const selectedStatements = new Set(
    proposal.facts.map((fact) => fact.statement.trim())
  );
  const groundedEvidence = proposal.evidence.filter((item) =>
    selectedStatements.has(item.trim())
  ).length;
  const hasGscFact = proposal.facts.some((fact) => fact.source === 'gsc');
  const hasQueryFact = proposal.facts.some(
    (fact) => fact.source === 'gsc' && /^Query:/iu.test(fact.statement)
  );
  const reasoningText = `${proposal.diagnosis}\n${proposal.rationale}`;
  const proposedValues = proposal.targets.map((target) => target.proposedValue);
  const metricMentioned = targetMetricPattern(proposal.targetMetric).test(
    proposal.expectedImpact
  );
  const changeWarnings = textChangeWarnings(proposal);
  const expressionPenalty = changeWarnings.length > 0 ? 4 : 0;

  const dimensions: Record<SoftEvalDimension, number> = {
    evidence: clamp(
      5 +
        Math.min(5, proposal.facts.length * 2) +
        (hasGscFact ? 5 : 0) +
        Math.min(5, groundedEvidence * 2)
    ),
    searchIntent: clamp(
      6 +
        (hasQueryFact ? 8 : 0) +
        (/検索意図|クエリ|検索結果|CTR|クリック/iu.test(reasoningText) ? 6 : 0)
    ),
    causality: clamp(
      (proposal.diagnosis.length >= 20 ? 7 : 4) +
        (proposal.rationale.length >= 20 ? 7 : 4) +
        (/ため|ので|により|結果|一方で/u.test(reasoningText) ? 6 : 2)
    ),
    expressionQuality: clamp(
      (proposedValues.every((value) => value.length > 0 && value === value.trim()) ? 5 : 0) +
        (proposedValues.every((value) => !/[！!？?]{2,}/u.test(value)) ? 5 : 0) +
        (new Set(proposedValues).size === proposedValues.length ? 5 : 0) +
        (proposedValues.every((value) => !/^(改善する|良くなる|おすすめ)$/u.test(value))
          ? 5
          : 0) -
        expressionPenalty
    ),
    expectedImpact: clamp(
      (proposal.expectedImpact.length >= 15 ? 8 : 4) +
        (metricMentioned ? 8 : 2) +
        (proposal.rollbackPlan.length >= 10 ? 4 : 2)
    ),
  };
  const warnings = (Object.entries(dimensions) as Array<[SoftEvalDimension, number]>)
    .filter(([, score]) => score < 12)
    .map(([dimension, score]) => `${dimension}の評価が低いです (${score}/20)`)
    .concat(changeWarnings);

  return {
    version: 'soft-v1',
    dimensions,
    totalScore: Object.values(dimensions).reduce((sum, score) => sum + score, 0),
    warnings,
  };
}
