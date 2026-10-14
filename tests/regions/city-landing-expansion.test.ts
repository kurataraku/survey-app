import { describe, expect, it } from 'vitest';
import {
  CITY_LANDING_CANDIDATES,
  CITY_LANDING_GATE,
  getPrefecturePageCityTarget,
  getPublishableCityLandingCandidates,
} from '@/lib/regions/city-landing-candidates';
import { CITY_LANDINGS } from '@/lib/regions/city-landing';
import { buildCityFinderAreas } from '@/lib/schools/regionalLanding';
import {
  reservedExcerptIdsForNewCityLanding,
  selectRepresentativeRegionalReviewExcerpts,
} from '@/lib/schools/regionalReviewExcerpts';
import {
  getCityLandingMetaDescription,
  getCityLandingSubtitle,
  buildCityFaqItems,
} from '@/lib/regions/city-landing-copy';
import {
  getPrefectureLandingHeading,
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
    expect(CITY_LANDINGS.map((city) => city.slug)).toEqual(['nagoya', ...published.map((city) => city.slug)]);
    for (const city of CITY_LANDINGS) {
      if (city.slug === 'nagoya') continue;
      expect(CITY_LANDING_CANDIDATES.some((candidate) => candidate.slug === city.slug)).toBe(true);
    }
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

  it('市の口コミが0件なら見出し・説明文・FAQを県内の表現にする', () => {
    expect(getCityLandingSubtitle(data)).toContain('宮崎県内のキャンパスに通った人の口コミ4件');
    expect(getCityLandingMetaDescription(data)).toContain('宮崎県内のキャンパスに通った人の口コミ4件');
    expect(buildCityFaqItems(data).some((item) => item.answer.includes('宮崎県内'))).toBe(true);
    expect(buildCityFaqItems(data).some((item) => item.answer.includes('宮崎市のキャンパスに通った人の口コミ'))).toBe(
      false
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
