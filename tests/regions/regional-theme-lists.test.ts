import { describe, expect, it } from 'vitest';
import {
  buildRegionalThemeLists,
  isAttendanceMajority,
  type RegionalThemeSchoolInput,
} from '@/lib/schools/regionalThemeLists';
import { selectRegionalHighlights } from '@/lib/schools/schoolHighlights';
import { formatRegionalLocation } from '@/lib/schools/regionalLanding';

function school(overrides: Partial<RegionalThemeSchoolInput> & { id: string }): RegionalThemeSchoolInput {
  return {
    name: overrides.id,
    slug: overrides.id,
    reviewCount: 5,
    overallAvg: 4,
    supportAvg: 4,
    supportRatingCount: 5,
    tuitionAvg: 4,
    tuitionRatingCount: 5,
    attendanceFrequencies: { 'ほぼオンライン/自宅': 5 },
    ...overrides,
  };
}

describe('isAttendanceMajority', () => {
  it('回答3件以上で半数を超えたときだけ該当する', () => {
    expect(isAttendanceMajority({ 週5: 2, '週1〜2': 1 }, ['週5', '週3〜4'])).toBe(true);
    expect(isAttendanceMajority({ 週5: 2 }, ['週5', '週3〜4'])).toBe(false);
    expect(isAttendanceMajority({ '週3〜4': 15, '週1〜2': 15 }, ['週5', '週3〜4'])).toBe(false);
    expect(isAttendanceMajority({ '週3〜4': 15, '週1〜2': 15 }, ['週1〜2'])).toBe(false);
  });
});

describe('buildRegionalThemeLists', () => {
  it('通学頻度のテーマは条件に合う学校を総合満足度の高い順に最大5校並べる', () => {
    const lists = buildRegionalThemeLists([
      ...['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) => school({ id, overallAvg: 4 + index / 10 })),
      school({ id: 'few', reviewCount: 2, overallAvg: 5, attendanceFrequencies: { '週1〜2': 2 } }),
    ]);
    const low = lists.find((list) => list.key === 'low_attendance');
    expect(low?.schools.map((s) => s.id)).toEqual(['f', 'e', 'd', 'c', 'b']);
  });

  it('同じ学校が通学頻度の2つのテーマに入らない', () => {
    const lists = buildRegionalThemeLists(
      ['a', 'b', 'c'].map((id) => school({ id, attendanceFrequencies: { 週5: 3, '週1〜2': 3 } }))
    );
    expect(lists.some((list) => list.key === 'low_attendance')).toBe(false);
    expect(lists.some((list) => list.key === 'high_attendance')).toBe(false);
  });

  it('満足度のテーマは項目の回答件数が3件未満の学校を除く', () => {
    const lists = buildRegionalThemeLists([
      school({ id: 'a', tuitionAvg: 4.1 }),
      school({ id: 'b', tuitionAvg: 4.2 }),
      school({ id: 'c', tuitionAvg: 4.3 }),
      school({ id: 'few', tuitionAvg: 5, tuitionRatingCount: 2 }),
    ]);
    const tuition = lists.find((list) => list.key === 'tuition');
    expect(tuition?.schools.map((s) => s.id)).toEqual(['c', 'b', 'a']);
  });

  it('該当が3校未満のテーマは出さない', () => {
    const lists = buildRegionalThemeLists([school({ id: 'a' }), school({ id: 'b' })]);
    expect(lists).toEqual([]);
  });
});

describe('selectRegionalHighlights', () => {
  it('場所に関する特徴を除いて最大3件を管理画面の順で返す', () => {
    expect(
      selectRegionalHighlights([
        '高田馬場など複数キャンパス',
        '東京校と池袋校で通学',
        '山口県山口市に本校舎',
        '名古屋市東区所在地',
        '地下鉄鶴舞線いりなか駅徒歩5分',
        '週4日登校',
        '美容専門授業75%',
        'メンターサポート',
        'プロジェクト学習',
      ])
    ).toEqual(['週4日登校', '美容専門授業75%', 'メンターサポート']);
  });

  it('特徴がなければ空配列を返す', () => {
    expect(selectRegionalHighlights(null)).toEqual([]);
    expect(selectRegionalHighlights([' ', ''])).toEqual([]);
  });
});

describe('formatRegionalLocation', () => {
  it('区と駅を「区（駅）」の形にまとめる', () => {
    expect(formatRegionalLocation(['中村区'], ['名古屋駅'], '名古屋市内')).toBe('中村区（名古屋駅）');
    expect(formatRegionalLocation(['中区', '東区', '千種区'], ['栄駅'], '名古屋市内')).toBe(
      '中区・東区ほか（栄駅）'
    );
    expect(formatRegionalLocation([], ['名古屋駅'], '名古屋市内')).toBe('名古屋駅');
    expect(formatRegionalLocation([], [], '名古屋市内')).toBe('名古屋市内');
  });
});
