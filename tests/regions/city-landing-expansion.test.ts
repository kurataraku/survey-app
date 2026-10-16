import { describe, expect, it } from 'vitest';
import {
  CITY_LANDING_CANDIDATES,
  CITY_LANDING_GATE,
  getPrefecturePageCityTarget,
  getPublishableCityLandingCandidates,
} from '@/lib/regions/city-landing-candidates';
import { CITY_LANDINGS, getCityLandingsForPrefecture } from '@/lib/regions/city-landing';
import { buildCityFinderAreas } from '@/lib/schools/regionalLanding';
import {
  reservedExcerptIdsForNewCityLanding,
  selectRepresentativeRegionalReviewExcerpts,
} from '@/lib/schools/regionalReviewExcerpts';
import {
  getCityLandingMetaDescription,
  getCityLandingSubtitle,
  getCityLandingTitle,
  buildCityFaqItems,
} from '@/lib/regions/city-landing-copy';
import {
  getPrefectureLandingHeading,
  getPrefectureLandingMetaDescription,
  getPrefectureLandingSubtitle,
  getPrefectureLandingTitle,
} from '@/lib/prefectures/prefecture-landing-copy';
import { buildPrefectureFaqItems } from '@/lib/prefectures/prefecture-landing-schema';
import type { CityLandingData } from '@/lib/schools/getCityLandingData';

describe('city landing candidates', () => {
  it('候補71市のslugは重複せず、公開条件の定数が計画どおりである', () => {
    const slugs = CITY_LANDING_CANDIDATES.map((candidate) => candidate.slug);
    expect(slugs).toHaveLength(71);
    expect(new Set(slugs).size).toBe(71);
    expect(CITY_LANDING_GATE).toEqual({
      minCampusLocations: 6,
      minStationCoverage: 0.75,
      minPrefectureReviewCount: 1,
      maxPrefectureOverlap: 0.8,
    });
  });

  it('登録した都市は候補に含まれ、第1波と第2波だけを公開する', () => {
    const published = getPublishableCityLandingCandidates();
    expect(published).toHaveLength(34);
    expect(published.filter((candidate) => candidate.publishWave === 'phase1_station')).toHaveLength(21);
    expect(published.filter((candidate) => candidate.publishWave === 'phase2_ward')).toHaveLength(13);
    expect(published.some((candidate) => candidate.publishWave === 'phase3_low_review')).toBe(false);
    expect(CITY_LANDINGS.map((city) => city.slug).sort()).toEqual(
      ['nagoya', ...published.map((city) => city.slug)].sort()
    );
    for (const city of CITY_LANDINGS) {
      if (city.slug === 'nagoya') continue;
      expect(CITY_LANDING_CANDIDATES.some((candidate) => candidate.slug === city.slug)).toBe(true);
    }
  });

  it('登録簿は公開した波の順に並び、後から公開した都市が先の都市の代表口コミを奪わない', () => {
    const waves = CITY_LANDINGS.map((city) => city.publishWave);
    expect(waves[0]).toBe('existing');
    expect(waves.lastIndexOf('phase1_station')).toBeLessThan(waves.indexOf('phase2_ward'));
    expect(
      getCityLandingsForPrefecture('神奈川県').map((city) => city.slug)
    ).toEqual(['yokosuka', 'kawasaki', 'yokohama', 'sagamihara']);
    expect(getCityLandingsForPrefecture('大阪府').map((city) => city.slug)).toEqual(['hirakata', 'osaka', 'sakai']);
    expect(getCityLandingsForPrefecture('兵庫県').map((city) => city.slug)).toEqual(['himeji', 'nishinomiya', 'kobe']);
    expect(getCityLandingsForPrefecture('愛知県').map((city) => city.slug)).toEqual([
      'nagoya',
      'toyota',
      'okazaki',
      'toyohashi',
    ]);
  });

  it('県ページで受ける市は重複率80%以上の13市である', () => {
    const prefecturePageCities = CITY_LANDING_CANDIDATES.filter((candidate) => candidate.status === 'prefecture_page');
    expect(prefecturePageCities).toHaveLength(13);
    expect(getPrefecturePageCityTarget('北海道')?.municipality).toBe('札幌市');
    expect(getPrefecturePageCityTarget('愛知県')).toBeNull();
  });
});

