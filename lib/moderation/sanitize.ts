import { z } from 'zod';
import type { FindingAspect, FindingVerdict, ModerationFinding, SafetyFlagName } from './types';

const ASPECTS = ['fact', 'internal', 'safety'] as const;
const VERDICTS = ['contradict', 'consistent', 'not_stated', 'unexplained'] as const;
const FLAGS = ['personal_info', 'hate_speech', 'advertisement'] as const;

const findingSchema = z.object({
  aspect: z.enum(ASPECTS),
  verdict: z.enum(VERDICTS),
  quote: z.string(),
  compared_with: z.string().optional(),
  comparedWith: z.string().optional(),
  meaning: z.string(),
  flag: z.enum(FLAGS).nullable().optional(),
});

const aiSchema = z.object({
  personal_info: z.boolean().optional(),
  hate_speech: z.boolean().optional(),
  advertisement: z.boolean().optional(),
  findings: z.array(z.unknown()).optional(),
});

export type ParsedAiModeration = {
  personalInfo: boolean;
  hateSpeech: boolean;
  advertisement: boolean;
  findings: ModerationFinding[];
};

export function parseAiModeration(raw: unknown): ParsedAiModeration | null {
  const parsed = aiSchema.safeParse(raw);
  if (!parsed.success) return null;

  return {
    personalInfo: parsed.data.personal_info === true,
    hateSpeech: parsed.data.hate_speech === true,
    advertisement: parsed.data.advertisement === true,
    findings: sanitizeFindings(parsed.data.findings ?? []),
  };
}

export function sanitizeFindings(rawFindings: unknown[]): ModerationFinding[] {
  const findings: ModerationFinding[] = [];
  for (const raw of rawFindings) {
    const finding = sanitizeFinding(raw);
    if (finding) findings.push(finding);
  }
  return findings;
}

export function sanitizeFinding(raw: unknown): ModerationFinding | null {
  const parsed = findingSchema.safeParse(raw);
  if (!parsed.success) return null;

  const quote = clip(parsed.data.quote, 120);
  const comparedWith = clip(parsed.data.compared_with || parsed.data.comparedWith || '', 200);
  const meaning = clip(parsed.data.meaning, 200);
  if (!quote || !comparedWith || !meaning) return null;

  const finding: ModerationFinding = {
    aspect: parsed.data.aspect satisfies FindingAspect,
    verdict: parsed.data.verdict satisfies FindingVerdict,
    quote,
    comparedWith,
    meaning,
  };

  if (parsed.data.aspect === 'safety' && parsed.data.flag) {
    finding.flag = parsed.data.flag satisfies SafetyFlagName;
  }

  return finding;
}

function clip(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}
