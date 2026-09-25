import { getPrefecturePath, getPrefectureSlug } from '@/lib/prefectures';

/**
 * 公開する都市LPの登録簿。
 *
 * 都市LPは公開条件（常設拠点8か所以上・所在地充足率90%以上・最寄り駅充足率75%以上・
 * 口コミのある学校3校以上・県LPと分かれた一般地域クエリ）を実測で満たした都市だけを追加する。
 * 条件を満たさない都市を増やすと県LPと重複した薄いページになるため、ここ以外で都市LPを生成しない。
 */
export type CityLandingConfig = {
  prefecture: string;
  /** area-normalize の municipality（政令指定都市は親市単位） */
  municipality: string;
  slug: string;
  /** 公開条件を実測で確認した日 */
  gateVerifiedAt: string;
};

export const CITY_LANDINGS: readonly CityLandingConfig[] = [
  {
    prefecture: '愛知県',
    municipality: '名古屋市',
    slug: 'nagoya',
    gateVerifiedAt: '2026-09-25',
  },
];

export function getCityLandingPath(config: CityLandingConfig): string {
  return `${getPrefecturePath(config.prefecture)}/${config.slug}`;
}

export function findCityLanding(prefectureSlug: string, citySlug: string): CityLandingConfig | null {
  return (
    CITY_LANDINGS.find(
      (config) =>
        getPrefectureSlug(config.prefecture) === prefectureSlug.toLowerCase() &&
        config.slug === citySlug.toLowerCase()
    ) ?? null
  );
}

export function getCityLandingsForPrefecture(prefecture: string): CityLandingConfig[] {
  return CITY_LANDINGS.filter((config) => config.prefecture === prefecture);
}
