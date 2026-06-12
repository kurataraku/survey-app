// コース一覧の入力値サニタイズ（管理画面PUT・AI抽出保存の共通処理）

import type {
  CourseItem,
  CourseListingInput,
  CourseSourceType,
  CourseSourceUrl,
} from '@/lib/types/courses';

const SOURCE_TYPES: CourseSourceType[] = [
  'official_site',
  'official_pdf',
  'external_media',
  'unverified',
];

function sanitizeText(value: unknown, maxLength = 2000): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function sanitizeDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function sanitizeCourses(value: unknown): CourseItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter((c): c is Record<string, unknown> => Boolean(c) && typeof c === 'object')
    .slice(0, 30)
    .map((c): CourseItem | null => {
      const name = sanitizeText(c.name, 200);
      if (!name) return null;
      const key = name.replace(/\s+/g, '');
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        name,
        attendance: sanitizeText(c.attendance, 200),
        note: sanitizeText(c.note, 500),
      };
    })
    .filter((c): c is CourseItem => c !== null);
}

export function sanitizeCourseSourceUrls(value: unknown): CourseSourceUrl[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === 'object')
    .slice(0, 10)
    .map((s): CourseSourceUrl | null => {
      const url = sanitizeText(s.url, 2000);
      if (!url || !/^https?:\/\//i.test(url)) return null;
      return {
        url,
        kind: sanitizeText(s.kind, 100),
        note: sanitizeText(s.note, 500),
      };
    })
    .filter((s): s is CourseSourceUrl => s !== null);
}

/**
 * 管理画面・AI抽出からの入力を school_course_listings に保存できる形に正規化する。
 */
export function sanitizeCourseListingInput(body: Record<string, unknown>): CourseListingInput {
  return {
    courses: sanitizeCourses(body.courses),
    public_note: sanitizeText(body.public_note, 1000),
    source_type: SOURCE_TYPES.includes(body.source_type as CourseSourceType)
      ? (body.source_type as CourseSourceType)
      : 'unverified',
    source_urls: sanitizeCourseSourceUrls(body.source_urls),
    source_excerpt: sanitizeText(body.source_excerpt, 8000),
    verified_at: sanitizeDate(body.verified_at),
    internal_memo: sanitizeText(body.internal_memo, 4000),
  };
}
