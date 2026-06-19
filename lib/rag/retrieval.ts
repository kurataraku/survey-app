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
