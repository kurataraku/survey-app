import type { SupabaseClient } from '@supabase/supabase-js';
import { prefectures as ALL_PREFECTURES } from '@/lib/prefectures';

export type AdmissionScope = 'nationwide' | 'prefectures' | 'unknown';

export type AdmissionSourceUrl = { url: string; note?: string };

export type SchoolAdmissionProfile = {
  school_id: string;
  admission_scope: AdmissionScope;
  admission_prefectures: string[];
  schooling_prefectures: string[];
  schooling_note: string | null;
  source_urls: AdmissionSourceUrl[];
  verified_at: string | null;
  target_year: number | null;
  internal_memo: string | null;
  status: 'draft' | 'published';
  updated_at?: string | null;
};

/** 公開側に渡す値（出典・内部メモは含めない） */
export type PublicAdmissionProfile = {
  admissionScope: AdmissionScope;
  admissionPrefectures: string[];
  schoolingPrefectures: string[];
  schoolingNote: string | null;
  verifiedAt: string;
};

/** 確認日からこの月数を過ぎたら再確認対象に戻し、公開側では未確認として扱う */
export const ADMISSION_REVERIFY_MONTHS = 12;

const TABLE = 'school_admission_profiles';

/** マイグレーション未適用（テーブルなし）のエラーか */
export function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /Could not find the table|does not exist/i.test(error.message ?? '')
  );
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

/**
 * 再確認が必要か。確認日がない・12か月を過ぎた・対象年度が現在の年度より前のものは要再確認。
 * 年度は4月始まりで判定する。
 */
export function needsReverification(
  profile: Pick<SchoolAdmissionProfile, 'verified_at' | 'target_year'>,
  now: Date = new Date()
): boolean {
  if (!profile.verified_at) return true;
  const verified = new Date(`${profile.verified_at}T00:00:00Z`);
  if (Number.isNaN(verified.getTime())) return true;
  if (addMonths(verified, ADMISSION_REVERIFY_MONTHS) < now) return true;
  if (profile.target_year != null) {
    const month = now.getUTCMonth() + 1;
    const currentSchoolYear = month >= 4 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    if (profile.target_year < currentSchoolYear) return true;
  }
  return false;
}

export function toPublicAdmissionProfile(
  profile: SchoolAdmissionProfile,
  now: Date = new Date()
): PublicAdmissionProfile | null {
  if (profile.status !== 'published' || !profile.verified_at) return null;
  if (needsReverification(profile, now)) return null;
  return {
    admissionScope: profile.admission_scope,
    admissionPrefectures: profile.admission_prefectures ?? [],
    schoolingPrefectures: profile.schooling_prefectures ?? [],
    schoolingNote: profile.schooling_note,
    verifiedAt: profile.verified_at,
  };
}

/** テーブル未作成を検知したら、ビルド中の全ページから同じ失敗クエリを投げ続けないよう一定時間問い合わせない */
const MISSING_TABLE_RETRY_MS = 10 * 60 * 1000;
let missingTableDetectedAt: number | null = null;

/**
 * 公開中かつ再確認期限内の入学条件を学校IDごとに返す。
 * テーブル未作成・取得失敗時は空のMapを返し、LPは「未確認」として描画する。
 */
export async function fetchPublicAdmissionProfiles(
  supabase: SupabaseClient,
  schoolIds: string[]
): Promise<Map<string, PublicAdmissionProfile>> {
  const result = new Map<string, PublicAdmissionProfile>();
  if (schoolIds.length === 0) return result;
  if (missingTableDetectedAt !== null && Date.now() - missingTableDetectedAt < MISSING_TABLE_RETRY_MS) {
    return result;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select(
      'school_id, admission_scope, admission_prefectures, schooling_prefectures, schooling_note, verified_at, target_year, status'
    )
    .in('school_id', schoolIds)
    .eq('status', 'published');

  if (error) {
    if (isMissingTableError(error)) {
      missingTableDetectedAt = Date.now();
    } else {
      console.error('[admissionProfiles] 取得エラー:', error.message);
    }
    return result;
  }
  missingTableDetectedAt = null;

  const now = new Date();
  for (const row of (data ?? []) as SchoolAdmissionProfile[]) {
    const publicProfile = toPublicAdmissionProfile(row, now);
    if (publicProfile) result.set(row.school_id, publicProfile);
  }
  return result;
}

const PREFECTURE_SET = new Set<string>(ALL_PREFECTURES);

function sanitizePrefectureList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => PREFECTURE_SET.has(item))
    ),
  ];
}

