import { getPrefecturePath, getPrefectureSlug } from '@/lib/prefectures';
import {
  PUBLISHED_CITY_LANDING_CANDIDATES,
  type CityLandingAreaMode,
  type CityLandingPublishWave,
} from '@/lib/regions/city-landing-candidates';

/**
 * 公開する都市LPの登録簿。
 *
 * 都市LPは lib/regions/city-landing-candidates.ts の候補リストと監査スクリプトで
 * 公開条件（拠点6か所以上・最寄り駅75%以上・県内口コミ1件以上・県LP重複率80%未満）を
 * 満たすと確認した都市だけを追加する。条件を満たさない都市は県LPで受けるか見送る。
 * いま公開するのは第1波（駅だけの市）と、区を補った第2波（政令指定都市）だけ。
 * 口コミが少ない市はGoogleへの登録状況を見てから追加する。
 */
export type CityLandingConfig = {
  prefecture: string;
  /** area-normalize の municipality（政令指定都市は親市単位） */
  municipality: string;
  slug: string;
  /** 公開条件を実測で確認した日 */
  gateVerifiedAt: string;
  /** 区と駅を出すか、駅だけで出すか。 */
  areaMode: CityLandingAreaMode;
  /** 公開順の管理用。 */
  publishWave: CityLandingPublishWave | 'existing';
};

/**
 * 同じ県の都市LPは、この並びで先のページが使った代表口コミを後回しにする。
 * 公開済みのページの口コミが後から公開した都市に引きずられないよう、公開した波の順に並べる。
 */
const PUBLISH_WAVE_ORDER: Record<CityLandingConfig['publishWave'], number> = {
  existing: 0,
  phase1_station: 1,
  phase2_ward: 2,
  phase3_low_review: 3,
};

export const CITY_LANDINGS: readonly CityLandingConfig[] = [
  {
    prefecture: '愛知県',
    municipality: '名古屋市',
    slug: 'nagoya',
    gateVerifiedAt: '2026-09-25',
    areaMode: 'ward_station' as const,
    publishWave: 'existing' as const,
  },
  ...PUBLISHED_CITY_LANDING_CANDIDATES.map((candidate) => ({
    prefecture: candidate.prefecture,
    municipality: candidate.municipality,
    slug: candidate.slug,
    gateVerifiedAt: '2026-10-14',
    areaMode: candidate.areaMode,
    publishWave: candidate.publishWave ?? ('phase1_station' as const),
  })),
]
  .map((config, index) => ({ config, index }))
  .sort(
    (a, b) =>
      PUBLISH_WAVE_ORDER[a.config.publishWave] - PUBLISH_WAVE_ORDER[b.config.publishWave] ||
      a.index - b.index
  )
  .map(({ config }) => config);

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
