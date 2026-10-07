import { describe, expect, it } from 'vitest';
import {
  getStandingCampusLocationsInPrefecture,
  isStandingCampus,
  normalizeCampusLocations,
  resolveReviewCampusArea,
  sanitizeCampusLocationsInput,
} from '@/lib/schools/campusLocations';
import type { SchoolCampusLocation } from '@/lib/types/schools';
import {
  buildAdmissionBadges,
  canPublishAdmissionProfile,
  needsReverification,
  sanitizeAdmissionProfileInput,
  toPublicAdmissionProfile,
  type SchoolAdmissionProfile,
} from '@/lib/schools/admissionProfiles';
import {
  addRegionalReview,
  createRegionalReviewIndex,
  finalizeRegionalReviews,
} from '@/lib/schools/regionalReviews';

const parseRating = (value: unknown) => {
  const n = Number(value);
  return n >= 1 && n <= 5 ? n : null;
};

describe('campus location_type', () => {
  it('番地付き所在地と拠点種別を保持し、不正な種別は捨てる', () => {
    const [kept, dropped] = normalizeCampusLocations([
      { prefecture: '愛知県', city: '名古屋市北区', address: '名古屋市北区大野町1-1', location_type: 'headquarters' },
      { prefecture: '愛知県', city: '名古屋市中区', location_type: 'unknown_type' },
    ])!;
    expect(kept).toEqual({
      prefecture: '愛知県',
      city: '名古屋市北区',
      address: '名古屋市北区大野町1-1',
      location_type: 'headquarters',
    });
    expect(dropped.location_type).toBeUndefined();
  });

  it('管理画面の保存でも種別と所在地が消えない', () => {
    const [location] = sanitizeCampusLocationsInput([
      { prefecture: '愛知県', city: '名古屋市', location_type: 'exam_venue', address: ' 名古屋市中村区 ' },
    ]);
    expect(location.location_type).toBe('exam_venue');
    expect(location.address).toBe('名古屋市中村区');
  });

  it('種別未設定は常設、試験会場・説明会のみは拠点数に含めない', () => {
    expect(isStandingCampus({ prefecture: '愛知県', city: '名古屋市' })).toBe(true);
    expect(isStandingCampus({ prefecture: '愛知県', city: '名古屋市', location_type: 'event_only' })).toBe(false);
    const locations = getStandingCampusLocationsInPrefecture(
      [
        { prefecture: '愛知県', city: '名古屋市', location_type: 'commute_campus' },
        { prefecture: '愛知県', city: '豊橋市', location_type: 'exam_venue' },
        { prefecture: '岐阜県', city: '岐阜市' },
      ],
      '愛知県'
    );
    expect(locations.map((location) => location.city)).toEqual(['名古屋市']);
  });
});

describe('admission profile', () => {
  const base: SchoolAdmissionProfile = {
    school_id: 's1',
    admission_scope: 'nationwide',
    admission_prefectures: [],
    schooling_prefectures: ['沖縄県'],
    schooling_note: null,
    source_urls: [{ url: 'https://example.ed.jp/boshu.pdf' }],
    verified_at: '2026-09-01',
    target_year: 2027,
    internal_memo: null,
    status: 'published',
  };

  it('確認日から12か月を過ぎると再確認対象になり公開側では非表示', () => {
    expect(needsReverification(base, new Date('2027-08-31T00:00:00Z'))).toBe(false);
    expect(needsReverification(base, new Date('2027-09-02T00:00:00Z'))).toBe(true);
    expect(toPublicAdmissionProfile(base, new Date('2027-09-02T00:00:00Z'))).toBeNull();
  });

  it('対象年度が過ぎた情報は確認日が新しくても再確認対象', () => {
    const profile = { ...base, target_year: 2025, verified_at: '2026-09-01' };
    expect(needsReverification(profile, new Date('2026-10-01T00:00:00Z'))).toBe(true);
  });

  it('下書きは公開しない', () => {
    expect(toPublicAdmissionProfile({ ...base, status: 'draft' }, new Date('2026-10-01T00:00:00Z'))).toBeNull();
  });

  it('指定都道府県が空なら募集区域は未確認に倒し、都道府県名以外は捨てる', () => {
    const input = sanitizeAdmissionProfileInput({
      admission_scope: 'prefectures',
      admission_prefectures: ['名古屋'],
      schooling_prefectures: ['愛知県', 'foo'],
      source_urls: ['javascript:alert(1)', { url: 'https://www.pref.aichi.jp/x.html', note: '要項' }],
      verified_at: '2026-09-25',
    });
    expect(input.admission_scope).toBe('unknown');
    expect(input.schooling_prefectures).toEqual(['愛知県']);
    expect(input.source_urls).toEqual([{ url: 'https://www.pref.aichi.jp/x.html', note: '要項' }]);
  });

  it('確認日か出典がなければ公開できない', () => {
    const input = sanitizeAdmissionProfileInput({ admission_scope: 'nationwide', source_urls: [] });
    expect(canPublishAdmissionProfile(input)).not.toBeNull();
  });

  it('バッジは確認済みの内容だけから作る', () => {
    const publicProfile = toPublicAdmissionProfile(base, new Date('2026-10-01T00:00:00Z'));
    expect(buildAdmissionBadges(publicProfile, '愛知県').map((badge) => badge.label)).toEqual([
      '全国から出願可',
      'スクーリングは沖縄県',
    ]);
    expect(buildAdmissionBadges(null, '愛知県')).toEqual([]);
  });
});

