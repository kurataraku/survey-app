import { prefectures } from '@/lib/prefectures';

/** キーワード内の略称・エリア語 → 都道府県名（DBの schools.prefecture と整合） */
const REGION_TO_PREFS: Record<string, string[]> = {
  東京: ['東京都'],
  都内: ['東京都'],
  首都圏: ['東京都', '神奈川県', '埼玉県', '千葉県'],
  関西: ['大阪府', '京都府', '兵庫県', '奈良県', '和歌山県', '滋賀県'],
  大阪: ['大阪府'],
  京都: ['京都府'],
  名古屋: ['愛知県'],
  福岡: ['福岡県'],
  札幌: ['北海道'],
  仙台: ['宮城県'],
  広島: ['広島県'],
  沖縄: ['沖縄県'],
};

/**
 * ナレッジ記事のキーワードから、口コミ検索を地域寄りにブーストする都道府県を推定する。
 */
export function inferPrefecturesFromKeyword(keyword: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (p: string) => {
    if (!seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  };

  for (const pref of prefectures) {
    if (keyword.includes(pref)) push(pref);
  }

  for (const [needle, prefs] of Object.entries(REGION_TO_PREFS)) {
    if (keyword.includes(needle)) {
      for (const p of prefs) push(p);
    }
  }

  return out;
}

/**
 * アンケート answers.campus_prefecture（主に通っていたキャンパス都道府県）の表記ゆれ。
 * DB照会用。値は prefectures の正式名＋よくある略称のみ。
 */
export function respondentCampusEqValues(pref: string): string[] {
  const alias: Record<string, string[]> = {
    東京都: ['東京'],
    大阪府: ['大阪'],
    京都府: ['京都'],
    北海道: ['札幌'],
    福岡県: ['福岡'],
    宮城県: ['仙台'],
    愛知県: ['名古屋'],
    広島県: ['広島'],
  };
  const extras = alias[pref] || [];
  return [pref, ...extras].filter((v, i, a) => a.indexOf(v) === i);
}
