import type { ModerationFinding } from './types';

const REPEATED_FILLER = /([。、，,\.．！!？?・●○◎◯※＊*★☆\s　])\1{5,}/u;
const MIXED_FILLER = /[。、，,\.．！!？?・●○◎◯※＊*★☆〜~＾^\s　]{12,}/u;

export function fillerFindings(
  goodComment: string | null,
  badComment: string | null
): ModerationFinding[] {
  return [
    findingFor('良かった点', goodComment),
    findingFor('改善してほしい点', badComment),
  ].filter((finding): finding is ModerationFinding => finding != null);
}

function findingFor(label: string, text: string | null): ModerationFinding | null {
  const source = text?.trim() ?? '';
  if (!source) return null;
  const match = source.match(REPEATED_FILLER) ?? source.match(MIXED_FILLER);
  if (!match || match.index == null) return null;

  const filler = match[0];
  const before = source.slice(Math.max(0, match.index - 12), match.index).trim();
  const quote = [before, clip(filler)].filter(Boolean).join('');

  return {
    aspect: 'safety',
    verdict: 'contradict',
    kind: 'filler_padding',
    quote,
    comparedWith: label,
    meaning: '句読点・空白・記号が続いており、本文を長く見せるための埋め込みと判断した',
  };
}

function clip(value: string): string {
  const compact = value.replace(/\s+/g, ' ');
  if (compact.length <= 24) return compact;
  return `${compact.slice(0, 24)}…`;
}
