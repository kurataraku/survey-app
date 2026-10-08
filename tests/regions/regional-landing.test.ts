import { describe, expect, it } from 'vitest';
import {
  buildCityFinderAreas,
  buildPrefectureFinderAreas,
  compareRegionalSchools,
  formatPrefectureLocation,
  matchesRegionalSchoolFilters,
  nationalAverageDiff,
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
  const row = (
    localMunicipalities: string[],
    institutionType: 'public' | 'private' | 'support' | null,
    localWards: Array<{ municipality: string; ward: string }> = []
  ) => ({ localMunicipalities, localWards, institutionType });

  const aichi = buildPrefectureFinderAreas(
    '愛知県',
    [
      row(['名古屋市', '豊橋市'], 'private', [{ municipality: '名古屋市', ward: '中村区' }]),
      row(['名古屋市', '豊橋市'], 'support', [
        { municipality: '名古屋市', ward: '中村区' },
        { municipality: '名古屋市', ward: '中区' },
      ]),
      row(['名古屋市', '春日井市'], 'private'),
      row(['武豊町'], 'public'),
      row([], 'public'),
    ],
    2
  );
  const options = aichi.areas.groups.flatMap((group) => group.options);
  const idOf = (label: string) =>
    options.find((option) => (option.fullLabel ?? option.label) === label)?.id;

  it('上位に限らず、キャンパスがある市区町村をすべて選択肢にする（「その他」は作らない）', () => {
    expect(options.map((option) => [option.label, option.schoolCount])).toEqual([
      ['名古屋市全体', 3],
      ['中村区', 2],
      ['中区', 1],
      ['豊橋市', 2],
      ['春日井市', 1],
      ['武豊町', 1],
    ]);
  });

  it('ボタンは校数の多い市区町村だけ、政令指定都市の区はボタンにしない', () => {
    expect(aichi.areas.featuredIds).toEqual([idOf('名古屋市'), idOf('豊橋市')]);
  });

  it('政令指定都市は市全体と区のまとまりにし、一覧の外では親の市を含めた名前で示す', () => {
    expect(aichi.areas.groups.map((group) => group.label)).toEqual(['名古屋市', 'そのほかの市', '町・村']);
    expect(options[0].fullLabel).toBe('名古屋市');
    expect(options.find((option) => option.label === '中村区')?.fullLabel).toBe('名古屋市中村区');
  });

  it('複数の市区町村・区にキャンパスがある学校は、それぞれのIDを持つ', () => {
    expect(aichi.areaFilterIds[0]).toEqual(
      expect.arrayContaining([idOf('名古屋市'), idOf('豊橋市'), idOf('名古屋市中村区')])
    );
    expect(aichi.areaFilterIds[0]).toHaveLength(3);
  });

  it('県内にキャンパスがない学校はどの市区町村にも数えない', () => {
    expect(aichi.areaFilterIds[4]).toEqual([]);
  });

  it('種類ごとの件数は0校の種類を持たない', () => {
    expect(options[0].typeCounts).toEqual({ private: 2, support: 1 });
  });

  it('東京都の特別区は「23区」、まとまりが1つだけなら見出しを付けない', () => {
    const tokyo = buildPrefectureFinderAreas('東京都', [row(['新宿区', '立川市'], 'private')]);
    expect(tokyo.areas.groups.map((group) => group.label)).toEqual(['23区', '市']);
    const iwate = buildPrefectureFinderAreas('岩手県', [row(['盛岡市', '宮古市'], 'private')]);
    expect(iwate.areas.groups.map((group) => group.label)).toEqual([null]);
  });

  it('掲載校が5校以下の県では絞り込み欄を出さない', () => {
    expect(shouldShowPrefectureFinder(5)).toBe(false);
    expect(shouldShowPrefectureFinder(6)).toBe(true);
  });
});

describe('city landing area filter', () => {
  const city = buildCityFinderAreas(
    [
      { institutionType: 'private', wards: ['中村区'], stations: ['名古屋駅', '栄駅'] },
      { institutionType: 'support', wards: ['中村区', '中区'], stations: ['名古屋駅'] },
      { institutionType: 'private', wards: [], stations: [] },
    ],
    1
  );

  it('区と最寄り駅のまとまりで、すべての区・駅を選択肢にする', () => {
    expect(
      city.areas.groups.map((group) => [group.label, group.options.map((option) => option.label)])
    ).toEqual([
      ['区', ['中村区', '中区']],
      ['最寄り駅', ['名古屋駅', '栄駅']],
    ]);
  });

  it('ボタンは校数の多い駅、区も駅も分からない学校はどこにも数えない', () => {
    const stationIds = city.areas.groups[1].options.map((option) => option.id);
    expect(city.areas.featuredIds).toEqual([stationIds[0]]);
    expect(city.areaFilterIds[2]).toEqual([]);
  });

  it('駅が登録されていない都市では、区をボタンにする', () => {
    const wardsOnly = buildCityFinderAreas([
      { institutionType: 'private', wards: ['中村区'], stations: [] },
      { institutionType: 'private', wards: ['中区'], stations: ['栄駅'] },
    ]);
    expect(wardsOnly.areas.featuredIds).toEqual(wardsOnly.areas.groups[0].options.map((option) => option.id));
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
