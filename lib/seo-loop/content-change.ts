import type { FactContextSnapshot } from './context/types';
import type { ProposalPayloadV2, TypedAction } from './types';

/** 見出し・箇条書き構造を持つ本文を扱うaction */
const STRUCTURED_TEXT_ACTIONS: ReadonlySet<TypedAction> = new Set([
  'updateSeoSummary',
]);

/** 本文変更で残すべき最小文字数比率。これを下回る短縮は情報削減として扱う */
export const STRUCTURED_TEXT_MIN_RETAINED_RATIO = 0.8;

export type TextChangeSummary = {
  currentLength: number;
  proposedLength: number;
  retainedRatio: number;
  removedHeadings: string[];
  addedHeadings: string[];
  removedBulletCount: number;
  addedBulletCount: number;
  removedLineCount: number;
  addedLineCount: number;
};

function meaningfulLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function headings(value: string): string[] {
  return meaningfulLines(value)
    .filter((line) => /^#{1,6}\s+/u.test(line))
    .map((line) => line.replace(/^#{1,6}\s+/u, '').trim());
}

function bullets(value: string): string[] {
  return meaningfulLines(value)
    .filter((line) => /^[-・*]\s+/u.test(line))
    .map((line) => line.replace(/^[-・*]\s+/u, '').trim());
}

function onlyIn(before: string[], after: string[]): string[] {
  const remaining = new Set(after);
  return [...new Set(before.filter((item) => !remaining.has(item)))];
}

export function summarizeTextChange(
  currentValue: string,
  proposedValue: string
): TextChangeSummary {
  const currentLength = currentValue.trim().length;
  const proposedLength = proposedValue.trim().length;
  const currentBullets = bullets(currentValue);
  const proposedBullets = bullets(proposedValue);

  return {
    currentLength,
    proposedLength,
    retainedRatio: currentLength === 0 ? 1 : proposedLength / currentLength,
    removedHeadings: onlyIn(headings(currentValue), headings(proposedValue)),
    addedHeadings: onlyIn(headings(proposedValue), headings(currentValue)),
    removedBulletCount: onlyIn(currentBullets, proposedBullets).length,
    addedBulletCount: onlyIn(proposedBullets, currentBullets).length,
    removedLineCount: onlyIn(
      meaningfulLines(currentValue),
      meaningfulLines(proposedValue)
    ).length,
    addedLineCount: onlyIn(
      meaningfulLines(proposedValue),
      meaningfulLines(currentValue)
    ).length,
  };
}

/**
 * 既存の見出し・箇条書き・情報量を落とす本文変更を検出する。
 * 「短くする」こと自体はSEO改善の根拠にならないため、情報削減は理由なしに許可しない。
 */
export function structuredTextRegressions(
  currentValue: string,
  proposedValue: string
): string[] {
  const change = summarizeTextChange(currentValue, proposedValue);
  const regressions: string[] = [];

  if (change.removedHeadings.length > 0) {
    regressions.push(
      `既存の見出しを削除しています: ${change.removedHeadings.join(' / ')}`
    );
  }
  const lostBullets = change.removedBulletCount - change.addedBulletCount;
  if (lostBullets > 0) {
    regressions.push(`既存の箇条書きが${lostBullets}件減っています`);
  }
  if (change.retainedRatio < STRUCTURED_TEXT_MIN_RETAINED_RATIO) {
    regressions.push(
      `本文を${change.currentLength}文字から${change.proposedLength}文字へ短縮しています。短文化自体はSEO改善の根拠になりません`
    );
  }
  return regressions;
}

export function normalizedLinkKey(value: string): string | null {
  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/u, '') || '/';
    return url.toString();
  } catch {
    return null;
  }
}

/** 既存内部リンクと同じURL、または対象ページ自身へのリンク追加を検出する */
export function internalLinkRegressions(
  proposedValue: string,
  context: FactContextSnapshot
): string[] {
  const proposedKey = normalizedLinkKey(proposedValue);
  if (proposedKey === null) return ['追加リンク先URLが不正です'];

  const regressions: string[] = [];
  const existingKeys = new Set(
    context.html.internalLinks
      .map((link) => normalizedLinkKey(link))
      .filter((key): key is string => key !== null)
  );
  if (existingKeys.has(proposedKey)) {
    regressions.push(
      `対象ページには既に同じ内部リンクがあります: ${proposedValue}`
    );
  }
  if (normalizedLinkKey(context.target.url) === proposedKey) {
    regressions.push('対象ページ自身へのリンク追加は効果がありません');
  }
  return regressions;
}

/**
 * 対象ページの実測値に対して、情報価値を落とす変更・重複変更を検出する。
 * 生成時のretry、改訂時の検証、承認直前のHard Gateで共通利用する。
 */
export function contentChangeRegressions(
  proposal: ProposalPayloadV2,
  context: FactContextSnapshot
): string[] {
  const regressions = proposal.targets.flatMap((target) => {
    if (proposal.action === 'addApprovedInternalLink') {
      return internalLinkRegressions(target.proposedValue, context);
    }
    if (STRUCTURED_TEXT_ACTIONS.has(proposal.action)) {
      return structuredTextRegressions(target.currentValue, target.proposedValue);
    }
    return [];
  });
  return [...new Set(regressions)];
}

/**
 * 生成時のretry対象にする変更退行。
 * dry-run期間は構造退行を学習材料としてSlackへ流すため、機械的に直せる重複リンクだけを止める。
 */
export function retryableContentChangeRegressions(
  proposal: ProposalPayloadV2,
  context: FactContextSnapshot
): string[] {
  if (proposal.action !== 'addApprovedInternalLink') return [];
  const regressions = proposal.targets.flatMap((target) =>
    internalLinkRegressions(target.proposedValue, context)
  );
  return [...new Set(regressions)];
}

export function isStructuredTextAction(action: TypedAction): boolean {
  return STRUCTURED_TEXT_ACTIONS.has(action);
}

/** currentValue（`links:25:sha256:...`）から実測リンク件数を読む */
export function existingInternalLinkCount(currentValue: string): number | null {
  const matched = currentValue.match(/^links:(\d+):/u);
  return matched ? Number(matched[1]) : null;
}
