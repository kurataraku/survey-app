/**
 * GSCで直近減少が目立った学校のメタ上書き（CTR改善用）。
 * AI meta より優先せず、AI meta が無い・長すぎる場合のフォールバックとして使用。
 * キーは schools.slug（実DBの値）と一致させること。
 */
export type DecliningSchoolMetaOverride = {
  title?: string;
  description?: string;
};

export const DECLINING_SCHOOL_META_OVERRIDES: Record<string, DecliningSchoolMetaOverride> = {
  'meguro-nichidai-kuchikomi': {
    title: '目黒日本大学高等学校の口コミ・評判｜学費・スクーリング',
    description:
      '目黒日本大学高等学校（目黒日大）の口コミ・評判を掲載。学費の満足度、通学頻度、サポートの口コミから検討材料を整理します。',
  },
  'wasegaku-yumeiku-kuchikomi': {
    title: 'わせがく夢育高等学校の口コミ・評判｜学費・スクーリング',
    description:
      'わせがく夢育高等学校の口コミ・評判を掲載。学費満足度、通学の負担感、サポートの口コミから冷静に比較できます。',
  },
  'meishu-gakuen-hitachi-koukou-kuchikomi': {
    title: '明秀学園日立高等学校の口コミ・評判｜学費・通学頻度',
    description:
      '明秀学園日立高等学校の口コミ・評判を掲載。学費、スクーリング、サポートの口コミから検討の参考に。',
  },
  'daiichi-gakuin-kuchikomi': {
    title: '第一学院高等学校の口コミ・評判｜学費・スクーリング',
    description:
      '第一学院高等学校の口コミ・評判を掲載。学費満足度、通学頻度、サポート体制などリアルな声を比較できます。',
  },
};

export function getDecliningSchoolMetaOverride(
  slug: string
): DecliningSchoolMetaOverride | undefined {
  return DECLINING_SCHOOL_META_OVERRIDES[slug];
}