describe('city landing finder patterns', () => {
  const rows = [
    { institutionType: 'private' as const, wards: ['中村区'], stations: ['名古屋駅'] },
    { institutionType: 'support' as const, wards: ['中区'], stations: ['栄駅'] },
  ];

  it('区がない市は駅だけのまとまりになり、見出しを出さない', () => {
    const finder = buildCityFinderAreas(
      rows.map((row) => ({ ...row, wards: [] })),
      6,
      { includeWards: false }
    );
    expect(finder.areas.groups).toEqual([
      { label: null, options: expect.arrayContaining([expect.objectContaining({ label: '名古屋駅' })]) },
    ]);
  });

  it('最寄り駅が1つだけの市は地域の絞り込みを出さない', () => {
    const finder = buildCityFinderAreas(
      [
        { institutionType: 'private', wards: [], stations: ['高崎駅'] },
        { institutionType: 'support', wards: [], stations: ['高崎駅'] },
      ],
      6,
      { includeWards: false, hideSingleStationArea: true }
    );
    expect(finder.areas.groups).toEqual([]);
    expect(finder.areas.featuredIds).toEqual([]);
  });

  it('駅が1つでも区があれば区の絞り込みは残す', () => {
    const finder = buildCityFinderAreas(
      [
        { institutionType: 'private', wards: ['中央区'], stations: ['高崎駅'] },
        { institutionType: 'support', wards: ['中央区'], stations: ['高崎駅'] },
      ],
      6,
      { includeWards: true, hideSingleStationArea: true }
    );
    expect(finder.areas.groups).toEqual([
      { label: null, options: [expect.objectContaining({ label: '中央区' })] },
    ]);
  });
});

describe('city landing copy', () => {
  const data = {
    municipality: '宮崎市',
    prefecture: '宮崎県',
    cityReviewCount: 0,
    prefectureReviewCount: 4,
    counts: { totalSchools: 11, campusLocationCount: 11 },
    topStations: [{ name: '宮崎駅' }],
    wards: [],
  } as unknown as CityLandingData;

  it('区がある市はタイトルを区・駅、ない市は駅から比較にする', () => {
    expect(getCityLandingTitle('大阪市', true)).toContain('区・駅から');
    expect(getCityLandingTitle('町田市', false)).toContain('駅から');
    expect(getCityLandingTitle('町田市', false)).not.toContain('区・駅');
  });

  it('市の口コミが0件なら見出し・説明文・FAQを県内の表現にする', () => {
    expect(getCityLandingSubtitle(data)).toContain('宮崎県内のキャンパスに通った人の口コミ4件');
    expect(getCityLandingMetaDescription(data)).toContain('宮崎県内のキャンパスに通った人の口コミ4件');
    const faq = buildCityFaqItems(data);
    expect(faq.some((item) => item.question.includes('宮崎市の通信制高校の口コミ'))).toBe(false);
    expect(faq.some((item) => item.question.includes('このページに掲載している口コミ'))).toBe(true);
    expect(faq.some((item) => item.answer.includes('宮崎県内'))).toBe(true);
    expect(faq.some((item) => item.answer.includes('宮崎市のキャンパスに通った人の口コミとしては数えていません'))).toBe(
      true
    );
  });
});

describe('prefecture page city names', () => {
  it('重複率80%以上の県だけタイトルとH1とFAQに市名を入れる', () => {
    expect(getPrefectureLandingTitle('宮城県')).toBe(
      '宮城県・仙台市の通信制高校一覧｜口コミ・評判・学費・通いやすさを比較'
    );
    expect(getPrefectureLandingHeading('宮城県')).toBe('宮城県・仙台市の通信制高校・サポート校一覧');
    expect(getPrefectureLandingTitle('愛知県')).toBe('愛知県の通信制高校一覧｜口コミ・評判・学費・通いやすさを比較');
    const faq = buildPrefectureFaqItems('宮城県', {
      prefecturePageCity: {
        municipality: '仙台市',
        schoolCount: 28,
        campusCount: 32,
        nearestStations: ['仙台駅'],
      },
    });
    expect(faq[0]?.question).toBe('仙台市内にキャンパスがある通信制高校は何校ありますか？');
  });

  const baseStats = {
    totalSchools: 36,
    localCampusLocationCount: 40,
    publicCount: 2,
    supportCount: 10,
    totalReviewCount: 80,
    localReviewCount: 27,
    localReviewSchoolCount: 9,
    cityCount: 8,
    topStations: ['札幌駅'],
  };

  it('市名を入れた県ページは、説明文の冒頭を主都市のキャンパス数にし、都市ページがある市名を出さない', () => {
    const stats = {
      ...baseStats,
      topCities: ['札幌市', '旭川市', '函館市'],
      prefecturePageCity: {
        municipality: '札幌市',
        schoolCount: 29,
        campusCount: 34,
        nearestStations: ['札幌駅', '新札幌駅'],
        wards: [],
      },
    };
    const lead = '掲載36校のうち29校は札幌市内にキャンパスがあります（主な最寄り駅: 札幌駅・新札幌駅など）。';
    const subtitle = getPrefectureLandingSubtitle('北海道', stats);
    const meta = getPrefectureLandingMetaDescription('北海道', stats);
    expect(subtitle.startsWith(lead)).toBe(true);
    expect(meta.startsWith(lead)).toBe(true);
    for (const text of [subtitle, meta]) {
      expect(text).not.toContain('旭川市');
      expect(text).toContain('函館市');
    }
  });

  it('福岡県は北九州市・久留米市の都市ページと食い合わないよう、その市名を説明文に出さない', () => {
    const meta = getPrefectureLandingMetaDescription('福岡県', {
      ...baseStats,
      topCities: ['福岡市', '北九州市', '久留米市'],
      prefecturePageCity: { municipality: '福岡市', schoolCount: 42, campusCount: 55, nearestStations: [], wards: [] },
    });
    expect(meta).not.toContain('北九州市');
    expect(meta).not.toContain('久留米市');
    expect(meta).toContain('キャンパス40か所、エリア別情報');
  });

  it('市名を入れていない県の説明文は、都市ページがある市名も含めて今までどおり', () => {
    const stats = { ...baseStats, topCities: ['名古屋市', '豊橋市', '岡崎市'], prefecturePageCity: null };
    expect(getPrefectureLandingSubtitle('愛知県', stats)).toContain('掲載校が多いのは名古屋市・豊橋市・岡崎市で');
    expect(getPrefectureLandingMetaDescription('愛知県', stats)).toContain('名古屋市・豊橋市・岡崎市などのエリア別情報');
    expect(getPrefectureLandingSubtitle('愛知県', stats).startsWith('愛知県で検討できる')).toBe(true);
  });
});

