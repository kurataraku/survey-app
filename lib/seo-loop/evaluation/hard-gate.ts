import type { FactContextSnapshot } from '../context/types';
import {
  ACTION_VALUE_LIMITS,
  containsSiteBrand,
  forbiddenExpressions,
  repeatedBrandName,
} from '../risk-rules';
import {
  proposalPayloadV2Schema,
  typedActionSchema,
  type ProposalPayloadV2,
} from '../types';
import type { HardGateRuleResult } from './types';
import type { RulebookContent } from '../rulebook/schema';

function normalizedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function rule(
  ruleId: HardGateRuleResult['ruleId'],
  passed: boolean,
  success: string,
  failure: string,
  details?: Record<string, unknown>,
  rulebookRuleId?: string
): HardGateRuleResult {
  return {
    ruleId,
    passed,
    message: passed ? success : failure,
    ...(details ? { details } : {}),
    ...(rulebookRuleId ? { rulebookRuleId } : {}),
  };
}

export function runHardGate(params: {
  payload: unknown;
  context: FactContextSnapshot | null;
  phase?: 'approval' | 'execution';
  duplicateProposal: boolean;
  dailyProposalCount: number;
  maxDailyProposals: number;
  maxTargetsPerProposal: number;
  actionValueLimits?: RulebookContent['risk']['actionValueLimits'];
  forbiddenExpressionIds?: RulebookContent['risk']['forbiddenExpressionIds'];
}): { passed: boolean; proposal: ProposalPayloadV2 | null; results: HardGateRuleResult[] } {
  const rawAction =
    params.payload && typeof params.payload === 'object' && 'action' in params.payload
      ? (params.payload as { action?: unknown }).action
      : undefined;
  const allowlisted = typedActionSchema.safeParse(rawAction).success;
  const parsed = proposalPayloadV2Schema.safeParse(params.payload);
  const proposal = parsed.success ? parsed.data : null;
  const context = params.context;
  const expectedType = proposal
    ? proposal.action === 'addApprovedInternalLink'
      ? 'url'
      : context?.target.pageType
    : undefined;

  const targetExists = Boolean(
    proposal &&
      context?.database &&
      context.database.isPublic &&
      context.target.id &&
      proposal.targets.every(
        (target) =>
          target.id === context.target.id &&
          target.id === context.database?.id &&
          normalizedUrl(target.url) === normalizedUrl(context.target.url)
      )
  );
  const actionTypeMatch = Boolean(
    proposal &&
      expectedType &&
      expectedType !== 'other' &&
      proposal.targets.every((target) => target.type === expectedType)
  );
  const currentValueMatch = Boolean(
    proposal &&
      context &&
      context.currentValues[proposal.action] !== undefined &&
      proposal.targets.every(
        (target) => target.currentValue === context.currentValues[proposal.action]
      )
  );
  const valueChanged = Boolean(
    proposal &&
      proposal.targets.every(
        (target) => target.currentValue.trim() !== target.proposedValue.trim()
      )
  );
  const valueLength = Boolean(
    proposal &&
      proposal.targets.every((target) => {
        const limit =
          params.actionValueLimits?.[proposal.action] ??
          ACTION_VALUE_LIMITS[proposal.action];
        const length = target.proposedValue.trim().length;
        return length >= limit.min && length <= limit.max;
      })
  );
  const repeatedBrand = proposal && context ? repeatedBrandName(proposal, context) : null;
  const hasSiteBrand = proposal ? containsSiteBrand(proposal) : false;
  const forbidden = proposal
    ? forbiddenExpressions(proposal, params.forbiddenExpressionIds)
    : [];
  const internalLinkSameOrigin = Boolean(
    proposal &&
      context &&
      (proposal.action !== 'addApprovedInternalLink' ||
        proposal.targets.every(
          (target) =>
            normalizedUrl(target.proposedValue) !== null &&
            new URL(target.proposedValue).origin === new URL(context.target.url).origin
        ))
  );
  const targetCount = proposal?.targets.length ?? 0;
  const approvalPhase = (params.phase ?? 'approval') === 'approval';

  const results: HardGateRuleResult[] = [
    rule(
      'schema_v2',
      parsed.success,
      'Proposal v2 schemaに適合しています',
      'Proposal v2 schemaに適合しません',
      parsed.success ? undefined : { issues: parsed.error.issues }
    ),
    rule(
      'allowlisted_action',
      allowlisted,
      'actionはAllowlist内です',
      'Allowlist外のactionです',
      undefined,
      'risk.typed_action_allowlist.v1'
    ),
    rule(
      'target_exists',
      targetExists,
      '公開対象のID・URLが実在します',
      '公開対象のID・URLを現在のFact Contextで確認できません'
    ),
    rule(
      'action_type_match',
      actionTypeMatch,
      'actionと対象typeが一致します',
      'actionと対象typeが一致しません'
    ),
    rule(
      'current_value_match',
      currentValueMatch,
      'currentValueは最新実測値と一致します',
      'currentValueが最新実測値と一致しません'
    ),
    rule(
      'value_changed',
      valueChanged,
      '変更前後の値が異なります',
      '同値または空白差だけの変更です'
    ),
    rule(
      'value_length',
      valueLength,
      '変更値は文字数範囲内です',
      '変更値がaction別の文字数範囲外です',
      proposal
        ? {
            limit:
              params.actionValueLimits?.[proposal.action] ??
              ACTION_VALUE_LIMITS[proposal.action],
          }
        : undefined,
      'risk.action_value_limits.v1'
    ),
    rule(
      'brand_not_duplicated',
      !repeatedBrand && !hasSiteBrand,
      'ブランド重複はありません',
      '学校名またはサイトブランドが重複します',
      { repeatedBrand, hasSiteBrand }
    ),
    rule(
      'no_forbidden_expression',
      forbidden.length === 0,
      '禁止表現はありません',
      '誇大・保証表現を検出しました',
      { patterns: forbidden },
      'risk.forbidden_expressions.v1'
    ),
    rule(
      'no_duplicate_proposal',
      !approvalPhase || !params.duplicateProposal,
      '同じ対象/actionの未完了提案はありません',
      '同じ対象/actionの未完了提案が既にあります'
    ),
    rule(
      'internal_link_same_origin',
      internalLinkSameOrigin,
      '内部リンク先は同一originです',
      '内部リンク先が対象サイトと同一originではありません',
      undefined,
      'risk.same_origin_link.v1'
    ),
    rule(
      'target_limit',
      targetCount > 0 && targetCount <= params.maxTargetsPerProposal,
      '1 proposalあたりの対象件数上限内です',
      '1 proposalあたりの対象件数上限を超えています',
      { actual: targetCount, max: params.maxTargetsPerProposal },
      'ops.target_limit.v1'
    ),
    rule(
      'daily_proposal_limit',
      !approvalPhase || params.dailyProposalCount <= params.maxDailyProposals,
      '1日あたりのproposal上限内です',
      '1日あたりのproposal上限を超えています',
      { actual: params.dailyProposalCount, max: params.maxDailyProposals },
      'ops.daily_proposal_limit.v1'
    ),
  ];

  return {
    passed: results.every((result) => result.passed),
    proposal,
    results,
  };
}
