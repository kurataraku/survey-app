import { describe, expect, it } from 'vitest';
import {
  calculateRolloutMetrics,
  type ShadowObservation,
} from '../../lib/seo-loop/rollout/metrics';

function observation(
  index: number,
  overrides: Partial<ShadowObservation> = {}
): ShadowObservation {
  return {
    runId: `run-${index % 7}`,
    proposalId: `proposal-${index}`,
    mainHardGatePassed: true,
    shadowHardGatePassed: true,
    mainWouldSend: true,
    shadowWouldSend: true,
    decision: index < 7 ? 'approved' : null,
    correctionKey: null,
    ...overrides,
  };
}

describe('Rulebook shadow rollout metrics', () => {
  it('小標本では指標が良くても昇格可能にしない', () => {
    const result = calculateRolloutMetrics({
      runCount: 2,
      issueCount: 3,
      mainProposalCount: 3,
      observations: [observation(0), observation(1), observation(2)],
    });

    expect(result.eligible).toBe(false);
    expect(result.checks.enoughRuns).toBe(false);
    expect(result.checks.enoughEvaluatedProposals).toBe(false);
    expect(result.metricsHash).toHaveLength(64);
  });

  it('7 run・10 proposal・5判断以上で全基準を満たすとready判定する', () => {
    const observations = Array.from({ length: 10 }, (_, index) =>
      observation(index)
    );
    const result = calculateRolloutMetrics({
      runCount: 7,
      issueCount: 10,
      mainProposalCount: 10,
      observations,
    });

    expect(result.eligible).toBe(true);
    expect(Object.values(result.checks).every(Boolean)).toBe(true);
    expect(
      result.metrics.approvalRate.shadowProjected.denominator
    ).toBe(7);
  });

  it('shadowがproposalを過剰に遮断する場合は昇格させない', () => {
    const observations = Array.from({ length: 10 }, (_, index) =>
      observation(index, {
        shadowHardGatePassed: index < 4,
        shadowWouldSend: index < 4,
      })
    );
    const result = calculateRolloutMetrics({
      runCount: 7,
      issueCount: 10,
      mainProposalCount: 10,
      observations,
    });

    expect(result.eligible).toBe(false);
    expect(result.checks.slackReachabilityRetention).toBe(false);
    expect(result.checks.hardGatePassRate).toBe(false);
  });

  it('同じproposalの実判断だけでshadow承認率・修正率を投影する', () => {
    const observations = Array.from({ length: 10 }, (_, index) =>
      observation(index, {
        decision:
          index < 5
            ? 'approved'
            : index < 8
              ? 'revision_requested'
              : null,
        shadowWouldSend: index !== 5,
        correctionKey:
          index === 5 || index === 6
            ? 'updateSchoolMetaTitle:school:1:poor_expression'
            : null,
      })
    );
    const result = calculateRolloutMetrics({
      runCount: 7,
      issueCount: 10,
      mainProposalCount: 10,
      observations,
    });

    expect(result.metrics.approvalRate.main).toMatchObject({
      numerator: 5,
      denominator: 8,
    });
    expect(result.metrics.approvalRate.shadowProjected).toMatchObject({
      numerator: 5,
      denominator: 7,
    });
    expect(
      result.metrics.sameCorrectionRecurrenceRate.main.rate
    ).toBe(0.5);
    expect(
      result.metrics.sameCorrectionRecurrenceRate.shadowProjected.rate
    ).toBe(0);
  });
});
