import type { DecliningSchoolMetaOverride } from '@/lib/schools/declining-school-meta';

/**
 * GSCで表示回数が出ている学校の個別meta（AI meta 未設定時のCTR改善用）。
 * slug は schools テーブルの公開 slug と一致させること。
 */
export const GSC_PRIORITY_SCHOOL_META_OVERRIDES: Record<string, DecliningSchoolMetaOverride> = {
  'kyoto-seisho-koukou-kuchikomi': {
    title: '京都成章高等学校 通信制の口コミ・評判｜在校生・保護者のリアルな声',
    description:
      '京都成章高等学校（通信制）の口コミ・評判ページ。公式情報から確認できる特徴と、口コミ募集状況を整理。学費・通学形態は公式サイトでご確認ください。',
  },
  'maakuri-kokusai-koukou-kuchikomi': {
    title: 'マーキュリー国際高等学校の口コミ・評判｜通信制の特徴と注意点',
    description:
      'マーキュリー国際高等学校の口コミ・評判を掲載予定。通信制課程の特徴、学費・スクーリングの確認ポイントを整理しています。',
  },
  'mizuho-msc-koukou-kuchikomi': {
    title: '瑞穂MSC高等学校の口コミ・評判｜通信制の特徴と注意点',
    description:
      '瑞穂MSC高等学校の口コミ・評判ページ。公式情報から確認できる特徴と口コミ募集状況を整理。学費・通学形態は公式サイトでご確認ください。',
  },
  'yugawara-chuo-koutou-gakuin-kuchikomi': {
    title: 'ゆがわら中央高等学院の口コミ・評判｜在校生・保護者のリアルな声',
    description:
      'ゆがわら中央高等学院の口コミ・評判を掲載。良かった点・気になる点、学費・通学頻度の口コミから検討材料を整理します。',
  },
  'fukui-ict-chuo-koutou-gakuin-kuchikomi': {
    title: 'ふくいICT中央高等学院の口コミ・評判｜在校生・保護者のリアルな声',
    description:
      'ふくいICT中央高等学院の口コミ・評判を掲載。良かった点・気になる点、学費・通学頻度の口コミから検討材料を整理します。',
  },
};

export function getGscPrioritySchoolMetaOverride(
  slug: string
): DecliningSchoolMetaOverride | undefined {
  return GSC_PRIORITY_SCHOOL_META_OVERRIDES[slug];
}
