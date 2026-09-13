import { retryableContentChangeRegressions } from '../content-change';
import type { ProposalPayloadV2, TypedAction } from '../types';
import type { FactContextSnapshot } from './types';

function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  return url.toString();
}

export function validateProposalAgainstContext(
  proposal: ProposalPayloadV2,
  context: FactContextSnapshot
): string[] {
  const errors: string[] = [];
  const expectedType =
    proposal.action === 'addApprovedInternalLink' ? 'url' : context.target.pageType;
  const currentValue = context.currentValues[proposal.action as TypedAction];

  if (currentValue === undefined) {
    errors.push(`実測currentValueがありません: ${proposal.action}`);
  }

  for (const target of proposal.targets) {
    if (target.type !== expectedType) {
      errors.push(`対象typeがページ種別/actionと一致しません: ${target.type}/${expectedType}`);
    }
    if (!context.target.id || target.id !== context.target.id) {
      errors.push(`対象IDが実測値と一致しません: ${target.id}`);
    }
    try {
      if (normalizeUrl(target.url) !== normalizeUrl(context.target.url)) {
        errors.push(`対象URLが実測値と一致しません: ${target.url}`);
      }
    } catch {
      errors.push(`対象URLを正規化できません: ${target.url}`);
    }
    if (currentValue === undefined || target.currentValue !== currentValue) {
      errors.push('currentValueが実測値と一致しません');
    }
    if (proposal.action === 'addApprovedInternalLink') {
      try {
        if (new URL(target.proposedValue).origin !== new URL(context.target.url).origin) {
          errors.push('追加リンク先は対象ページと同一originである必要があります');
        }
      } catch {
        errors.push('追加リンク先URLが不正です');
      }
    }
  }

  errors.push(...retryableContentChangeRegressions(proposal, context));

  return [...new Set(errors)];
}
