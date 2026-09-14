import type { FactContextSnapshot } from '../context/types';
import {
  internalLinkRegressions,
  isStructuredTextAction,
  structuredTextRegressions,
} from '../content-change';
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
import type { InternalLinkReachability } from './internal-link-reachability';

const CONTENT_STRUCTURE_SEVERITY: HardGateRuleResult['severity'] = 'warn';

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
  rulebookRuleId?: string,
  severity: HardGateRuleResult['severity'] = 'block'
): HardGateRuleResult {
  return {
    ruleId,
    passed,
    severity,
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
  internalLinkReachability?: InternalLinkReachability;
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
  const duplicatedLinks =
    proposal && context && proposal.action === 'addApprovedInternalLink'
      ? proposal.targets.flatMap((target) =>
          internalLinkRegressions(target.proposedValue, context)
        )
      : [];
  const structureRegressions =
    proposal && isStructuredTextAction(proposal.action)
      ? proposal.targets.flatMap((target) =>
          structuredTextRegressions(target.currentValue, target.proposedValue)
        )
      : [];
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
      'internal_link_not_duplicated',
      Boolean(
        proposal &&
          (proposal.action !== 'addApprovedInternalLink' ||
            (context !== null && duplicatedLinks.length === 0))
      ),
      '追加リンクは対象ページの既存リンクと重複しません',
      '追加リンクが既存リンクまたは対象ページ自身と重複します',
      duplicatedLinks.length > 0 ? { regressions: duplicatedLinks } : undefined
    ),
    rule(
      'internal_link_reachable',
      Boolean(
        proposal &&
          (proposal.action !== 'addApprovedInternalLink' ||
            params.internalLinkReachability?.reachable !== false)
      ),
      proposal?.action === 'addApprovedInternalLink' &&
        params.internalLinkReachability?.reachable === null
        ? '内部リンク先の到達性は一時的に判定不能でした'
        : '内部リンク先は到達可能です',
      '内部リンク先が404等で到達できません',
      proposal?.action === 'addApprovedInternalLink'
        ? {
            checked: params.internalLinkReachability?.checked ?? false,
            checks: params.internalLinkReachability?.checks ?? [],
          }
        : undefined,
      'risk.internal_link_reachable.v1'
    ),
    rule(
      'content_structure_preserved',
      Boolean(proposal && structureRegressions.length === 0),
      '既存の見出し・箇条書き・情報量を維持しています',
      '既存の見出し・箇条書き・情報量を削減しています',
      structureRegressions.length > 0
        ? { regressions: structureRegressions }
        : undefined,
      undefined,
      CONTENT_STRUCTURE_SEVERITY
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
    passed: results.every((result) => result.severity === 'warn' || result.passed),
    proposal,
    results,
  };
}
