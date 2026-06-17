/**
 * トップページから学校名検索ニーズを受けるための固定リンク。
 * slug は schools テーブルの公開 slug と一致させること。
 */
export type HomeFeaturedSchoolLink = {
  slug: string;
  anchorText: string;
};

export const HOME_FEATURED_SCHOOL_LINKS: HomeFeaturedSchoolLink[] = [
  {
    slug: 'try-gakuin-kuchikomi',
    anchorText: 'トライ式高等学院の口コミ・評判',
  },
  {
    slug: 'human-campus-koukou-kuchikomi',
    anchorText: 'ヒューマンキャンパス高等学校の口コミ・評判',
  },
  {
    slug: 'azusa1-kuchikomi',
    anchorText: 'あずさ第一高等学校の口コミ・評判',
  },
  {
    slug: 'seisa-kokusai-kuchikomi',
    anchorText: '星槎国際高等学校の口コミ・評判',
  },
  {
    slug: 'tsukuba-kaisei-kuchikomi',
    anchorText: 'つくば開成高等学校の口コミ・評判',
  },
];

/** GSCで表示されている旧 slug → 現行 slug（301） */
export const LEGACY_SCHOOL_SLUG_REDIRECTS: Record<string, string> = {
  'kyoto-seisho-koukou-tsushin': 'kyoto-seisho-koukou-kuchikomi',
};

/** トップから都道府県LPへ送る主要エリア */
export const HOME_PRIORITY_PREFECTURES = [
  '東京都',
  '大阪府',
  '神奈川県',
  '埼玉県',
  '千葉県',
  '愛知県',
  '福岡県',
  '兵庫県',
  '京都府',
] as const;
