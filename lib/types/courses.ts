// コース一覧（公式サイト引用）の型定義
// school_course_listings テーブルに対応

/** 情報源の種別（内部管理用） */
export type CourseSourceType =
  | 'official_site'
  | 'official_pdf'
  | 'external_media'
  | 'unverified';

/** 運用状態 */
export type CourseStatus = 'draft' | 'published' | 'rejected';

/** データの作成元 */
export type CourseOrigin = 'ai' | 'manual';

/** コース1件（courses JSONB の要素） */
export interface CourseItem {
  /** コース名（公式サイトの名称をそのまま転記） */
  name: string;
  /** 通学頻度（例: 週5日 / オンライン。本文に明記がある場合のみ） */
  attendance?: string | null;
  /** 補足（本文に明記がある場合のみ） */
  note?: string | null;
}

/** 出典URL（source_urls JSONB の要素。内部管理用） */
export interface CourseSourceUrl {
  url: string;
  /** 例: course_page / admission_pdf / official_top */
  kind?: string | null;
  note?: string | null;
}

/** 公開表示用のコース一覧（内部管理フィールドを含まない） */
export interface PublicCourseListing {
  school_id: string;
  courses: CourseItem[];
  public_note: string | null;
}

/** 管理画面・API用の完全なコース一覧レコード */
export interface CourseListing extends PublicCourseListing {
  id: string;
  source_type: CourseSourceType;
  source_urls: CourseSourceUrl[];
  source_excerpt: string | null;
  verified_at: string | null; // DATE (YYYY-MM-DD)
  internal_memo: string | null;
  origin: CourseOrigin;
  status: CourseStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 管理画面フォーム・draft upsert 用の入力型 */
export interface CourseListingInput {
  courses: CourseItem[];
  public_note: string | null;
  source_type: CourseSourceType;
  source_urls: CourseSourceUrl[];
  source_excerpt: string | null;
  verified_at: string | null;
  internal_memo: string | null;
}

/** 公開表示で select するカラム（内部管理フィールドを含めない） */
export const PUBLIC_COURSE_SELECT = 'school_id, courses, public_note';
