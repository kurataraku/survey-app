/** 都道府県別学校一覧（SEOハブ）の共通文言 */

/** 一覧・比較ページとしての検索意図に合わせた title（全都道府県共通） */
export function getPrefectureLandingTitle(prefecture: string): string {
  return `${prefecture}の通信制高校一覧｜口コミ・評判・学費・通いやすさを比較`;
}

/** ページ上のH1（サポート校も同じ表で比較するため種別を明記する） */
export function getPrefectureLandingHeading(prefecture: string): string {
  return `${prefecture}の通信制高校・サポート校一覧`;
}

/** 都道府県LPの実データから作る要約文の材料 */
export type PrefectureLandingCopyStats = {
  totalSchools: number;
  localCampusLocationCount: number;
  publicCount: number;
  supportCount: number;
  /** 掲載校の学校全体の公開口コミ件数（全国の回答を含む） */
  totalReviewCount: number;
  /** その都道府県のキャンパスに通ったと回答した口コミ件数 */
  localReviewCount: number;
  /** 地域口コミが1件以上ある掲載校数 */
  localReviewSchoolCount: number;
  cityCount: number;
  topCities: string[];
  topStations: string[];
};

/**
 * 地域口コミ件数の表現。
 *
 * 全国に拠点を持つ学校は学校全体の口コミ件数がどの都道府県でも同じ値になるため、
 * 「その県の口コミ○件」と書くと実態より多く見える。地域の根拠として出すのは
 * キャンパス都道府県を回答した件数だけに限る。
 */
function buildLocalReviewPhrase(prefecture: string, stats: PrefectureLandingCopyStats): string {
  if (stats.localReviewCount === 0) return '';
  return `${prefecture}のキャンパスに通った回答${stats.localReviewCount}件（${stats.localReviewSchoolCount}校）`;
}

/** H1直下のリード文。テンプレート文ではなく当該都道府県の実数を入れる */
export function getPrefectureLandingSubtitle(
  prefecture: string,
  stats?: PrefectureLandingCopyStats
): string {
  if (!stats || stats.totalSchools === 0) {
    return `${prefecture}の通信制高校を、口コミと項目別評価から比較できる一覧です。`;
  }

  const areaPart =
    stats.topCities.length > 0
      ? `掲載校が多いのは${stats.topCities.slice(0, 3).join('・')}で、${stats.cityCount}市区町村から絞り込めます。`
      : '';
  const stationPart =
    stats.topStations.length > 0
      ? `${stats.topStations.slice(0, 2).join('・')}など最寄り駅からも確認できます。`
      : '';
  const localPart = buildLocalReviewPhrase(prefecture, stats);
  const reviewPart = localPart ? `${localPart}をもとに、` : '';

  return `${prefecture}で検討できる通信制高校・サポート校${stats.totalSchools}校（うち公立${stats.publicCount}校、サポート校${stats.supportCount}校）を、${prefecture}内${stats.localCampusLocationCount}拠点のキャンパス情報とあわせて比較できます。${reviewPart}学費の確認状態、通いやすさ、項目別評価を同じ表で並べています。${areaPart}${stationPart}`;
}

/** generateMetadata 用の description（当該都道府県の実数のみを使う） */
export function getPrefectureLandingMetaDescription(
  prefecture: string,
  stats?: PrefectureLandingCopyStats
): string {
  if (!stats || stats.totalSchools === 0) {
    return `${prefecture}の通信制高校を、良い点・改善点の両面と観点別満足度で比較できる一覧です。`;
  }

  const localPart = buildLocalReviewPhrase(prefecture, stats);
  const reviewPart = localPart ? `${localPart}・` : '';
  const areaPart = stats.topCities.length > 0 ? `${stats.topCities.slice(0, 3).join('・')}など` : '';

  return `${prefecture}の通信制高校・サポート校${stats.totalSchools}校を比較。${reviewPart}${prefecture}内キャンパス${stats.localCampusLocationCount}拠点、${areaPart}のエリア別情報、公立${stats.publicCount}校の区分、学費の確認状態、良い点と改善点の両面を同じ条件で確認できます。`;
}

/** CollectionPage / ItemList 用 */
export function getPrefectureLandingCollectionDescription(prefecture: string): string {
  return `${prefecture}の通信制高校・サポート校を、キャンパス所在地、学費の確認状態、良い点・改善点の両面と観点別満足度で比較できる一覧。`;
}

export function getPrefectureLandingItemListDescription(prefecture: string): string {
  return `${prefecture}の通信制高校・サポート校を、地域拠点と口コミの両面から比較できる学校一覧`;
}
