/** 学校ハブのCTA・目次など、口コミ一覧ページへの導線ラベル */
export const SCHOOL_REVIEWS_LIST_CTA_TITLE = '口コミ一覧を見る・条件で絞り込む';

export const SCHOOL_REVIEWS_LIST_CTA_SUBTITLE =
  '通学頻度・進路・キャンパスで口コミを探せます';

/** 口コミ一覧ページの h1・metadata.title 用 */
export function schoolReviewsListPageHeading(schoolName: string): string {
  return `${schoolName}の口コミを条件で探す`;
}

/** パンくず JSON-LD の口コミ一覧項目名（直前に学校名があるため短く） */
export const SCHOOL_REVIEWS_LIST_BREADCRUMB_JSONLD_NAME = SCHOOL_REVIEWS_LIST_CTA_TITLE;
