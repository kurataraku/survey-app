export type AttendanceStyle = 'commute' | 'online';

export type ScoreAxis = 'support' | 'autonomy' | 'community';

export interface SimScore {
  support: number;
  autonomy: number;
  community: number;
}

export interface DayChoice {
  label: string;
  axis: ScoreAxis;
  narration: string;
}

export interface DayScenario {
  day: string;
  theme: string;
  situation: string;
  choiceA: DayChoice;
  choiceB: DayChoice;
}

export interface SimulatorState {
  step: number;
  situation: string;
  attendanceStyle: AttendanceStyle | null;
  dayChoices: ('A' | 'B')[];
  scores: SimScore;
  showNarration: boolean;
  pendingChoice: 'A' | 'B' | null;
}

export interface SchoolRecommendation {
  name: string;
  slug: string;
  description: string;
}

export interface ResultType {
  axis: ScoreAxis;
  title: string;
  description: string;
  schoolFeature: string;
}
