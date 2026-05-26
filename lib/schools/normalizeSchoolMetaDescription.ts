const HIGH_SCHOOL_SUFFIX = '高等学校';

/**
 * DB の meta_description が「高等学校は…」のように、先頭のブランド部分だけ欠けている場合に補正する。
 * 学校名が「○○高等学校」かつ本文が「高等学校」で始まり、学校名では始まっていないときのみ置き換える。
 */
export function normalizeSchoolMetaDescription(
  schoolName: string,
  metaDescription: string | null | undefined
): string {
  const fallback = `${schoolName}の口コミ・評判をもとに、良い点・気になる点、学費の確認ポイント、通学頻度・スクーリング、向いている人を整理しています。`;
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
