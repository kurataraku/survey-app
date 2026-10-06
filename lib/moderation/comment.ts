import type { FindingVerdict, ModerationFinding } from './types';

export const COMMENT_HEADINGS = {
  support: '信ぴょう性を支える点',
  weak: '信ぴょう性が弱い点',
  unknown: 'この材料では判断できない点',
} as const;

export const EMPTY_SUPPORT = '学校マスターや公式ページと一致する事実は見つかりませんでした。';
export const EMPTY_WEAK = '回答同士の食い違い、材料との矛盾、理由が書かれていない点数はありません。';
export const EMPTY_UNKNOWN = '材料に無く判断を保留した記述はありません。';

const HEADING_SET = new Set<string>(Object.values(COMMENT_HEADINGS));

export function findingSentence(finding: ModerationFinding): string {
  const compared = finding.comparedWith.replace(/。+$/u, '');
  const meaning = finding.meaning.replace(/。+$/u, '');
  return `口コミの「${finding.quote}」は、${compared}。${meaning}。`;
}

export function moderationSections(findings: ModerationFinding[]): {
  support: string[];
  weak: string[];
  unknown: string[];
} {
  const groups = groupFindings(findings);
  return {
    support: groups.support.map(findingSentence),
    weak: groups.weak.map(findingSentence),
    unknown: groups.unknown.map(findingSentence),
  };
}

export function buildModerationComment(input: {
  findings: ModerationFinding[];
  personalInfo: boolean;
  hateSpeech: boolean;
  advertisement: boolean;
  fakeSchool: boolean;
  duplicateEmail: boolean;
  aiFailed: boolean;
}): string {
  const groups = groupFindings(input.findings);
  const factConflicts = input.findings.filter((finding) => finding.aspect === 'fact' && finding.verdict === 'contradict').length;
  const internalConflicts = input.findings.filter((finding) => finding.aspect === 'internal' && finding.verdict === 'contradict').length;
  const unexplained = groups.weak.filter((finding) => finding.verdict === 'unexplained').length;
  const safety = input.personalInfo || input.hateSpeech || input.advertisement || input.fakeSchool || input.duplicateEmail;

  const summary = [
    safety ? '安全上の問題があります。' : '安全上の問題はなし。',
    factConflicts > 0 ? `公開情報との矛盾は${factConflicts}件。` : '公開情報との矛盾はなし。',
    internalConflicts > 0 ? `回答の食い違いは${internalConflicts}件。` : '回答の食い違いはなし。',
    unexplained > 0 ? `理由が書かれていない点数は${unexplained}件。` : '',
  ].filter(Boolean).join('');

  const lines = [summary];
  if (input.aiFailed) {
    lines.push('文章の自動審査は失敗したため、学校データとの照合結果だけを見ています。');
  }
  lines.push('');
  lines.push(COMMENT_HEADINGS.support);
  lines.push(...bulletLines(groups.support, EMPTY_SUPPORT));
  lines.push('');
  lines.push(COMMENT_HEADINGS.weak);
  lines.push(...bulletLines(groups.weak, EMPTY_WEAK));
  lines.push('');
  lines.push(COMMENT_HEADINGS.unknown);
  lines.push(...bulletLines(groups.unknown, EMPTY_UNKNOWN));

  return lines.join('\n');
}

export function summaryLines(reason: string): string[] {
  const lines: string[] = [];
  for (const line of reason.split('\n')) {
    if (HEADING_SET.has(line.trim())) break;
    if (line.trim()) lines.push(line.trim());
  }
  return lines;
}

export function readFindings(flags: unknown): ModerationFinding[] {
  if (!flags || typeof flags !== 'object') return [];
  const raw = (flags as { findings?: unknown }).findings;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const finding = readFinding(item);
    return finding ? [finding] : [];
  });
}

export function latestByCreatedAt<T extends { created_at?: string | null }>(
  items: T[] | null | undefined
): T | undefined {
  if (!items?.length) return undefined;
  return [...items].sort((left, right) => {
    const leftTime = left.created_at ? Date.parse(left.created_at) : 0;
    const rightTime = right.created_at ? Date.parse(right.created_at) : 0;
    return rightTime - leftTime;
  })[0];
}

function groupFindings(findings: ModerationFinding[]): {
  support: ModerationFinding[];
  weak: ModerationFinding[];
  unknown: ModerationFinding[];
} {
  return {
    support: findings.filter((finding) => finding.verdict === 'consistent'),
    weak: findings.filter((finding) => finding.verdict === 'contradict' || finding.verdict === 'unexplained'),
    unknown: findings.filter((finding) => finding.verdict === 'not_stated'),
  };
}

function bulletLines(findings: ModerationFinding[], empty: string): string[] {
  if (findings.length === 0) return [`・${empty}`];
  return findings.map((finding) => `・${findingSentence(finding)}`);
}

function readFinding(raw: unknown): ModerationFinding | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const aspect = item.aspect;
  const verdict = item.verdict;
  const quote = stringField(item.quote);
  const comparedWith = stringField(item.comparedWith) || stringField(item.compared_with);
  const meaning = stringField(item.meaning);
  if (!isAspect(aspect) || !isVerdict(verdict) || !quote || !comparedWith || !meaning) return null;
  return { aspect, verdict, quote, comparedWith, meaning };
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isAspect(value: unknown): value is ModerationFinding['aspect'] {
  return value === 'fact' || value === 'internal' || value === 'safety';
}

function isVerdict(value: unknown): value is FindingVerdict {
  return value === 'contradict' || value === 'consistent' || value === 'not_stated' || value === 'unexplained';
}
