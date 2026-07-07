import { createClient } from '@supabase/supabase-js';
import {
  CHAT_EMBEDDING_DIMENSIONS,
  CHAT_EMBEDDING_MODEL,
  getChatOpenAIClient,
} from '@/lib/chat/config';
import type { RagMatchRow, RagReasonGroup, RagSourceType } from '@/lib/rag/types';

export type RagSearchFilters = {
  prefecture?: string | null;
  schoolId?: string | null;
  reasonGroup?: RagReasonGroup | null;
  sourceTypes?: RagSourceType[] | null;
  matchCount?: number;
};

export type CampusAreaSchoolMatch = {
  id: string;
  name: string;
  prefecture: string | null;
  campusLocations: Array<{
    prefecture: string;
    city: string;
    nearestStations: string[];
  }>;
};

function getSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase環境変数が設定されていません');
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

function toVectorLiteral(values: number[]): string {
  return `[${values.map((v) => `${v}`).join(',')}]`;
}

export async function embedQueryText(query: string): Promise<string> {
  const openai = getChatOpenAIClient();
  const response = await openai.embeddings.create({
    model: CHAT_EMBEDDING_MODEL,
    dimensions: CHAT_EMBEDDING_DIMENSIONS,
    input: query,
  });
  const vector = response.data[0]?.embedding;
  if (!vector) throw new Error('query embedding の生成に失敗しました');
  return toVectorLiteral(vector);
}

export async function searchRagDocuments(
  query: string,
  filters: RagSearchFilters = {}
): Promise<RagMatchRow[]> {
  const supabase = getSupabaseServiceClient();
  const queryEmbedding = await embedQueryText(query);
  const { data, error } = await supabase.rpc('match_rag_documents', {
    query_embedding: queryEmbedding,
    match_count: filters.matchCount ?? 28,
    filter_prefecture: filters.prefecture ?? null,
    filter_school_id: filters.schoolId ?? null,
    filter_reason_group: filters.reasonGroup ?? null,
    filter_source_types: filters.sourceTypes ?? null,
  });

  if (error) throw error;
  return (data ?? []) as RagMatchRow[];
}

export async function fetchRagDocumentsBySchoolNames(
  schoolNames: string[],
  limitPerSchool = 4
): Promise<RagMatchRow[]> {
  const names = [...new Set(schoolNames.map((name) => name.trim()).filter(Boolean))];
  if (names.length === 0) return [];

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from('rag_documents')
    .select(
      'id, source_type, source_id, chunk_key, school_id, school_name, prefecture, reason_groups, title, content, metadata, source_url'
    )
    .eq('is_public', true)
    .in('school_name', names)
    .limit(names.length * Math.max(limitPerSchool * 3, 8));

  if (error) throw error;

  const grouped = new Map<string, RagMatchRow[]>();
  for (const row of data ?? []) {
    const typed = row as Omit<RagMatchRow, 'similarity' | 'score'>;
    if (!typed.school_name) continue;
    const rows = grouped.get(typed.school_name) ?? [];
    rows.push({
      ...typed,
      similarity: 1,
      score: 1.2,
    });
    grouped.set(typed.school_name, rows);
  }

  return names.flatMap((name) => (grouped.get(name) ?? []).slice(0, limitPerSchool));
}

function parseCampusLocations(value: unknown): CampusAreaSchoolMatch['campusLocations'] {
  if (!Array.isArray(value)) return [];
  return value
    .map((location) => {
      if (!location || typeof location !== 'object') return null;
      const record = location as Record<string, unknown>;
      const prefecture = typeof record.prefecture === 'string' ? record.prefecture.trim() : '';
      const city = typeof record.city === 'string' ? record.city.trim() : '';
      if (!prefecture || !city) return null;
      const nearestStations = Array.isArray(record.nearest_stations)
        ? record.nearest_stations
            .map((station) => (typeof station === 'string' ? station.trim() : ''))
            .filter(Boolean)
        : typeof record.nearest_station === 'string'
          ? [record.nearest_station.trim()].filter(Boolean)
          : [];
      return { prefecture, city, nearestStations };
    })
    .filter((location): location is CampusAreaSchoolMatch['campusLocations'][number] =>
      Boolean(location)
    );
}

export async function fetchActiveSchoolsByCampusArea(options: {
  prefecture: string;
  cities: string[];
  limit?: number;
}): Promise<CampusAreaSchoolMatch[]> {
  const cities = [...new Set(options.cities.map((city) => city.trim()).filter(Boolean))];
  if (!options.prefecture || cities.length === 0) return [];

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, prefecture, prefectures, campus_locations')
    .eq('status', 'active')
    .eq('is_public', true)
    .limit(1500);

  if (error) throw error;

  const citySet = new Set(cities);
  const matches = (data ?? [])
    .map((row) => {
      const record = row as {
        id: string;
        name: string;
        prefecture: string | null;
        prefectures: string[] | null;
        campus_locations: unknown;
      };
      const campusLocations = parseCampusLocations(record.campus_locations);
      const matchedLocations = campusLocations.filter(
        (location) => location.prefecture === options.prefecture && citySet.has(location.city)
      );
      if (matchedLocations.length === 0) return null;
      return {
        id: record.id,
        name: record.name,
        prefecture: record.prefecture,
        campusLocations: matchedLocations,
      };
    })
    .filter((school): school is CampusAreaSchoolMatch => Boolean(school));

  return matches.slice(0, options.limit ?? 24);
}

