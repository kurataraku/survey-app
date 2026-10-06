import { buildModerationComment } from './comment';
import { scoreModeration } from './score';
import type { ModerationFinding, SafetyFlagName, StoredModerationFlags } from './types';

export type AssembledModeration = {
  dangerScore: number;
  flags: StoredModerationFlags;
  reason: string;
};

export type AssembleInput = {
  ruleFindings: ModerationFinding[];
  aiFindings: ModerationFinding[];
  personalInfo: boolean;
  hateSpeech: boolean;
  advertisement: boolean;
  fakeSchool: boolean;
  duplicateEmail: boolean;
  aiFailed: boolean;
};

const VERDICT_RANK: Record<ModerationFinding['verdict'], number> = {
  contradict: 0,
  unexplained: 1,
  consistent: 2,
  not_stated: 3,
};

export function assembleModeration(input: AssembleInput): AssembledModeration {
  const merged = capFindings(dedupeFindings([...input.ruleFindings, ...input.aiFindings]));
  const personalInfo = input.personalInfo || hasFlag(merged, 'personal_info');
  const hateSpeech = input.hateSpeech || hasFlag(merged, 'hate_speech');
  const advertisement = input.advertisement || hasFlag(merged, 'advertisement');
  const findings = ensureSafetyFindings(merged, { personalInfo, hateSpeech, advertisement });

  const factConflict = findings.some((finding) => finding.aspect === 'fact' && finding.verdict === 'contradict');
  const internalConflict = findings.some((finding) => finding.aspect === 'internal' && finding.verdict === 'contradict');

  const dangerScore = scoreModeration({
    personalInfo,
    hateSpeech,
    advertisement,
    fakeSchool: input.fakeSchool,
    duplicateEmail: input.duplicateEmail,
    factConflict,
    internalConflict,
  });

  const flags: StoredModerationFlags = {
    personal_info: personalInfo,
    fake_review: factConflict,
    advertisement,
    hate_speech: hateSpeech,
    fake_school: input.fakeSchool,
    duplicate_email: input.duplicateEmail,
    fact_conflict: factConflict,
    internal_conflict: internalConflict,
    findings,
  };

  return {
    dangerScore,
    flags,
    reason: buildModerationComment({
      findings,
      personalInfo,
      hateSpeech,
      advertisement,
      fakeSchool: input.fakeSchool,
      duplicateEmail: input.duplicateEmail,
      aiFailed: input.aiFailed,
    }),
  };
}

function hasFlag(findings: ModerationFinding[], flag: SafetyFlagName): boolean {
  return findings.some((finding) => finding.flag === flag);
}

function ensureSafetyFindings(
  findings: ModerationFinding[],
  flags: { personalInfo: boolean; hateSpeech: boolean; advertisement: boolean }
): ModerationFinding[] {
  const next = [...findings];
  pushFallback(next, flags.personalInfo, 'personal_info', '個人を特定できる記述がある、と判定された。該当箇所の引用は返っていない');
  pushFallback(next, flags.hateSpeech, 'hate_speech', '誹謗中傷または差別表現がある、と判定された。該当箇所の引用は返っていない');
  pushFallback(next, flags.advertisement, 'advertisement', '広告・宣伝・営業が目的に見える、と判定された。該当箇所の引用は返っていない');
  return next;
}

function pushFallback(
  findings: ModerationFinding[],
  enabled: boolean,
  flag: SafetyFlagName,
  meaning: string
): void {
  if (!enabled || findings.some((finding) => finding.flag === flag)) return;
  findings.unshift({
    aspect: 'safety',
    verdict: 'contradict',
    quote: '本文',
    comparedWith: '安全面の確認',
    meaning,
    flag,
  });
}

function dedupeFindings(findings: ModerationFinding[]): ModerationFinding[] {
  const seen = new Set<string>();
  const unique: ModerationFinding[] = [];
  for (const finding of findings) {
    const key = `${finding.aspect}|${finding.verdict}|${finding.quote.replace(/\s/g, '').slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(finding);
  }
  return unique;
}

function capFindings(findings: ModerationFinding[]): ModerationFinding[] {
  return [...findings]
    .sort((left, right) => VERDICT_RANK[left.verdict] - VERDICT_RANK[right.verdict])
    .slice(0, 16);
}
