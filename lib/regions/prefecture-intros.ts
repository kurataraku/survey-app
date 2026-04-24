import { getRegionSlugForPrefecture } from '@/lib/regions/prefecture-url-slugs';
import type { RegionSlug } from '@/lib/regions/types';

/** 東京・大阪・神奈川のみ文面を差し替え。キーは `regionSlug`。 */
const INTRO_LEADS: Partial<Record<RegionSlug, string>> = {
  tokyo:
    '東京都内で通える通信制高校は、キャンパスやサポート体制、学費の感じ方も学校ごとに差があります。まずは口コミが多く参考になりやすい学校と、評判の高い学校からピックアップしてみてください。',
  osaka:
    '大阪府の通信制高校は、通学やオンラインの組み合わせ方も含めて選択肢が広がっています。口コミ件数の多い学校と、満足度の平均が高い学校をまとめて確認できます。',
  kanagawa:
    '神奈川県は東京都内キャンパスに通う選択肢も含め、通信制高校の通い方を考える家庭が多いエリアです。口コミが蓄積されている学校と、評価の高い学校から比較のヒントを得られます。',
};

export function defaultPrefectureIntroLead(prefectureLabel: string): string {
  return `${prefectureLabel}の通信制高校を、口コミの多さと評判の観点から探せます。気になる学校は詳細ページで口コミ一覧もご確認ください。`;
}

export function getPrefectureIntroLead(prefectureLabel: string): string {
  const slug = getRegionSlugForPrefecture(prefectureLabel);
  return INTRO_LEADS[slug] ?? defaultPrefectureIntroLead(prefectureLabel);
}
