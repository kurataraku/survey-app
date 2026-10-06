export type ScoreInput = {
  personalInfo: boolean;
  hateSpeech: boolean;
  advertisement: boolean;
  fakeSchool: boolean;
  duplicateEmail: boolean;
  factConflict: boolean;
  internalConflict: boolean;
};

const SCORE_CAP = 100;

export function scoreModeration(input: ScoreInput): number {
  let score = 0;
  if (input.personalInfo) score += 40;
  if (input.hateSpeech) score += 40;
  if (input.advertisement) score += 30;
  if (input.fakeSchool) score += 50;
  if (input.factConflict) score += 35;
  if (input.internalConflict) score += 25;
  if (input.duplicateEmail) score += 15;
  return Math.min(SCORE_CAP, score);
}
