import { getRegionSlugForPrefecture } from '@/lib/regions/prefecture-url-slugs';
import type { RegionSlug } from '@/lib/regions/types';

/** 東京・大阪・神奈川・埼玉・千葉・愛知・福岡・兵庫・京都は文面を差し替え。キーは `regionSlug`。 */
const INTRO_LEADS: Partial<Record<RegionSlug, string>> = {
  tokyo:
    '東京都の通信制高校を、総合満足度だけでなく、学びの柔軟さ、先生・職員の対応、サポート体制、在校生の雰囲気、単位取得、進路サポート、学費などの項目別評価から比較できます。気になる学校は、良かった点と改善してほしい点のコメントもあわせて確認してみてください。',
  osaka:
    '大阪府の通信制高校は、通学やオンラインの組み合わせ方も含めて選択肢が広がっています。口コミ件数の多い学校と、満足度の平均が高い学校をまとめて確認できます。',
  kanagawa:
    '神奈川県は東京都内キャンパスに通う選択肢も含め、通信制高校の通い方を考える家庭が多いエリアです。口コミが蓄積されている学校と、評価の高い学校から比較のヒントを得られます。',
  saitama:
    '埼玉県は首都圏への通学や、県内キャンパスでのスクーリングなど、通い方の選択肢が学校ごとに異なります。口コミの通学頻度と学費満足度をあわせて比較してください。',
  chiba:
    '千葉県の通信制高校は、オンライン中心から週数回通学まで幅があります。口コミが多い学校と、サポート評価の高い学校から検討の起点をつかめます。',
  aichi:
    '愛知県（名古屋圏）の通信制高校は、進路サポートや通学頻度の違いが学校選びのポイントになりやすいエリアです。口コミと項目別評価から比較できます。',
  fukuoka:
    '福岡県の通信制高校は、九州エリアから通う家庭も含め、キャンパスの立地や通い方が学校ごとに異なります。口コミの良い点・気になる点をあわせて確認してください。',
  hyogo:
    '兵庫県（阪神間）の通信制高校は、通学距離やスクーリングの頻度が選校の重要ポイントになります。口コミ件数の多い学校から評判の傾向を把握できます。',
  kyoto:
    '京都府の通信制高校は、通学形態やサポート体制が学校ごとに大きく異なります。口コミ・評判ページから、良かった点と注意点の両面を確認してください。',
};

export function defaultPrefectureIntroLead(prefectureLabel: string): string {
  return `${prefectureLabel}の通信制高校を、口コミの多さと評判の観点から探せます。気になる学校は詳細ページで口コミ一覧もご確認ください。`;
}

export function getPrefectureIntroLead(prefectureLabel: string): string {
  const slug = getRegionSlugForPrefecture(prefectureLabel);
  return INTRO_LEADS[slug] ?? defaultPrefectureIntroLead(prefectureLabel);
}
