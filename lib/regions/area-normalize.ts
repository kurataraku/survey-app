import { prefectures } from '@/lib/prefectures';

/**
 * campus_locations.city は入力経路によって表記が揺れている。
 * 実データには「名古屋市」「名古屋市中村区」「名古屋市中村区椿町」「愛知県刈谷市」
 * 「さいたま市大宮区高鼻町1-20-1」のように、県名付き・町名付き・番地付きが混在する。
 *
 * そのまま集計すると同じ地域が別エリアとして分散し、エリア別の掲載校数が実態より小さく出る。
 * ここで市区町村レベルまで切り戻し、政令指定都市は親市へもまとめられるようにする。
 */
export type NormalizedArea = {
  /** 表示上の最小単位。政令指定都市は「横浜市西区」のように行政区まで含む */
  city: string;
  /** 市区町村レベル。政令指定都市の行政区は親市へまとめる */
  municipality: string;
  /** 政令指定都市の行政区名。該当しなければ null */
  ward: string | null;
};

const DESIGNATED_CITY_WARD = /^(.+?市)(.+?区)/;
const COUNTY_TOWN = /^(.+?郡)(.+?[町村])/;
const SPECIAL_WARD = /^(.+?区)/;
const MUNICIPALITY = /^(.+?[市町村])/;
const COUNTY_ONLY = /^(.+?郡)/;

function stripPrefecturePrefix(value: string): string {
  for (const prefecture of prefectures) {
    if (value.startsWith(prefecture) && value.length > prefecture.length) {
      return value.slice(prefecture.length);
    }
  }
  return value;
}

/**
 * 「廿日市市」「四日市市」「大町市」のように自治体名そのものが市町村の字で終わる場合、
 * 最短一致では接尾辞を落としてしまう。直後の1文字が市町村なら取り込む。
 */
function extendMunicipalitySuffix(rest: string, matched: string): string {
  const next = rest.charAt(matched.length);
  return next === '市' || next === '町' || next === '村' ? `${matched}${next}` : matched;
}

/**
 * 住所文字列から市区町村レベルのエリア名を取り出す。
 *
 * 判定順は「政令市＋行政区」→「郡＋町村」→「特別区」→「市町村」→「郡のみ」。
 * 特別区を市町村より先に見るのは、「千代田区神田三崎町」の末尾の「町」を
 * 自治体名と誤認しないようにするためである。
 */
export function normalizeAreaName(raw: string | null | undefined): NormalizedArea | null {
  const compact = (raw ?? '').replace(/[\s　]+/g, '').trim();
  if (!compact) return null;

  const rest = stripPrefecturePrefix(compact);

  const designated = DESIGNATED_CITY_WARD.exec(rest);
  if (designated) {
    const [, city, ward] = designated;
    return { city: `${city}${ward}`, municipality: city, ward };
  }

  const countyTown = COUNTY_TOWN.exec(rest);
  if (countyTown) {
    const name = extendMunicipalitySuffix(rest, `${countyTown[1]}${countyTown[2]}`);
    return { city: name, municipality: name, ward: null };
  }

  for (const pattern of [SPECIAL_WARD, MUNICIPALITY, COUNTY_ONLY]) {
    const matched = pattern.exec(rest);
    if (matched) {
      const name = extendMunicipalitySuffix(rest, matched[1]);
      return { city: name, municipality: name, ward: null };
    }
  }

  return { city: rest, municipality: rest, ward: null };
}

/** 検索フィルタ比較用。正規化できない値は元の文字列で比較する */
export function toComparableAreaNames(raw: string | null | undefined): string[] {
  const normalized = normalizeAreaName(raw);
  if (!normalized) return [];
  return [...new Set([normalized.city, normalized.municipality])];
}

export type NormalizedStation = {
  /** 「飯田橋駅」のような駅名。路線をまたぐ同一駅をまとめるためのキー */
  station: string;
  /** 「JR総武線」のような路線名。同じ駅に複数入り得る */
  lines: string[];
};

/** 「西武新宿線所沢駅」のように区切りなしで路線名が付く登録値から駅名を取り出す */
function splitLinePrefix(token: string): { station: string; line: string | null } {
  const lineIndex = token.lastIndexOf('線');
  if (lineIndex >= 0 && lineIndex < token.length - 1) {
    return { station: token.slice(lineIndex + 1), line: token.slice(0, lineIndex + 1) };
  }
  return { station: token, line: null };
}

/**
 * 「JR総武線 飯田橋駅」「西武新宿線所沢駅」のような登録値を駅名と路線名に分解する。
 *
 * 同じ駅が路線名の違いで別エントリになるのを防ぐため、集計キーは駅名だけにする。
 */
export function normalizeStationLabel(raw: string | null | undefined): NormalizedStation | null {
  const trimmed = (raw ?? '').replace(/[\s　]+/g, ' ').trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/[ /・,、]+/).filter(Boolean);
  const stationPart = [...parts].reverse().find((part) => part.endsWith('駅'));
  if (!stationPart) {
    return { station: trimmed, lines: [] };
  }

  const { station, line } = splitLinePrefix(stationPart);
  const lines = parts.filter((part) => part !== stationPart);
  if (line) lines.unshift(line);
  return { station, lines };
}

/**
 * 鉄道事業者名の接頭辞。長い表記から先に照合する。
 *
 * 「京成高砂駅」「近鉄名古屋駅」のように事業者名が正式な駅名の一部である駅もあるため、
 * この関数の結果だけで駅をまとめない。同じ都道府県内に接頭辞なしの駅が実在するときだけ
 * 同一駅として統合する（computePrefectureLocationInsights 側で判定する）。
 */
const RAIL_OPERATOR_PREFIXES = [
  'JR東日本',
  'JR西日本',
  'JR東海',
  'JR九州',
  'JR北海道',
  'JR四国',
  'JR',
  '東京メトロ',
  '東京都営',
  '都営',
  '横浜市営地下鉄',
  '名古屋市営地下鉄',
  '大阪市営地下鉄',
  '神戸市営地下鉄',
  '市営地下鉄',
  '大阪メトロ',
  'OsakaMetro',
  '地下鉄',
  '名古屋鉄道',
  '名鉄',
  '近畿日本鉄道',
  '近鉄',
  '南海電鉄',
  '南海',
  '阪急電鉄',
  '阪急',
  '阪神電鉄',
  '阪神',
  '京阪電鉄',
  '京阪',
  '京王電鉄',
  '京王',
  '小田急電鉄',
  '小田急',
  '東急電鉄',
  '東急',
  '京浜急行',
  '京急',
  '京成電鉄',
  '京成',
  '西武鉄道',
  '西武',
  '東武鉄道',
  '東武',
  '相模鉄道',
  '相鉄',
  '愛知環状鉄道',
  '静岡鉄道',
  '神戸電鉄',
  '山陽電鉄',
  '北総鉄道',
  '新京成',
];

/** 事業者名の接頭辞を外した駅名を返す。接頭辞がなければ null */
export function stripRailOperatorPrefix(station: string): string | null {
  for (const prefix of RAIL_OPERATOR_PREFIXES) {
    if (station.startsWith(prefix) && station.length > prefix.length + 1) {
      return station.slice(prefix.length);
    }
  }
  return null;
}
