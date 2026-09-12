import { payloadHash } from '../hash';

export const ROLLOUT_METRICS_VERSION = 'rulebook-shadow-v1';

export const ROLLOUT_READINESS_POLICY = {
  minRuns: 7,
  minEvaluatedProposals: 10,
  minObservedDecisions: 5,
  minSlackReachabilityRetentionRatio: 0.5,
  maxHardGatePassRateDrop: 0.25,
  maxApprovalRateDrop: 0.05,
  maxRevisionRateIncrease: 0.05,
  maxCorrectionRecurrenceIncrease: 0.05,
} as const;

export type ObservedDecision =
  | 'approved'
  | 'rejected'
  | 'revision_requested'
  | null;

export type ShadowObservation = {
  runId: string;
  proposalId: string;
  mainHardGatePassed: boolean;
  shadowHardGatePassed: boolean;
  mainWouldSend: boolean;
  shadowWouldSend: boolean;
  decision: ObservedDecision;
  correctionKey: string | null;
};

export type RolloutMetricInput = {
  runCount: number;
  issueCount: number;
  mainProposalCount: number;
  observations: ShadowObservation[];
};

type RateMetric = {
  numerator: number;
  denominator: number;
  rate: number | null;
};

function rate(numerator: number, denominator: number): RateMetric {
  return {
    numerator,
    denominator,
    rate: denominator > 0 ? numerator / denominator : null,
  };
}

function correctionRecurrence(
  observations: ShadowObservation[],
  include: (observation: ShadowObservation) => boolean
): RateMetric {
  const keys = observations
    .filter(
      (observation) =>
        include(observation) &&
        observation.correctionKey &&
        (observation.decision === 'rejected' ||
          observation.decision === 'revision_requested')
    )
    .map((observation) => observation.correctionKey!);
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  const repeated = [...counts.values()].reduce(
    (total, count) => total + Math.max(0, count - 1),
    0
  );
  return rate(repeated, keys.length);
}

function atLeast(
  candidate: number | null,
  baseline: number | null,
  allowedDrop: number
): boolean {
  return (
    candidate !== null &&
    baseline !== null &&
    candidate + allowedDrop >= baseline
  );
}

function atMost(
  candidate: number | null,
  baseline: number | null,
  allowedIncrease: number
): boolean {
  return (
    candidate !== null &&
    baseline !== null &&
    candidate <= baseline + allowedIncrease
  );
}

