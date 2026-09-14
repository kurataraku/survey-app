import type { RiskLevel } from '../risk-rules';

export type HardGateRuleId =
  | 'schema_v2'
  | 'allowlisted_action'
  | 'target_exists'
  | 'action_type_match'
  | 'current_value_match'
  | 'value_changed'
  | 'value_length'
  | 'brand_not_duplicated'
  | 'no_forbidden_expression'
  | 'no_duplicate_proposal'
  | 'internal_link_same_origin'
  | 'internal_link_not_duplicated'
  | 'internal_link_reachable'
  | 'content_structure_preserved'
  | 'target_limit'
  | 'daily_proposal_limit';

export type HardGateRuleResult = {
  ruleId: HardGateRuleId;
  passed: boolean;
  severity: 'block' | 'warn';
  message: string;
  details?: Record<string, unknown>;
  rulebookRuleId?: string;
};

export type SoftEvalDimension =
  | 'evidence'
  | 'searchIntent'
  | 'causality'
  | 'expressionQuality'
  | 'expectedImpact';

export type SoftEvalResult = {
  version: 'soft-v1';
  dimensions: Record<SoftEvalDimension, number>;
  totalScore: number;
  warnings: string[];
};

export type ProposalEvaluationResult = {
  version: 'quality-v1';
  passed: boolean;
  retryable: boolean;
  hardGatePassed: boolean;
  hardGateResults: HardGateRuleResult[];
  softEval: SoftEvalResult;
  softThreshold: number;
  riskLevel: RiskLevel;
  blockReasons: string[];
  warnings: string[];
};
