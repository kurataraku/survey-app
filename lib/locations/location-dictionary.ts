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
};

const RAILWAY_PREFIX_PATTERN =
  /^(?:阪急|JR|京王|小田急|東急|西武|東武|京急|京成|名鉄|近鉄|南海|阪神|地下鉄|東京メトロ|都営|大阪メトロ)/u;

const SCHOOL_CONTEXT_PATTERN =
  /通信制|高校|学校|候補|おすすめ|お勧め|探|通学|登校|通える|近い|付近|近辺|周辺|近く|在住|から|駅|市|区|町|村/u;

const GENERAL_WORDS = new Set([
  '学校',
  '高校',
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

function normalizeInput(value: string): string {
  return value
    .replace(/[ 　]/g, '')
    .replace(/[「」『』（）()]/g, '')
    .trim();
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

function removeContainedMatches(matches: LocationDictionaryMatch[]): LocationDictionaryMatch[] {
  const selected: LocationDictionaryMatch[] = [];
  for (const match of matches) {
    const base = baseLocationTerm(match.term);
    const contained = selected.some((current) => {
      const currentBase = baseLocationTerm(current.term);
      if (currentBase === base) return true;
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

  const context = hasLocationContext(normalizedText);
  const matches = new Map<string, LocationDictionaryMatch>();

  for (const entry of generatedLocationDictionary) {
    const term = normalizeInput(entry.term);
    const baseTerm = baseLocationTerm(term);
    if (term.length < 2 || baseTerm.length < 2 || GENERAL_WORDS.has(term) || GENERAL_WORDS.has(baseTerm)) {
      continue;
    }

    const exact = isStandaloneText(normalizedText, term);
    const included =
      normalizedText.includes(term) ||
      (entry.station ? normalizedText.includes(entry.station.replace(/駅$/, '')) : false);

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
