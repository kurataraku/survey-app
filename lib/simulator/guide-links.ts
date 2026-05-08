import type { AttendanceStyle, ScoreAxis } from './types';
import { appPath } from '@/lib/base-path';

export function getReviewsLink(style: AttendanceStyle): string {
  const freq = style === 'commute' ? '週3〜4' : 'ほぼオンライン/自宅';
  return appPath(`/reviews?attendance_frequency=${encodeURIComponent(freq)}`);
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
