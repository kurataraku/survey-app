import { describe, expect, it } from 'vitest';
import {
  compareRegionalSchools,
  matchesRegionalSchoolFilters,
  type RegionalSortableSchool,
  type RegionalSortKey,
} from '@/lib/schools/regionalLanding';

function school(
  name: string,
  rating: number | null,
  reviewCount: number,
  defaultOrder: number
): RegionalSortableSchool {
  return { name, rating, reviewCount, defaultOrder };
}

const schools = [
  school('A校', 4.2, 155, 0),
  school('B校', 4.5, 11, 1),
  school('C校', 5.0, 1, 2),
  school('D校', 3.0, 1, 3),
  school('E校', null, 0, 4),
  school('F校', 3.7, 3, 5),
];

function order(sort: RegionalSortKey): string[] {
  return [...schools].sort((a, b) => compareRegionalSchools(a, b, sort)).map((s) => s.name);
}

describe('regional landing finder', () => {
  it('駅と学校の種類はAND、未選択なら全件対象にする', () => {
    const row = { stationFilterIds: ['station-1'], institutionType: 'private' as const };
    expect(matchesRegionalSchoolFilters(row, '', '')).toBe(true);
    expect(matchesRegionalSchoolFilters(row, 'station-1', 'private')).toBe(true);
    expect(matchesRegionalSchoolFilters(row, 'station-2', 'private')).toBe(false);
    expect(matchesRegionalSchoolFilters(row, 'station-1', 'support')).toBe(false);
  });

  it('種類が未登録の学校は種類を選んだときだけ外れる', () => {
    const row = { stationFilterIds: ['station-1'], institutionType: null };
    expect(matchesRegionalSchoolFilters(row, 'station-1', '')).toBe(true);
    expect(matchesRegionalSchoolFilters(row, '', 'public')).toBe(false);
  });

  it('標準は defaultOrder の順', () => {
    expect(order('default')).toEqual(['A校', 'B校', 'C校', 'D校', 'E校', 'F校']);
  });

  it('満足度が高い順は口コミ3件以上→1〜2件→0件の順にまとめる', () => {
    expect(order('rating-desc')).toEqual(['B校', 'A校', 'F校', 'C校', 'D校', 'E校']);
  });

  it('満足度が低い順でも口コミ1件の学校を先頭にしない', () => {
    expect(order('rating-asc')).toEqual(['F校', 'A校', 'B校', 'D校', 'C校', 'E校']);
  });

  it('口コミ件数順は件数のみで並べ、同数は学校名順', () => {
    expect(order('reviews-desc')).toEqual(['A校', 'B校', 'F校', 'C校', 'D校', 'E校']);
    expect(order('reviews-asc')).toEqual(['E校', 'C校', 'D校', 'F校', 'B校', 'A校']);
  });
});
