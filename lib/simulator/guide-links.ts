import type { AttendanceStyle, ScoreAxis } from './types';
import { appPath } from '@/lib/base-path';

export function getReviewsLink(style: AttendanceStyle, prefecture?: string | null): string {
  const freq = style === 'commute' ? '週3〜4' : 'ほぼオンライン/自宅';
  const params = new URLSearchParams({ attendance_frequency: freq });
  if (prefecture) params.set('prefecture', prefecture);
  return appPath(`/reviews?${params.toString()}`);
}

export function getSchoolsLink(prefecture?: string | null): string {
  if (!prefecture) return appPath('/schools');
  return appPath(`/schools?prefecture=${encodeURIComponent(prefecture)}`);
}

export function getPrefectureLandingLink(prefecture: string, sectionId?: string): string {
  const hash = sectionId ? `#${sectionId}` : '';
  return appPath(`/schools/prefecture/${encodeURIComponent(prefecture)}${hash}`);
}

export function getRankingLink(axis: ScoreAxis): string {
  const map: Record<ScoreAxis, string> = {
    support: '/rankings/staff',
    autonomy: '/rankings/credit',
    community: '/rankings/atmosphere',
  };
  return appPath(map[axis]);
}

export function getSurveyLink(): string {
  return appPath('/survey');
}
