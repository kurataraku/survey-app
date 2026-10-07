import { describe, expect, it } from 'vitest';
import {
  assignAreaFilterIds,
  buildFinderAreaOptions,
  compareRegionalSchools,
  formatPrefectureLocation,
  matchesRegionalSchoolFilters,
  nationalAverageDiff,
  OTHER_AREA_FILTER_ID,
  shouldShowPrefectureFinder,
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
    const row = { areaFilterIds: ['station-1'], institutionType: 'private' as const };
    expect(matchesRegionalSchoolFilters(row, '', '')).toBe(true);
    expect(matchesRegionalSchoolFilters(row, 'station-1', 'private')).toBe(true);
    expect(matchesRegionalSchoolFilters(row, 'station-2', 'private')).toBe(false);
    expect(matchesRegionalSchoolFilters(row, 'station-1', 'support')).toBe(false);
  });

  it('種類が未登録の学校は種類を選んだときだけ外れる', () => {
    const row = { areaFilterIds: ['station-1'], institutionType: null };
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

describe('prefecture landing area filter', () => {
  const areas = [
    { id: 'area-1', label: '名古屋市' },
    { id: 'area-2', label: '豊橋市' },
  ];

  it('複数の市区町村にキャンパスがある学校は、それぞれのIDを持つ', () => {
    expect(assignAreaFilterIds(['名古屋市', '豊橋市'], areas)).toEqual(['area-1', 'area-2']);
  });

  it('上位以外の市区町村にもキャンパスがあれば「その他の地域」も付ける', () => {
    expect(assignAreaFilterIds(['名古屋市', '春日井市'], areas)).toEqual([
      'area-1',
      OTHER_AREA_FILTER_ID,
    ]);
    expect(assignAreaFilterIds(['春日井市'], areas)).toEqual([OTHER_AREA_FILTER_ID]);
  });

  it('県内にキャンパスがない学校はどの市区町村にも数えない', () => {
    expect(assignAreaFilterIds([], areas)).toEqual([]);
  });

  it('ボタンの件数は重複して数え、0校の選択肢は出さない', () => {
    const rows = [
      { areaFilterIds: ['area-1', 'area-2'], institutionType: 'private' as const },
      { areaFilterIds: ['area-1'], institutionType: 'support' as const },
      { areaFilterIds: [], institutionType: 'public' as const },
    ];
    const options = buildFinderAreaOptions(rows, [
      ...areas,
      { id: OTHER_AREA_FILTER_ID, label: 'その他の地域' },
    ]);
    expect(options.map((option) => [option.id, option.schoolCount])).toEqual([
      ['area-1', 2],
      ['area-2', 1],
    ]);
    expect(options[0].typeCounts).toMatchObject({ private: 1, support: 1, public: 0 });
  });

  it('掲載校が5校以下の県では絞り込み欄を出さない', () => {
    expect(shouldShowPrefectureFinder(5)).toBe(false);
    expect(shouldShowPrefectureFinder(6)).toBe(true);
  });
});

describe('formatPrefectureLocation', () => {
  it('県内キャンパスの登録がない学校は、通える場所がないと断定しない', () => {
    expect(
      formatPrefectureLocation({ localCities: [], localStations: [], localCampusCount: 0 }, '東京都')
    ).toBe('キャンパス情報なし');
  });

  it('市区町村と最寄り駅を並べ、3つ目以降は「ほか」にまとめる', () => {
    expect(
      formatPrefectureLocation(
        {
          localCities: ['新宿区', '渋谷区', '豊島区'],
          localStations: ['新宿駅', '渋谷駅'],
          localCampusCount: 3,
        },
        '東京都'
      )
    ).toBe('新宿区・渋谷区ほか（新宿駅・渋谷駅）');
  });

  it('市区町村が不明なキャンパスは件数で示す', () => {
    expect(
      formatPrefectureLocation({ localCities: [], localStations: [], localCampusCount: 2 }, '鳥取県')
    ).toBe('鳥取県内のキャンパス2か所');
  });
});

describe('nationalAverageDiff', () => {
  it('表示と同じく小数1桁に丸めた値どうしで差をとる', () => {
    expect(nationalAverageDiff(4.26, 3.97, 10)).toBe(0.3);
    expect(nationalAverageDiff(3.71, 3.97, 10)).toBe(-0.3);
    expect(nationalAverageDiff(4.26, 4.14, 10)).toBe(0.2);
    expect(nationalAverageDiff(4.34, 4.14, 10)).toBe(0.2);
  });

  it('丸めて0になる差は0（-0にしない）', () => {
    expect(Object.is(nationalAverageDiff(3.95, 3.97, 10), 0)).toBe(true);
  });

  it('回答が3件未満、または値か全国平均がない場合は出さない', () => {
    expect(nationalAverageDiff(4.5, 3.97, 2)).toBeNull();
    expect(nationalAverageDiff(null, 3.97, 10)).toBeNull();
    expect(nationalAverageDiff(4.5, null, 10)).toBeNull();
  });
});
