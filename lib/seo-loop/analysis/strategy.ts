import { z } from 'zod';
import type { FactContextSnapshot } from '../context/types';
import {
  proposalPayloadV2Schema,
  typedActionSchema,
  type ProposalPayloadV2,
  type TypedAction,
} from '../types';
import type { AnalysisFact, AnalystOutput } from './types';

export const strategistOutputSchema = z.object({
  proposal: z
    .object({
      action: typedActionSchema,
      proposedValue: z.string().min(1),
      rationale: z.string().min(1),
      expectedImpact: z.string().min(1),
      rollbackPlan: z.string().min(1),
    })
    .nullable(),
});

export type StrategistOutput = z.infer<typeof strategistOutputSchema>;

export function validateStrategistAction(
  output: StrategistOutput,
  candidateActions: TypedAction[]
): string[] {
  if (!output.proposal) return [];
  return candidateActions.includes(output.proposal.action)
    ? []
    : [`issue typeの候補外actionです: ${output.proposal.action}`];
}

function targetType(action: TypedAction): 'school' | 'feature' | 'url' {
  if (action === 'updateFeatureMetaDescription') return 'feature';
  if (action === 'addApprovedInternalLink') return 'url';
  return 'school';
}

export function assembleProposalV2(params: {
  strategist: StrategistOutput;
  analyst: AnalystOutput;
  selectedFacts: AnalysisFact[];
  context: FactContextSnapshot;
  ruleIds?: string[];
}): ProposalPayloadV2 | null {
  const strategy = params.strategist.proposal;
  if (!strategy) return null;
  if (
    !params.analyst.sufficient ||
    !params.analyst.diagnosis ||
    !params.analyst.targetMetric ||
    !params.context.target.id
  ) {
    throw new Error('Proposal v2の組み立てに必要な分析・対象Factが不足しています');
  }

  const currentValue = params.context.currentValues[strategy.action];
  if (currentValue === undefined) {
    throw new Error(`実測currentValueがありません: ${strategy.action}`);
  }

  return proposalPayloadV2Schema.parse({
    schemaVersion: 2,
    action: strategy.action,
    targets: [
      {
        type: targetType(strategy.action),
        id: params.context.target.id,
        url: params.context.target.url,
        currentValue,
        proposedValue: strategy.proposedValue,
      },
    ],
    facts: params.selectedFacts.map(({ source, statement }) => ({ source, statement })),
    assumptions: params.analyst.hypotheses,
    diagnosis: params.analyst.diagnosis,
    targetMetric: params.analyst.targetMetric,
    confidence: params.analyst.confidence,
    ruleIds: params.ruleIds ?? [],
    rollbackPlan: strategy.rollbackPlan,
    rationale: strategy.rationale,
    expectedImpact: strategy.expectedImpact,
    evidence: params.selectedFacts.map((fact) => fact.statement),
  });
}