export async function fetchActiveSchoolsByPrefectures(options: {
  prefectures: string[];
  limit?: number;
}): Promise<CampusAreaSchoolMatch[]> {
  const prefectures = [
    ...new Set(options.prefectures.map((prefecture) => prefecture.trim()).filter(Boolean)),
  ];
  if (prefectures.length === 0) return [];

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, prefecture, prefectures, campus_locations')
    .eq('status', 'active')
    .eq('is_public', true)
    .limit(1500);

  if (error) throw error;

  const prefectureSet = new Set(prefectures);
  const matches = (data ?? [])
    .map((row) => {
      const record = row as {
        id: string;
        name: string;
        prefecture: string | null;
        prefectures: string[] | null;
        campus_locations: unknown;
      };
      const campusLocations = parseCampusLocations(record.campus_locations);
      const matchedLocations = campusLocations.filter((location) =>
        prefectureSet.has(location.prefecture)
      );
      const hasPrefecture =
        (record.prefecture && prefectureSet.has(record.prefecture)) ||
        (Array.isArray(record.prefectures) &&
          record.prefectures.some((prefecture) => prefectureSet.has(prefecture)));
      if (matchedLocations.length === 0 && !hasPrefecture) return null;
      return {
        id: record.id,
        name: record.name,
        prefecture: record.prefecture,
        campusLocations: matchedLocations,
      };
    })
    .filter((school): school is CampusAreaSchoolMatch => Boolean(school));

  return matches.slice(0, options.limit ?? 36);
}

function normalizeLocationTerm(value: string): string {
  return value
    .replace(/[ 　]/g, '')
    .replace(/[「」『』（）()]/g, '')
    .trim();
}

function locationMatchesTerm(location: CampusAreaSchoolMatch['campusLocations'][number], term: string): boolean {
  const normalizedTerm = normalizeLocationTerm(term);
  if (!normalizedTerm) return false;
  const stationTerm = normalizedTerm.endsWith('駅')
    ? normalizedTerm.replace(/駅$/, '')
    : normalizedTerm;
  const locationTexts = [
    location.prefecture,
    location.city,
    ...location.nearestStations,
    ...location.nearestStations.map((station) => station.replace(/駅/g, '')),
  ].map(normalizeLocationTerm);

  return locationTexts.some(
    (text) =>
      text.includes(normalizedTerm) ||
      normalizedTerm.includes(text) ||
      (stationTerm.length >= 2 && text.includes(stationTerm))
  );
}

export async function fetchActiveSchoolsByLocationTerms(options: {
  terms: string[];
  prefecture?: string | null;
  limit?: number;
}): Promise<CampusAreaSchoolMatch[]> {
  const terms = [...new Set(options.terms.map(normalizeLocationTerm).filter((term) => term.length >= 2))];
  if (terms.length === 0 && !options.prefecture) return [];

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, prefecture, prefectures, campus_locations')
    .eq('status', 'active')
    .eq('is_public', true)
    .limit(1500);

  if (error) throw error;

  const scored = (data ?? [])
    .map((row) => {
      const record = row as {
        id: string;
        name: string;
        prefecture: string | null;
        prefectures: string[] | null;
        campus_locations: unknown;
      };
      const campusLocations = parseCampusLocations(record.campus_locations);
      const prefectureLocations = options.prefecture
        ? campusLocations.filter((location) => location.prefecture === options.prefecture)
        : campusLocations;
      const matchedLocations = prefectureLocations.filter((location) =>
        terms.some((term) => locationMatchesTerm(location, term))
      );
      const prefectureMatch =
        Boolean(options.prefecture) &&
        (record.prefecture === options.prefecture ||
          campusLocations.some((location) => location.prefecture === options.prefecture) ||
          (Array.isArray(record.prefectures) &&
            record.prefectures.some((prefecture) => prefecture === options.prefecture)));

      if (matchedLocations.length === 0 && !prefectureMatch) return null;

      const score = matchedLocations.length * 10 + (prefectureMatch ? 1 : 0);
      return {
        school: {
          id: record.id,
          name: record.name,
          prefecture: record.prefecture,
          campusLocations: matchedLocations.length > 0 ? matchedLocations : prefectureLocations.slice(0, 4),
        },
        score,
      };
    })
    .filter((item): item is { school: CampusAreaSchoolMatch; score: number } => Boolean(item))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, options.limit ?? 24).map((item) => item.school);
}

