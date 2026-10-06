export type FindingAspect = 'fact' | 'internal' | 'safety';

export type FindingVerdict = 'contradict' | 'consistent' | 'not_stated' | 'unexplained';

export type SafetyFlagName = 'personal_info' | 'hate_speech' | 'advertisement';

export type ModerationFinding = {
  aspect: FindingAspect;
  verdict: FindingVerdict;
  quote: string;
  comparedWith: string;
  meaning: string;
  flag?: SafetyFlagName;
  kind?: 'filler_padding';
};

export type StoredModerationFlags = {
  personal_info: boolean;
  fake_review: boolean;
  advertisement: boolean;
  hate_speech: boolean;
  fake_school: boolean;
  duplicate_email: boolean;
  fact_conflict: boolean;
  internal_conflict: boolean;
  filler_padding: boolean;
  findings: ModerationFinding[];
};

export type CampusLocation = {
  prefecture: string;
  city: string | null;
};

export type SchoolLookup = 'found' | 'missing' | 'error';

export type SchoolModerationContext = {
  lookup: SchoolLookup;
  schoolId: string | null;
  schoolName: string | null;
  status: string | null;
  institutionType: string | null;
  officialUrl: string | null;
  campusLocations: CampusLocation[];
  courseNames: string[];
  tuitionText: string | null;
};

export type OfficialPageStatus = 'fetched' | 'missing' | 'failed';

export type OfficialPageResult = {
  status: OfficialPageStatus;
  text: string;
  note: string;
};

export type ReviewModerationInput = {
  schoolName: string;
  respondentRole: string | null;
  status: string | null;
  overallSatisfaction: number | null;
  goodComment: string | null;
  badComment: string | null;
  answers: Record<string, unknown>;
};
