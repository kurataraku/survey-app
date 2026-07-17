import { createAdminSupabaseClient } from '@/lib/supabase/server';

export type SchoolNameResolution = {
  /** 正式校名に解決できた学校名（本文での出現順・最新発話優先） */
  resolved: string[];
  /** 学校名らしい表記だがDBに該当がなかったトークン */
  unresolved: string[];
};

type SchoolNameIndexEntry = {
  name: string;
  nameNorm: string;
  core: string;
  aliasNorms: string[];
  aliasCores: string[];
};

const SCHOOL_NAME_SUFFIX_PATTERN = /(?:高等学校|高等学院|高等専修学校|高校|学院|学園)$/u;

const SCHOOL_TOKEN_PATTERN =
  /[一-龥ぁ-んァ-ヶA-Za-z0-9ー・]+(?:高等学校|高等学院|高等専修学校|高校|学院|学園)/gu;

// 学校名ではない一般語（コア部分）。誤検出を防ぐ
const GENERIC_SCHOOL_CORES = new Set([
  '通信制',
  '通信',
  '通信制高等',
  '全日制',
  '定時制',
  '私立',
  '公立',
  '県立',
  '都立',
  '市立',
  '道立',
  '府立',
  '国立',
  'サポート',
  '男子',
  '女子',
  '普通',
  '近くの',
  '地元の',
  'おすすめの',
]);

function normalizeSchoolText(value: string): string {
  return value
    .replace(/[ 　・／/]/g, '')
    .replace(/ッ/g, 'ツ')
    .replace(/ヶ/g, 'ケ')
    .trim();
}

function toCore(normalized: string): string {
  return normalized.replace(SCHOOL_NAME_SUFFIX_PATTERN, '');
}

let schoolNameIndexCache: SchoolNameIndexEntry[] | null = null;
let schoolNameIndexCachedAt = 0;
const SCHOOL_NAME_INDEX_TTL_MS = 10 * 60 * 1000;

async function loadSchoolNameIndex(): Promise<SchoolNameIndexEntry[]> {
  const now = Date.now();
  if (schoolNameIndexCache && now - schoolNameIndexCachedAt < SCHOOL_NAME_INDEX_TTL_MS) {
    return schoolNameIndexCache;
  }

  const supabase = createAdminSupabaseClient();
  const [{ data: schools, error: schoolsError }, { data: aliases, error: aliasesError }] =
    await Promise.all([
      supabase.from('schools').select('id, name').eq('status', 'active'),
      supabase.from('school_aliases').select('school_id, alias'),
    ]);

  if (schoolsError) throw schoolsError;

  const aliasesBySchoolId = new Map<string, string[]>();
  if (!aliasesError && Array.isArray(aliases)) {
    for (const row of aliases) {
      const schoolId = typeof row.school_id === 'string' ? row.school_id : '';
      const alias = typeof row.alias === 'string' ? row.alias.trim() : '';
      if (!schoolId || !alias) continue;
      const list = aliasesBySchoolId.get(schoolId) ?? [];
      list.push(alias);
      aliasesBySchoolId.set(schoolId, list);
    }
  }

  const index: SchoolNameIndexEntry[] = [];
  for (const school of schools ?? []) {
    const name = typeof school.name === 'string' ? school.name.trim() : '';
    if (!name) continue;
    const nameNorm = normalizeSchoolText(name);
    const aliasList = aliasesBySchoolId.get(school.id as string) ?? [];
    const aliasNorms = aliasList.map(normalizeSchoolText).filter(Boolean);
    index.push({
      name,
      nameNorm,
      core: toCore(nameNorm),
      aliasNorms,
      aliasCores: aliasNorms.map(toCore).filter(Boolean),
    });
  }

  schoolNameIndexCache = index;
  schoolNameIndexCachedAt = now;
  return index;
}

function isGenericSchoolPhrase(core: string): boolean {
  if (GENERIC_SCHOOL_CORES.has(core)) return true;
  // 「国分寺近辺の通信制」「◯◯に合う私立」のようなカテゴリ表現を除外
  for (const generic of GENERIC_SCHOOL_CORES) {
    if (core.endsWith(generic)) return true;
  }
  return false;
}

function extractSchoolNameTokens(text: string): string[] {
  const tokens = text.match(SCHOOL_TOKEN_PATTERN) ?? [];
  const result: string[] = [];
  for (const raw of tokens) {
    const norm = normalizeSchoolText(raw);
    const core = toCore(norm);
    if (core.length < 2) continue;
    if (isGenericSchoolPhrase(core)) continue;
    if (!result.includes(norm)) result.push(norm);
  }
  return result;
}

// 学校名として不自然な文章断片（助詞・修飾表現を含む）かどうか
function isLikelySentenceFragment(tokenNorm: string): boolean {
  const core = toCore(tokenNorm);
  if (core.length > 12) return true;
  return /[のをがへ]|に合う|に通|探し|通え|おすすめ|オススメ|近く|近辺|周辺|あたり|辺り/u.test(core);
}

function matchTokenToSchool(
  tokenNorm: string,
  index: SchoolNameIndexEntry[]
): SchoolNameIndexEntry | null {
  const tokenCore = toCore(tokenNorm);

  // 1. 正式名称・別名との完全一致
  for (const entry of index) {
    if (entry.nameNorm === tokenNorm || entry.aliasNorms.includes(tokenNorm)) return entry;
  }

  // 2. コア（接尾語を除いた部分）同士の前方一致。「科学技術高校」→「科学技術学園高等学校」
  if (tokenCore.length < 3) return null;
  const candidates = index.filter((entry) => {
    const cores = [entry.core, ...entry.aliasCores];
    return cores.some(
      (core) => core.length >= 3 && (core.startsWith(tokenCore) || tokenCore.startsWith(core))
    );
  });
  if (candidates.length === 0) return null;

  // 複数候補がある場合はコアが最も近い（短い）学校を選ぶ
  candidates.sort((a, b) => a.core.length - b.core.length);
  return candidates[0];
}

/**
 * 会話テキストから学校DBの正式校名を解決する。
 * primaryText（最新発話）で見つかった学校を優先して返す。
 */
export async function resolveSchoolNamesInText(
  primaryText: string,
  secondaryText?: string
): Promise<SchoolNameResolution> {
  const resolved: string[] = [];
  const unresolved: string[] = [];

  let index: SchoolNameIndexEntry[];
  try {
    index = await loadSchoolNameIndex();
  } catch (error) {
    console.error('[school-name-resolver] 学校名インデックスの取得に失敗:', error);
    return { resolved, unresolved };
  }

  const texts = [primaryText, secondaryText ?? ''].filter(Boolean);
  for (const text of texts) {
    // 「◯◯高校」「◯◯学院」などの表記から解決
    for (const token of extractSchoolNameTokens(text)) {
      const match = matchTokenToSchool(token, index);
      if (match) {
        if (!resolved.includes(match.name)) resolved.push(match.name);
      } else if (token.length >= 4 && !isLikelySentenceFragment(token) && !unresolved.includes(token)) {
        unresolved.push(token);
      }
    }

    // 接尾語なしの校名（「さくら国際は？」など）をコアの包含で解決
    const textNorm = normalizeSchoolText(text);
    for (const entry of index) {
      if (resolved.includes(entry.name)) continue;
      const cores = [entry.core, ...entry.aliasCores].filter((core) => core.length >= 4);
      if (cores.some((core) => textNorm.includes(core))) {
        resolved.push(entry.name);
      }
    }
  }

  return {
    resolved: resolved.slice(0, 4),
    unresolved: unresolved.slice(0, 2),
  };
}
