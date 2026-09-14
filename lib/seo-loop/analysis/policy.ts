import type { FactContextSnapshot } from '../context/types';
import type { TypedAction } from '../types';
import type { RulebookContent } from '../rulebook/schema';

export type SeoIssueType =
  | 'low_ctr_high_impressions'
  | 'striking_distance'
  | 'declining_clicks';

export const ISSUE_ACTION_CANDIDATES: Record<SeoIssueType, readonly TypedAction[]> = {
  low_ctr_high_impressions: [
    'updateSchoolMetaTitle',
    'updateFeatureMetaDescription',
  ],
  striking_distance: [
    'updateSchoolMetaTitle',
    'updateFeatureMetaDescription',
    'updateSeoSummary',
    'addApprovedInternalLink',
  ],
  declining_clicks: [
    'updateSchoolMetaTitle',
    'updateFeatureMetaDescription',
    'updateSeoSummary',
    'addApprovedInternalLink',
  ],
};

function actionMatchesPage(action: TypedAction, context: FactContextSnapshot): boolean {
  if (action === 'updateSchoolMetaTitle' || action === 'updateSeoSummary') {
    return context.target.pageType === 'school';
  }
  if (action === 'updateFeatureMetaDescription') {
    return context.target.pageType === 'feature';
  }
  return context.target.pageType !== 'other';
}

export function candidateActionsForIssue(
  issueType: string,
  context: FactContextSnapshot,
  rulebook?: RulebookContent['analyzer']
): TypedAction[] {
  const candidates = rulebook?.issueActionCandidates ?? ISSUE_ACTION_CANDIDATES;
  if (!(issueType in candidates)) return [];
  const codeAllowed = new Set(
    ISSUE_ACTION_CANDIDATES[issueType as SeoIssueType]
  );
  return candidates[issueType as SeoIssueType].filter(
    (action) =>
      codeAllowed.has(action) &&
      actionMatchesPage(action, context) &&
      context.currentValues[action] !== undefined
  );
}