export async function fetchRagDocumentsBySchoolIds(
  schoolIds: string[],
  limitPerSchool = 3
): Promise<RagMatchRow[]> {
  const ids = [...new Set(schoolIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return [];

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from('rag_documents')
    .select(
      'id, source_type, source_id, chunk_key, school_id, school_name, prefecture, reason_groups, title, content, metadata, source_url'
    )
    .eq('is_public', true)
    .in('school_id', ids)
    .limit(ids.length * Math.max(limitPerSchool * 4, 10));

  if (error) throw error;

  const sourcePriority: Partial<Record<RagSourceType, number>> = {
    review: 1,
    school_summary: 2,
    school: 3,
    faq: 4,
    course: 5,
    tuition: 6,
    seo_section: 7,
    article: 8,
  };
  const grouped = new Map<string, RagMatchRow[]>();
  for (const row of data ?? []) {
    const typed = row as Omit<RagMatchRow, 'similarity' | 'score'>;
    if (!typed.school_id) continue;
    const rows = grouped.get(typed.school_id) ?? [];
    rows.push({
      ...typed,
      similarity: 1,
      score: 1.35 - (sourcePriority[typed.source_type] ?? 9) * 0.01,
    });
    grouped.set(typed.school_id, rows);
  }

  return ids.flatMap((id) =>
    (grouped.get(id) ?? [])
      .sort(
        (a, b) =>
          (sourcePriority[a.source_type] ?? 9) - (sourcePriority[b.source_type] ?? 9)
      )
      .slice(0, limitPerSchool)
  );
}

export async function fetchRagDocumentsByKeywords(
  keywords: string[],
  options: { prefecture?: string | null; limit?: number } = {}
): Promise<RagMatchRow[]> {
  const terms = [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))].slice(0, 10);
  if (terms.length === 0) return [];

  const supabase = getSupabaseServiceClient();
  const query = supabase
    .from('rag_documents')
    .select(
      'id, source_type, source_id, chunk_key, school_id, school_name, prefecture, reason_groups, title, content, metadata, source_url'
    )
    .eq('is_public', true)
    .not('school_name', 'is', null)
    .or(
      terms
        .flatMap((term) => [`title.ilike.%${term}%`, `content.ilike.%${term}%`])
        .join(',')
    )
    .limit(options.limit ?? 16);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? [])
    .filter((row) => {
      if (!options.prefecture) return true;
      const prefecture = (row as { prefecture: string | null }).prefecture;
      return prefecture === options.prefecture || prefecture === null;
    })
    .map((row) => ({
      ...(row as Omit<RagMatchRow, 'similarity' | 'score'>),
      similarity: 1,
      score: 1.15,
    }));
}

export function inferReasonGroupFromText(text: string): RagReasonGroup | null {
  const normalized = text.toLowerCase();
  if (
    normalized.includes('朝') ||
    normalized.includes('起きられ') ||
    normalized.includes('起きれ') ||
    normalized.includes('午前') ||
    normalized.includes('午後') ||
    normalized.includes('睡眠') ||
    normalized.includes('起立性') ||
    normalized.includes('体調') ||
    normalized.includes('障害')
  ) {
    return 'health_development';
  }
  if (
    normalized.includes('大学') ||
    normalized.includes('受験') ||
    normalized.includes('進学') ||
    normalized.includes('指定校') ||
    normalized.includes('推薦') ||
    normalized.includes('総合型') ||
    normalized.includes('模試') ||
    normalized.includes('予備校') ||
    normalized.includes('進路') ||
    normalized.includes('勉強') ||
    normalized.includes('学習') ||
    normalized.includes('遅れ') ||
    normalized.includes('追いつ') ||
    normalized.includes('レポート') ||
    normalized.includes('単位') ||
    normalized.includes('通学') ||
    normalized.includes('学習スタイル')
  ) {
    return 'learning_style';
  }
  if (
    normalized.includes('不登校') ||
    normalized.includes('心の不調') ||
    normalized.includes('人間関係') ||
    normalized.includes('学校が合わ')
  ) {
    return 'mental_relationship';
  }
  if (normalized.includes('発達')) {
    return 'health_development';
  }
  return null;
}

export function rerankForGuardianConsultation(rows: RagMatchRow[], reasonGroup: RagReasonGroup | null) {
  const scored = rows.map((row) => {
    let bonus = 0;
    const metadata = row.metadata ?? {};
    const respondentRole = typeof metadata.respondent_role === 'string' ? metadata.respondent_role : null;
    if (row.source_type === 'review' && respondentRole === '保護者') bonus += 0.08;
    if (
      reasonGroup &&
      Array.isArray(row.reason_groups) &&
      row.reason_groups.includes(reasonGroup)
    ) {
      bonus += 0.12;
    }
    if (row.source_type === 'school_summary' || row.source_type === 'faq') bonus += 0.03;
    return { row, score: (row.score ?? row.similarity ?? 0) + bonus };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .map((s) => s.row);
}
