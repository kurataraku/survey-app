import { generatedLocationDictionary } from '@/lib/locations/generated-location-dictionary';

export type LocationDictionaryConfidence = 'high' | 'medium' | 'low';

export type LocationDictionaryMatch = {
  term: string;
  type: 'city' | 'station' | 'alias';
  prefecture: string | null;
  city: string | null;
  station: string | null;
  confidence: LocationDictionaryConfidence;
  ambiguous: boolean;
  exact: boolean;
  start?: number;
  end?: number;
};

const RAILWAY_PREFIX_PATTERN =
  /^(?:阪急|JR|京王|小田急|東急|西武|東武|京急|京成|名鉄|近鉄|南海|阪神|地下鉄|東京メトロ|都営|大阪メトロ)/u;

const SCHOOL_CONTEXT_PATTERN =
  /通信制|高校|学校|候補|おすすめ|お勧め|探|通学|登校|通える|近い|付近|近辺|周辺|近く|在住|から|駅|市|区|町|村/u;

const GENERAL_WORDS = new Set([
  '学校',
  '高校',
  '大学',
  '通信',
  '通学',
  '登校',
  '相談',
  '候補',
  '本人',
  '現在',
  '希望',
  '比較',
  '中央',
]);

const PREFECTURE_NAMES = [
  '北海道',
  '青森県',
  '岩手県',
  '宮城県',
  '秋田県',
  '山形県',
  '福島県',
  '茨城県',
  '栃木県',
  '群馬県',
  '埼玉県',
  '千葉県',
  '東京都',
  '神奈川県',
  '新潟県',
  '富山県',
  '石川県',
  '福井県',
  '山梨県',
  '長野県',
  '岐阜県',
  '静岡県',
  '愛知県',
  '三重県',
  '滋賀県',
  '京都府',
  '大阪府',
  '兵庫県',
  '奈良県',
  '和歌山県',
  '鳥取県',
  '島根県',
  '岡山県',
  '広島県',
  '山口県',
  '徳島県',
  '香川県',
  '愛媛県',
  '高知県',
  '福岡県',
  '佐賀県',
  '長崎県',
  '熊本県',
  '大分県',
  '宮崎県',
  '鹿児島県',
  '沖縄県',
];

function normalizeInput(value: string): string {
  return value
    .replace(/[ 　]/g, '')
    .replace(/[「」『』（）()]/g, '')
    .trim();
}

function maskPrefectureNames(value: string): string {
  let masked = value;
  for (const prefecture of PREFECTURE_NAMES) {
    masked = masked.replaceAll(prefecture, '□'.repeat(prefecture.length));
  }
  return masked;
}

function stripRailwayPrefix(value: string): string {
  return value.replace(RAILWAY_PREFIX_PATTERN, '');
}

function isStandaloneText(normalizedText: string, term: string): boolean {
  const stripped = stripRailwayPrefix(normalizedText);
  return stripped === term || stripped === `${term}駅` || `${stripped}駅` === term;
}

function hasLocationContext(normalizedText: string): boolean {
  return SCHOOL_CONTEXT_PATTERN.test(normalizedText);
}

function confidenceRank(confidence: LocationDictionaryConfidence): number {
  if (confidence === 'high') return 0;
  if (confidence === 'medium') return 1;
  return 2;
}

function baseLocationTerm(term: string): string {
  return normalizeInput(term).replace(/駅$/, '');
}

const KATAKANA_CHAR = /[ァ-ヶー]/u;

// カタカナ語（例: 駅名エイリアス「スクリーン」）が、より長いカタカナ語の内部
// （例: 「スクリーング」= スクーリングの誤字）にマッチした場合は地名として扱わない
function isEmbeddedInKatakanaRun(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : '';
  const after = end < text.length ? text[end] : '';
  return KATAKANA_CHAR.test(before) || KATAKANA_CHAR.test(after);
}

function findIncludedRange(searchableText: string, term: string, station: string | null): { start: number; end: number } | null {
  const candidates = [term, station ? station.replace(/駅$/, '') : ''].filter(Boolean);
  for (const candidate of candidates) {
    let from = 0;
    while (from <= searchableText.length - candidate.length) {
      const start = searchableText.indexOf(candidate, from);
      if (start < 0) break;
      const end = start + candidate.length;
      const isKatakanaTerm = KATAKANA_CHAR.test(candidate[candidate.length - 1]);
      if (!isKatakanaTerm || !isEmbeddedInKatakanaRun(searchableText, start, end)) {
        return { start, end };
      }
      from = start + 1;
    }
  }
  return null;
}

function overlaps(a: LocationDictionaryMatch, b: LocationDictionaryMatch): boolean {
  if (typeof a.start !== 'number' || typeof a.end !== 'number') return false;
  if (typeof b.start !== 'number' || typeof b.end !== 'number') return false;
  return a.start < b.end && b.start < a.end;
}

function removeContainedMatches(matches: LocationDictionaryMatch[]): LocationDictionaryMatch[] {
  const selected: LocationDictionaryMatch[] = [];
  for (const match of matches) {
    const base = baseLocationTerm(match.term);
    const contained = selected.some((current) => {
      const currentBase = baseLocationTerm(current.term);
      if (currentBase === base) return true;
      if (overlaps(match, current) && base.length <= currentBase.length) return true;
      return base.length < currentBase.length && currentBase.includes(base);
    });
    if (!contained) selected.push(match);
  }
  return selected;
}

export function extractDictionaryLocationTerms(
  text: string,
  options: { max?: number } = {}
): LocationDictionaryMatch[] {
  const normalizedText = normalizeInput(text);
  if (!normalizedText) return [];

  const searchableText = maskPrefectureNames(normalizedText);
  const context = hasLocationContext(normalizedText);
  const matches = new Map<string, LocationDictionaryMatch>();

  for (const entry of generatedLocationDictionary) {
    const term = normalizeInput(entry.term);
    const baseTerm = baseLocationTerm(term);
    if (term.length < 2 || baseTerm.length < 2 || GENERAL_WORDS.has(term) || GENERAL_WORDS.has(baseTerm)) {
      continue;
    }

    const exact = isStandaloneText(normalizedText, term);
    const includedRange = findIncludedRange(searchableText, term, entry.station);
    const included = Boolean(includedRange);

    if (!exact && !included) continue;

    const entryConfidence = entry.confidence as LocationDictionaryConfidence;
    const isLowTrust = entry.ambiguous || entryConfidence === 'low';
    if (isLowTrust && !exact && !context) continue;

    const current = matches.get(term);
    const next: LocationDictionaryMatch = {
      term,
      type: entry.type,
      prefecture: entry.prefecture,
      city: entry.city,
      station: entry.station,
      confidence: entryConfidence,
      ambiguous: entry.ambiguous,
      exact,
      start: includedRange?.start,
      end: includedRange?.end,
    };

    if (
      !current ||
      confidenceRank(next.confidence) < confidenceRank(current.confidence) ||
      (next.exact && !current.exact)
    ) {
      matches.set(term, next);
    }
  }

  const sorted = [...matches.values()].sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1;
      const confidenceDiff = confidenceRank(a.confidence) - confidenceRank(b.confidence);
      if (confidenceDiff !== 0) return confidenceDiff;
      return b.term.length - a.term.length;
    });

  return removeContainedMatches(sorted).slice(0, options.max ?? 8);
}