function sanitizeSourceUrls(value: unknown): AdmissionSourceUrl[] {
  if (!Array.isArray(value)) return [];
  const urls: AdmissionSourceUrl[] = [];
  for (const item of value) {
    const record = (item && typeof item === 'object' ? item : { url: item }) as Record<
      string,
      unknown
    >;
    const url = typeof record.url === 'string' ? record.url.trim() : '';
    if (!/^https?:\/\//.test(url)) continue;
    const note = typeof record.note === 'string' ? record.note.trim() : '';
    urls.push(note ? { url, note } : { url });
  }
  return urls.slice(0, 10);
}

function sanitizeText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export type AdmissionProfileInput = Omit<SchoolAdmissionProfile, 'school_id' | 'status' | 'updated_at'>;

/** 管理画面からの入力を正規化する。不正値は捨て、募集区域の矛盾は unknown に倒す */
export function sanitizeAdmissionProfileInput(body: Record<string, unknown>): AdmissionProfileInput {
  const scopeRaw = body.admission_scope;
  let admission_scope: AdmissionScope =
    scopeRaw === 'nationwide' || scopeRaw === 'prefectures' ? scopeRaw : 'unknown';
  const admission_prefectures =
    admission_scope === 'prefectures' ? sanitizePrefectureList(body.admission_prefectures) : [];
  if (admission_scope === 'prefectures' && admission_prefectures.length === 0) {
    admission_scope = 'unknown';
  }

  const verifiedRaw = typeof body.verified_at === 'string' ? body.verified_at.trim() : '';
  const verified_at = /^\d{4}-\d{2}-\d{2}$/.test(verifiedRaw) ? verifiedRaw : null;

  const yearRaw = Number(body.target_year);
  const target_year =
    Number.isInteger(yearRaw) && yearRaw >= 2020 && yearRaw <= 2100 ? yearRaw : null;

  return {
    admission_scope,
    admission_prefectures,
    schooling_prefectures: sanitizePrefectureList(body.schooling_prefectures),
    schooling_note: sanitizeText(body.schooling_note, 300),
    source_urls: sanitizeSourceUrls(body.source_urls),
    verified_at,
    target_year,
    internal_memo: sanitizeText(body.internal_memo, 1000),
  };
}

/** 公開可能か（確認日と出典が揃っているか）。DBのCHECK制約と同じ条件 */
export function canPublishAdmissionProfile(input: AdmissionProfileInput): string | null {
  if (!input.verified_at) return '確認日を入力してください';
  if (input.source_urls.length === 0) return '出典URL（公式サイト・公式PDF・教育委員会ページ）を1件以上入力してください';
  if (input.admission_scope === 'unknown' && input.schooling_prefectures.length === 0) {
    return '募集区域かスクーリング会場のどちらかを確認してから公開してください';
  }
  return null;
}

export type AdmissionBadge = { label: string; tone: 'info' | 'caution' };

/** 地域LP・都市LPの比較表に出す確認済みバッジ */
export function buildAdmissionBadges(
  profile: PublicAdmissionProfile | null | undefined,
  prefecture: string
): AdmissionBadge[] {
  if (!profile) return [];
  const badges: AdmissionBadge[] = [];
  if (profile.admissionScope === 'nationwide') {
    badges.push({ label: '全国から出願可', tone: 'info' });
  } else if (profile.admissionScope === 'prefectures') {
    badges.push(
      profile.admissionPrefectures.includes(prefecture)
        ? { label: `${prefecture}在住・在勤者が対象`, tone: 'info' }
        : { label: `${prefecture}からは出願不可`, tone: 'caution' }
    );
  }
  if (profile.schoolingPrefectures.length > 0) {
    badges.push(
      profile.schoolingPrefectures.includes(prefecture)
        ? { label: `スクーリング会場が${prefecture}内`, tone: 'info' }
        : {
            label: `スクーリングは${profile.schoolingPrefectures.slice(0, 2).join('・')}`,
            tone: 'caution',
          }
    );
  }
  return badges;
}

export async function getAdmissionProfileForAdmin(
  supabase: SupabaseClient,
  schoolId: string
): Promise<{ profile: SchoolAdmissionProfile | null; tableMissing: boolean }> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('school_id', schoolId).maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return { profile: null, tableMissing: true };
    throw error;
  }
  return { profile: (data as SchoolAdmissionProfile | null) ?? null, tableMissing: false };
}

export async function upsertAdmissionProfile(
  supabase: SupabaseClient,
  schoolId: string,
  input: AdmissionProfileInput,
  status: 'draft' | 'published',
  updatedBy: string | null
): Promise<{ profile: SchoolAdmissionProfile | null; tableMissing: boolean }> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      { school_id: schoolId, ...input, status, updated_by: updatedBy },
      { onConflict: 'school_id' }
    )
    .select()
    .single();
  if (error) {
    if (isMissingTableError(error)) return { profile: null, tableMissing: true };
    throw error;
  }
  return { profile: data as SchoolAdmissionProfile, tableMissing: false };
}
