import { describe, expect, it } from 'vitest';
import {
  buildRegionalReviewFilterKeys,
  matchesRegionalSchoolFilters,
} from '@/lib/schools/regionalLanding';

describe('regional landing finder', () => {
  it('少ない通学日数は3つの回答値をまとめる', () => {
    expect(
      buildRegionalReviewFilterKeys({
        attendanceFrequencies: { '月1〜数回': 1 },
        enrollmentTypes: {},
        reasonGroups: {},
        respondentRoles: {},
      })
    ).toContain('low-frequency');
  });

  it('転入・理由・保護者を地域口コミの集計から判定する', () => {
    expect(
      buildRegionalReviewFilterKeys({
        attendanceFrequencies: {},
        enrollmentTypes: { '転入学（他校から転校）': 1 },
        reasonGroups: { mental_relationship: 2 },
        respondentRoles: { 保護者: 1 },
      })
    ).toEqual(['transfer', 'mental-relationship', 'parent']);
  });

  it('場所と口コミ条件はAND、各群が空なら全件対象にする', () => {
    const school = {
      stationFilterIds: ['station-nagoya'],
      reviewFilterKeys: ['transfer' as const],
    };
    expect(matchesRegionalSchoolFilters(school, '', '')).toBe(true);
    expect(matchesRegionalSchoolFilters(school, 'station-nagoya', 'transfer')).toBe(true);
    expect(matchesRegionalSchoolFilters(school, 'station-sakae', 'transfer')).toBe(false);
    expect(matchesRegionalSchoolFilters(school, 'station-nagoya', 'parent')).toBe(false);
  });
});