describe('reserved excerpts for new city landings', () => {
  it('新しい都市ページは県ページと名古屋の口コミを後回しにし、先に登録した都市とも重ねない', () => {
    const reserved = reservedExcerptIdsForNewCityLanding({
      selfSlug: 'okazaki',
      siblings: [
        { slug: 'nagoya', publishWave: 'existing', featuredExcerptIds: ['nagoya-1'] },
        { slug: 'toyota', publishWave: 'phase1_station', featuredExcerptIds: ['toyota-1'] },
        { slug: 'okazaki', publishWave: 'phase1_station', featuredExcerptIds: [] },
        { slug: 'toyohashi', publishWave: 'phase1_station', featuredExcerptIds: ['toyohashi-1'] },
      ],
      prefectureFeaturedExcerptIds: ['pref-1', 'pref-2'],
    });
    expect(reserved.sort()).toEqual(['nagoya-1', 'pref-1', 'pref-2', 'toyota-1'].sort());
  });

  it('都市ページでは、その市のキャンパスの口コミを県内のほかの口コミより優先する', () => {
    const longGood = '他市のキャンパスについて具体的に書いた良かった点です。'.repeat(6);
    const longBad = '入学前に知りたかった気になった点です。'.repeat(5);
    const cityResult = selectRepresentativeRegionalReviewExcerpts({
      schools: [{ id: 'school-1', name: '学校1', slug: 'school-1', localReviewCount: 2 }],
      reviews: [
        {
          id: 'other-city',
          school_id: 'school-1',
          good_comment: longGood,
          bad_comment: longBad,
          created_at: '2026-03-01T00:00:00Z',
          answers: { campus_city: '豊橋市', campus_prefecture: '愛知県' },
        },
        {
          id: 'nagoya-campus',
          school_id: 'school-1',
          good_comment: '名古屋キャンパスは通いやすかったです。',
          bad_comment: null,
          created_at: '2025-01-01T00:00:00Z',
          answers: { campus_city: '名古屋市中区', campus_prefecture: '愛知県' },
        },
      ],
      municipality: '名古屋市',
    });
    expect(cityResult.map((review) => review.id)).toEqual(['nagoya-campus']);
    expect(cityResult[0]?.isCityCampus).toBe(true);

    const prefectureResult = selectRepresentativeRegionalReviewExcerpts({
      schools: [{ id: 'school-1', name: '学校1', slug: 'school-1', localReviewCount: 2 }],
      reviews: [
        {
          id: 'other-city',
          school_id: 'school-1',
          good_comment: longGood,
          bad_comment: longBad,
          created_at: '2026-03-01T00:00:00Z',
          answers: { campus_city: '豊橋市', campus_prefecture: '愛知県' },
        },
        {
          id: 'nagoya-campus',
          school_id: 'school-1',
          good_comment: '名古屋キャンパスは通いやすかったです。',
          bad_comment: null,
          created_at: '2025-01-01T00:00:00Z',
          answers: { campus_city: '名古屋市中区', campus_prefecture: '愛知県' },
        },
      ],
    });
    expect(prefectureResult.map((review) => review.id)).toEqual(['other-city']);
  });

  it('除外IDがあっても、ほかに候補がなければその口コミを使う', () => {
    const result = selectRepresentativeRegionalReviewExcerpts({
      schools: [{ id: 'school-1', name: '学校1', slug: 'school-1', localReviewCount: 1 }],
      reviews: [
        {
          id: 'only-review',
          school_id: 'school-1',
          good_comment: '短い口コミです。',
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      excludeReviewIds: ['only-review'],
    });
    expect(result.map((review) => review.id)).toEqual(['only-review']);
  });
});
