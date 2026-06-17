const HIGH_SCHOOL_SUFFIX = '高等学校';

function getFallbackDescription(schoolName: string, reviewCount: number): string {
  if (reviewCount > 0) {
    return `${schoolName}の口コミ・評判をもとに、良い点・気になる点、学費の確認ポイント、通学頻度・スクーリング、向いている人を整理しています。`;
  }

  return `${schoolName}の通信制課程の特徴と確認ポイントを整理。口コミは募集中です。学費・通学形態・サポート内容は必ず学校公式サイトで最新情報をご確認ください。`;
}

/**
 * DB の meta_description が「高等学校は…」のように、先頭のブランド部分だけ欠けている場合に補正する。
 * 学校名が「○○高等学校」かつ本文が「高等学校」で始まり、学校名では始まっていないときのみ置き換える。
 */
export function normalizeSchoolMetaDescription(
  schoolName: string,
  metaDescription: string | null | undefined,
  reviewCount = 0
): string {
  const fallback = getFallbackDescription(schoolName, reviewCount);
  const raw = metaDescription?.trim();
  if (!raw) return fallback;

  if (raw.startsWith(schoolName)) return raw;

  if (
    schoolName.endsWith(HIGH_SCHOOL_SUFFIX) &&
    schoolName.length > HIGH_SCHOOL_SUFFIX.length &&
    raw.startsWith(HIGH_SCHOOL_SUFFIX)
  ) {
    return schoolName + raw.slice(HIGH_SCHOOL_SUFFIX.length);
  }

  return raw;
}