describe('regional reviews by municipality', () => {
  it('市区町村の回答があるものだけを市の口コミとして数える', () => {
    const index = createRegionalReviewIndex();
    addRegionalReview(index, 's1', { campus_prefecture: '愛知県', campus_city: '名古屋市中村区' }, 4, parseRating);
    addRegionalReview(index, 's1', { campus_prefecture: '愛知県', campus_city: '愛知県名古屋市' }, 2, parseRating);
    addRegionalReview(index, 's1', { campus_prefecture: '愛知県' }, 5, parseRating);
    const [aichi] = finalizeRegionalReviews(index, 's1')!;
    expect(aichi.reviewCount).toBe(3);
    expect(aichi.municipalities).toEqual({ 名古屋市: { reviewCount: 2, overallAvg: 3 } });
  });

  it('区名だけの回答は、県内拠点で一意に決まるときだけ親市へ帰属させる', () => {
    const index = createRegionalReviewIndex();
    const osakaCampuses: SchoolCampusLocation[] = [
      { prefecture: '大阪府', city: '大阪市阿倍野区' },
      { prefecture: '大阪府', city: '大阪市北区' },
      { prefecture: '大阪府', city: '堺市' },
    ];
    addRegionalReview(index, 's1', { campus_prefecture: '大阪府', campus_city: '北区' }, 4, parseRating, '本人', osakaCampuses);
    addRegionalReview(index, 's1', { campus_prefecture: '大阪府', campus_city: '大阪市北区' }, 2, parseRating, '本人', osakaCampuses);
    const [osaka] = finalizeRegionalReviews(index, 's1')!;
    expect(osaka.municipalities).toEqual({ 大阪市: { reviewCount: 2, overallAvg: 3 } });
  });
});

describe('resolveReviewCampusArea', () => {
  const campuses: SchoolCampusLocation[] = [
    { prefecture: '大阪府', city: '大阪市北区' },
    { prefecture: '大阪府', city: '堺市北区' },
    { prefecture: '大阪府', city: '大阪市中央区' },
    { prefecture: '大阪府', city: '大阪市阿倍野区', location_type: 'exam_venue' },
    { prefecture: '東京都', city: '北区' },
    { prefecture: '愛知県', city: '名古屋市西区', address: '名古屋市西区名駅2丁目20-18' },
  ];

  it('同名の行政区が1つの市にしかなければ、その市の区として扱う', () => {
    expect(resolveReviewCampusArea('中央区', '大阪府', campuses)).toEqual({
      city: '大阪市中央区',
      municipality: '大阪市',
      ward: '中央区',
    });
  });

  it('同名の行政区が複数の市にあれば推測しない', () => {
    expect(resolveReviewCampusArea('北区', '大阪府', campuses)).toEqual({
      city: '北区',
      municipality: '北区',
      ward: null,
    });
  });

  it('試験会場など常設でない拠点は帰属の根拠にしない', () => {
    expect(resolveReviewCampusArea('阿倍野区', '大阪府', campuses)?.municipality).toBe('阿倍野区');
  });

  it('東京都の特別区はそのまま扱う', () => {
    expect(resolveReviewCampusArea('北区', '東京都', campuses)?.municipality).toBe('北区');
  });

  it('市名から書かれた回答や住所まるごとの回答は従来どおり正規化する', () => {
    expect(resolveReviewCampusArea('愛知県名古屋市西区名駅2丁目20-18', '愛知県', campuses)).toEqual({
      city: '名古屋市西区',
      municipality: '名古屋市',
      ward: '西区',
    });
    expect(resolveReviewCampusArea('', '大阪府', campuses)).toBeNull();
    expect(resolveReviewCampusArea(undefined, '大阪府', campuses)).toBeNull();
  });
});
