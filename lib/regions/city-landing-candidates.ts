export type CityLandingCandidateStatus = 'publish' | 'prefecture_page' | 'defer_few_campuses';

export type CityLandingAreaMode = 'ward_station' | 'station_only' | 'station_only_hide_single';

export type CityLandingPublishWave = 'phase1_station' | 'phase2_ward' | 'phase3_low_review';

export type CityLandingCandidate = {
  prefecture: string;
  municipality: string;
  slug: string;
  population2020: number;
  source: '2020国勢調査';
  designatedCity: boolean;
  status: CityLandingCandidateStatus;
  areaMode: CityLandingAreaMode;
  publishWave?: CityLandingPublishWave;
  prefecturePageCity?: string;
  note?: string;
};

export const CITY_LANDING_GATE = {
  minCampusLocations: 6,
  minStationCoverage: 0.75,
  minPrefectureReviewCount: 1,
  maxPrefectureOverlap: 0.8,
} as const;

export const CITY_LANDING_CANDIDATES: readonly CityLandingCandidate[] = [
  { prefecture: '大阪府', municipality: '大阪市', slug: 'osaka', population2020: 2752412, source: '2020国勢調査', designatedCity: true, status: 'publish', areaMode: 'ward_station', publishWave: 'phase2_ward' },
  { prefecture: '神奈川県', municipality: '川崎市', slug: 'kawasaki', population2020: 1538262, source: '2020国勢調査', designatedCity: true, status: 'publish', areaMode: 'ward_station', publishWave: 'phase2_ward' },
  { prefecture: '神奈川県', municipality: '横浜市', slug: 'yokohama', population2020: 3777491, source: '2020国勢調査', designatedCity: true, status: 'publish', areaMode: 'ward_station', publishWave: 'phase2_ward' },
  { prefecture: '千葉県', municipality: '千葉市', slug: 'chiba', population2020: 974951, source: '2020国勢調査', designatedCity: true, status: 'publish', areaMode: 'ward_station', publishWave: 'phase2_ward' },
  { prefecture: '埼玉県', municipality: 'さいたま市', slug: 'saitama', population2020: 1324025, source: '2020国勢調査', designatedCity: true, status: 'publish', areaMode: 'ward_station', publishWave: 'phase2_ward' },
  { prefecture: '兵庫県', municipality: '神戸市', slug: 'kobe', population2020: 1525152, source: '2020国勢調査', designatedCity: true, status: 'publish', areaMode: 'ward_station', publishWave: 'phase2_ward' },
  { prefecture: '岡山県', municipality: '岡山市', slug: 'okayama', population2020: 724691, source: '2020国勢調査', designatedCity: true, status: 'publish', areaMode: 'ward_station', publishWave: 'phase2_ward' },
  { prefecture: '大阪府', municipality: '堺市', slug: 'sakai', population2020: 826161, source: '2020国勢調査', designatedCity: true, status: 'publish', areaMode: 'ward_station', publishWave: 'phase2_ward' },
  { prefecture: '広島県', municipality: '広島市', slug: 'hiroshima', population2020: 1200754, source: '2020国勢調査', designatedCity: true, status: 'publish', areaMode: 'ward_station', publishWave: 'phase2_ward' },
  { prefecture: '福岡県', municipality: '北九州市', slug: 'kitakyushu', population2020: 939029, source: '2020国勢調査', designatedCity: true, status: 'publish', areaMode: 'ward_station', publishWave: 'phase2_ward' },
  { prefecture: '静岡県', municipality: '静岡市', slug: 'shizuoka', population2020: 693389, source: '2020国勢調査', designatedCity: true, status: 'publish', areaMode: 'ward_station', publishWave: 'phase2_ward' },
  { prefecture: '静岡県', municipality: '浜松市', slug: 'hamamatsu', population2020: 790718, source: '2020国勢調査', designatedCity: true, status: 'publish', areaMode: 'ward_station', publishWave: 'phase2_ward' },
  { prefecture: '神奈川県', municipality: '相模原市', slug: 'sagamihara', population2020: 725493, source: '2020国勢調査', designatedCity: true, status: 'publish', areaMode: 'ward_station', publishWave: 'phase2_ward' },

  { prefecture: '北海道', municipality: '旭川市', slug: 'asahikawa', population2020: 329306, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '福島県', municipality: '郡山市', slug: 'koriyama', population2020: 327692, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '埼玉県', municipality: '川越市', slug: 'kawagoe', population2020: 354571, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '埼玉県', municipality: '所沢市', slug: 'tokorozawa', population2020: 342464, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '千葉県', municipality: '船橋市', slug: 'funabashi', population2020: 642907, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '千葉県', municipality: '柏市', slug: 'kashiwa', population2020: 426468, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '東京都', municipality: '八王子市', slug: 'hachioji', population2020: 579355, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '東京都', municipality: '町田市', slug: 'machida', population2020: 431079, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '神奈川県', municipality: '横須賀市', slug: 'yokosuka', population2020: 388078, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '長野県', municipality: '長野市', slug: 'nagano', population2020: 372760, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '岐阜県', municipality: '岐阜市', slug: 'gifu', population2020: 402557, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '愛知県', municipality: '豊田市', slug: 'toyota', population2020: 422330, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '愛知県', municipality: '岡崎市', slug: 'okazaki', population2020: 384654, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '愛知県', municipality: '豊橋市', slug: 'toyohashi', population2020: 371920, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '三重県', municipality: '四日市市', slug: 'yokkaichi', population2020: 305424, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '大阪府', municipality: '枚方市', slug: 'hirakata', population2020: 397289, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '兵庫県', municipality: '姫路市', slug: 'himeji', population2020: 530495, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '兵庫県', municipality: '西宮市', slug: 'nishinomiya', population2020: 485587, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '岡山県', municipality: '倉敷市', slug: 'kurashiki', population2020: 474592, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '福岡県', municipality: '久留米市', slug: 'kurume', population2020: 303316, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },
  { prefecture: '沖縄県', municipality: '那覇市', slug: 'naha', population2020: 317625, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase1_station' },

  { prefecture: '福島県', municipality: 'いわき市', slug: 'iwaki', population2020: 332931, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only_hide_single', publishWave: 'phase3_low_review' },
  { prefecture: '栃木県', municipality: '宇都宮市', slug: 'utsunomiya', population2020: 518757, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase3_low_review' },
  { prefecture: '群馬県', municipality: '前橋市', slug: 'maebashi', population2020: 332149, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase3_low_review' },
  { prefecture: '群馬県', municipality: '高崎市', slug: 'takasaki', population2020: 372973, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only_hide_single', publishWave: 'phase3_low_review' },
  { prefecture: '神奈川県', municipality: '藤沢市', slug: 'fujisawa', population2020: 436905, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase3_low_review' },
  { prefecture: '大阪府', municipality: '東大阪市', slug: 'higashiosaka', population2020: 493940, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase3_low_review' },
  { prefecture: '兵庫県', municipality: '明石市', slug: 'akashi', population2020: 303601, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase3_low_review' },
  { prefecture: '奈良県', municipality: '奈良市', slug: 'nara', population2020: 354630, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase3_low_review' },
  { prefecture: '和歌山県', municipality: '和歌山市', slug: 'wakayama', population2020: 356729, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase3_low_review' },
  { prefecture: '広島県', municipality: '福山市', slug: 'fukuyama', population2020: 460930, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only_hide_single', publishWave: 'phase3_low_review' },
  { prefecture: '長崎県', municipality: '長崎市', slug: 'nagasaki', population2020: 409118, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase3_low_review' },
  { prefecture: '宮崎県', municipality: '宮崎市', slug: 'miyazaki', population2020: 401339, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase3_low_review' },
  { prefecture: '鹿児島県', municipality: '鹿児島市', slug: 'kagoshima', population2020: 593128, source: '2020国勢調査', designatedCity: false, status: 'publish', areaMode: 'station_only', publishWave: 'phase3_low_review' },

  { prefecture: '宮城県', municipality: '仙台市', slug: 'sendai', population2020: 1096704, source: '2020国勢調査', designatedCity: true, status: 'prefecture_page', areaMode: 'ward_station', prefecturePageCity: '仙台市', note: '県ページとの重複率80%以上' },
  { prefecture: '新潟県', municipality: '新潟市', slug: 'niigata', population2020: 789275, source: '2020国勢調査', designatedCity: true, status: 'prefecture_page', areaMode: 'ward_station', prefecturePageCity: '新潟市', note: '県ページとの重複率80%以上' },
  { prefecture: '福岡県', municipality: '福岡市', slug: 'fukuoka', population2020: 1612392, source: '2020国勢調査', designatedCity: true, status: 'prefecture_page', areaMode: 'ward_station', prefecturePageCity: '福岡市', note: '県ページとの重複率80%以上' },
  { prefecture: '秋田県', municipality: '秋田市', slug: 'akita', population2020: 307672, source: '2020国勢調査', designatedCity: false, status: 'prefecture_page', areaMode: 'station_only', prefecturePageCity: '秋田市', note: '県ページとの重複率80%以上' },
  { prefecture: '石川県', municipality: '金沢市', slug: 'kanazawa', population2020: 463254, source: '2020国勢調査', designatedCity: false, status: 'prefecture_page', areaMode: 'station_only', prefecturePageCity: '金沢市', note: '県ページとの重複率80%以上' },
  { prefecture: '香川県', municipality: '高松市', slug: 'takamatsu', population2020: 417496, source: '2020国勢調査', designatedCity: false, status: 'prefecture_page', areaMode: 'station_only', prefecturePageCity: '高松市', note: '県ページとの重複率80%以上' },
  { prefecture: '愛媛県', municipality: '松山市', slug: 'matsuyama', population2020: 511192, source: '2020国勢調査', designatedCity: false, status: 'prefecture_page', areaMode: 'station_only', prefecturePageCity: '松山市', note: '県ページとの重複率80%以上' },
  { prefecture: '高知県', municipality: '高知市', slug: 'kochi', population2020: 326545, source: '2020国勢調査', designatedCity: false, status: 'prefecture_page', areaMode: 'station_only', prefecturePageCity: '高知市', note: '県ページとの重複率80%以上' },
  { prefecture: '北海道', municipality: '札幌市', slug: 'sapporo', population2020: 1973395, source: '2020国勢調査', designatedCity: true, status: 'prefecture_page', areaMode: 'ward_station', prefecturePageCity: '札幌市', note: '県ページとの重複率80%以上' },
  { prefecture: '京都府', municipality: '京都市', slug: 'kyoto', population2020: 1463723, source: '2020国勢調査', designatedCity: true, status: 'prefecture_page', areaMode: 'ward_station', prefecturePageCity: '京都市', note: '県ページとの重複率80%以上' },
  { prefecture: '熊本県', municipality: '熊本市', slug: 'kumamoto', population2020: 738865, source: '2020国勢調査', designatedCity: true, status: 'prefecture_page', areaMode: 'ward_station', prefecturePageCity: '熊本市', note: '県ページとの重複率80%以上' },
  { prefecture: '大分県', municipality: '大分市', slug: 'oita', population2020: 475614, source: '2020国勢調査', designatedCity: false, status: 'prefecture_page', areaMode: 'station_only', prefecturePageCity: '大分市', note: '県ページとの重複率80%以上' },
  { prefecture: '富山県', municipality: '富山市', slug: 'toyama', population2020: 413938, source: '2020国勢調査', designatedCity: false, status: 'prefecture_page', areaMode: 'station_only', prefecturePageCity: '富山市', note: '県ページとの重複率80%以上' },

  { prefecture: '埼玉県', municipality: '川口市', slug: 'kawaguchi', population2020: 594274, source: '2020国勢調査', designatedCity: false, status: 'defer_few_campuses', areaMode: 'station_only', note: '市内常設拠点5か所以下' },
  { prefecture: '埼玉県', municipality: '越谷市', slug: 'koshigaya', population2020: 341621, source: '2020国勢調査', designatedCity: false, status: 'defer_few_campuses', areaMode: 'station_only', note: '市内常設拠点5か所以下' },
  { prefecture: '兵庫県', municipality: '尼崎市', slug: 'amagasaki', population2020: 459593, source: '2020国勢調査', designatedCity: false, status: 'defer_few_campuses', areaMode: 'station_only', note: '市内常設拠点5か所以下' },
  { prefecture: '千葉県', municipality: '松戸市', slug: 'matsudo', population2020: 498232, source: '2020国勢調査', designatedCity: false, status: 'defer_few_campuses', areaMode: 'station_only', note: '市内常設拠点5か所以下' },
  { prefecture: '千葉県', municipality: '市川市', slug: 'ichikawa', population2020: 496676, source: '2020国勢調査', designatedCity: false, status: 'defer_few_campuses', areaMode: 'station_only', note: '市内常設拠点5か所以下' },
  { prefecture: '大阪府', municipality: '豊中市', slug: 'toyonaka', population2020: 401558, source: '2020国勢調査', designatedCity: false, status: 'defer_few_campuses', areaMode: 'station_only', note: '市内常設拠点5か所以下' },
  { prefecture: '愛知県', municipality: '一宮市', slug: 'ichinomiya', population2020: 380073, source: '2020国勢調査', designatedCity: false, status: 'defer_few_campuses', areaMode: 'station_only', note: '市内常設拠点5か所以下' },
  { prefecture: '滋賀県', municipality: '大津市', slug: 'otsu', population2020: 345070, source: '2020国勢調査', designatedCity: false, status: 'defer_few_campuses', areaMode: 'station_only', note: '市内常設拠点5か所以下' },
  { prefecture: '愛知県', municipality: '春日井市', slug: 'kasugai', population2020: 308681, source: '2020国勢調査', designatedCity: false, status: 'defer_few_campuses', areaMode: 'station_only', note: '市内常設拠点5か所以下' },
  { prefecture: '大阪府', municipality: '高槻市', slug: 'takatsuki', population2020: 352698, source: '2020国勢調査', designatedCity: false, status: 'defer_few_campuses', areaMode: 'station_only', note: '市内常設拠点5か所以下' },
  { prefecture: '大阪府', municipality: '吹田市', slug: 'suita', population2020: 385567, source: '2020国勢調査', designatedCity: false, status: 'defer_few_campuses', areaMode: 'station_only', note: '市内常設拠点0か所。データ欠け疑い' },
];

export const CITY_LANDING_ACTIVE_WAVES: readonly CityLandingPublishWave[] = ['phase1_station'];

export function getPublishableCityLandingCandidates(
  waves: readonly CityLandingPublishWave[] = CITY_LANDING_ACTIVE_WAVES
): CityLandingCandidate[] {
  return CITY_LANDING_CANDIDATES.filter(
    (candidate) =>
      candidate.status === 'publish' &&
      candidate.publishWave != null &&
      waves.includes(candidate.publishWave)
  );
}

export const PUBLISHED_CITY_LANDING_CANDIDATES = getPublishableCityLandingCandidates();

export const PREFECTURE_PAGE_CITY_TARGETS = CITY_LANDING_CANDIDATES.filter(
  (candidate) => candidate.status === 'prefecture_page' && candidate.prefecturePageCity
);

export function getPrefecturePageCityTarget(prefecture: string): CityLandingCandidate | null {
  return (
    PREFECTURE_PAGE_CITY_TARGETS.find((candidate) => candidate.prefecture === prefecture) ?? null
  );
}