export function calculateRolloutMetrics(input: RolloutMetricInput) {
  const mainDecisioned = input.observations.filter(
    (observation) => observation.mainWouldSend && observation.decision
  );
  const shadowDecisioned = input.observations.filter(
    (observation) => observation.shadowWouldSend && observation.decision
  );
  const mainProposalGeneration = rate(
    input.mainProposalCount,
    input.issueCount
  );
  // Unit 8のTyped Patchはrisk scopeだけを変更するため、Analyst/Strategistの
  // 生成件数は旧新版で同一。通過差は別のSlack到達可能率として扱う。
  const shadowProposalGeneration = rate(
    input.mainProposalCount,
    input.issueCount
  );
  const mainSlackReachability = rate(
    input.observations.filter((observation) => observation.mainWouldSend)
      .length,
    input.observations.length
  );
  const shadowSlackReachability = rate(
    input.observations.filter((observation) => observation.shadowWouldSend)
      .length,
    input.observations.length
  );
  const mainHardGatePass = rate(
    input.observations.filter((observation) => observation.mainHardGatePassed)
      .length,
    input.observations.length
  );
  const shadowHardGatePass = rate(
    input.observations.filter(
      (observation) => observation.shadowHardGatePassed
    ).length,
    input.observations.length
  );
  const mainApproval = rate(
    mainDecisioned.filter((observation) => observation.decision === 'approved')
      .length,
    mainDecisioned.length
  );
  const shadowProjectedApproval = rate(
    shadowDecisioned.filter(
      (observation) => observation.decision === 'approved'
    ).length,
    shadowDecisioned.length
  );
  const mainRevision = rate(
    mainDecisioned.filter(
      (observation) => observation.decision === 'revision_requested'
    ).length,
    mainDecisioned.length
  );
  const shadowProjectedRevision = rate(
    shadowDecisioned.filter(
      (observation) => observation.decision === 'revision_requested'
    ).length,
    shadowDecisioned.length
  );
  const mainCorrectionRecurrence = correctionRecurrence(
    input.observations,
    (observation) => observation.mainWouldSend
  );
  const shadowProjectedCorrectionRecurrence = correctionRecurrence(
    input.observations,
    (observation) => observation.shadowWouldSend
  );

  const checks = {
    enoughRuns: input.runCount >= ROLLOUT_READINESS_POLICY.minRuns,
    enoughEvaluatedProposals:
      input.observations.length >=
      ROLLOUT_READINESS_POLICY.minEvaluatedProposals,
    enoughObservedDecisions:
      mainDecisioned.length >= ROLLOUT_READINESS_POLICY.minObservedDecisions &&
      shadowDecisioned.length >=
        ROLLOUT_READINESS_POLICY.minObservedDecisions,
    slackReachabilityRetention:
      mainSlackReachability.rate !== null &&
      shadowSlackReachability.rate !== null &&
      (mainSlackReachability.rate === 0
        ? shadowSlackReachability.rate === 0
        : shadowSlackReachability.rate / mainSlackReachability.rate >=
          ROLLOUT_READINESS_POLICY.minSlackReachabilityRetentionRatio),
    hardGatePassRate:
      atLeast(
        shadowHardGatePass.rate,
        mainHardGatePass.rate,
        ROLLOUT_READINESS_POLICY.maxHardGatePassRateDrop
      ),
    projectedApprovalRate:
      atLeast(
        shadowProjectedApproval.rate,
        mainApproval.rate,
        ROLLOUT_READINESS_POLICY.maxApprovalRateDrop
      ),
    projectedRevisionRate:
      atMost(
        shadowProjectedRevision.rate,
        mainRevision.rate,
        ROLLOUT_READINESS_POLICY.maxRevisionRateIncrease
      ),
    projectedCorrectionRecurrence:
      mainCorrectionRecurrence.denominator === 0 &&
      shadowProjectedCorrectionRecurrence.denominator === 0
        ? true
        : atMost(
            shadowProjectedCorrectionRecurrence.rate,
            mainCorrectionRecurrence.rate,
            ROLLOUT_READINESS_POLICY.maxCorrectionRecurrenceIncrease
          ),
  };
  const eligible = Object.values(checks).every(Boolean);
  const result = {
    version: ROLLOUT_METRICS_VERSION,
    measurementMode: 'counterfactual_same_proposal_filter' as const,
    eligible,
    checks,
    samples: {
      runs: input.runCount,
      issues: input.issueCount,
      evaluatedProposals: input.observations.length,
      mainObservedDecisions: mainDecisioned.length,
      shadowObservedDecisions: shadowDecisioned.length,
    },
    metrics: {
      proposalGenerationRate: {
        main: mainProposalGeneration,
        shadow: shadowProposalGeneration,
      },
      slackReachabilityRate: {
        main: mainSlackReachability,
        shadow: shadowSlackReachability,
      },
      hardGatePassRate: {
        main: mainHardGatePass,
        shadow: shadowHardGatePass,
      },
      approvalRate: {
        main: mainApproval,
        shadowProjected: shadowProjectedApproval,
      },
      revisionRate: {
        main: mainRevision,
        shadowProjected: shadowProjectedRevision,
      },
      sameCorrectionRecurrenceRate: {
        main: mainCorrectionRecurrence,
        shadowProjected: shadowProjectedCorrectionRecurrence,
      },
    },
  };
  return { ...result, metricsHash: payloadHash(result) };
}
