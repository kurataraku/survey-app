/** 都道府県別学校一覧（SEOハブ）の共通文言 */

export type PrefectureMediaStrengthItem = {
  title: string;
  description: string;
};

/** 「{県} 通信制高校 口コミ」系の検索意図に合わせた title（全都道府県共通） */
export function getPrefectureLandingTitle(prefecture: string): string {
  return `${prefecture}の通信制高校の口コミ・評判｜比較して選ぶ`;
}

/** ページ上のH1（titleと同じキーワードを含めつつ自然な日本語にする） */
export function getPrefectureLandingHeading(prefecture: string): string {
  return `${prefecture}の通信制高校の口コミ・評判`;
}

/** H1直下のリード文 */
export function getPrefectureLandingSubtitle(prefecture: string): string {
  return `${prefecture}の通信制高校を、口コミと項目別評価から比較できる一覧です。`;
}

/** 強みブロックのリード文（2行表示用） */
export function getPrefectureLandingMediaStrengthsLead(prefecture: string): [string, string] {
  return [
    '口コミの数や点数だけでなく、良い点・直してほしい点の中身と、先生・学費などの評価も見て比べられます。',
    `${prefecture}の通信制高校を比べるときは、次の3つも参考にしてください。`,
  ];
}

/** メディアの強み（数値ではなく比較の仕方を訴求） */
export function getPrefectureLandingMediaStrengths(
  prefecture: string
): PrefectureMediaStrengthItem[] {
  return [
    {
      title: '良い口コミも、改善してほしい点も並べて掲載',
      description:
        '良かった点だけに絞らず、改善してほしい点も同じ口コミの中で並列して確認できます。宣伝色の強い情報だけでは見えにくい「ちょっと気になる点」まで、選校前に把握しやすくしています。',
    },
    {
      title: '「先生」「学費」など、項目ごとに評価を見られる',
      description:
        '総合の満足度だけでなく、先生の対応、学校の雰囲気、学費など、気になる項目ごとに評価を分けて載せています。ひとつの点数だけでなく、自分が大切にしたいところで学校を比べられます。',
    },
    {
      title: '自分に近い条件の口コミを探せる',
      description: `通学頻度、キャンパス所在地、通信制高校を選んだ理由などから、自分の状況に近い人の口コミを確認できます。${prefecture}の学校を比べながら、気になる通い方や背景に合う声を探せます。`,
    },
  ];
}

/** generateMetadata 用の description（口コミ件数は任意で差し込み） */
export function getPrefectureLandingMetaDescription(
  prefecture: string,
  totalReviewCount?: number
): string {
  const reviewPart =
    totalReviewCount != null && totalReviewCount > 0
      ? `公開口コミ${totalReviewCount}件・`
      : '';
  return `${prefecture}の通信制高校を${reviewPart}良い点・改善点の両面と観点別満足度で比較。総合・学費満足度のピックアップと一覧で選べます。`;
}

/** CollectionPage / ItemList 用 */
export function getPrefectureLandingCollectionDescription(prefecture: string): string {
  return `${prefecture}の通信制高校を、良い点・改善点の両面と観点別満足度で比較できる一覧。口コミが多い学校や評価の高い学校のピックアップ付き。`;
}

export function getPrefectureLandingItemListDescription(prefecture: string): string {
  return `${prefecture}の通信制高校を、観点別満足度と口コミの両面から比較できる学校一覧`;
}
