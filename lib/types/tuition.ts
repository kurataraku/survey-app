// 学費目安（参考目安）の型定義
// school_tuition_estimates テーブルに対応

/** 表示モード: amounts=金額表示 / varies=コースにより変動 / contact_required=個別確認が必要 */
export type TuitionDisplayMode = 'amounts' | 'varies' | 'contact_required';

/** 情報源の種別（内部管理用。ユーザー画面には表示しない） */
export type TuitionSourceType =
  | 'official_site'
  | 'official_pdf'
  | 'external_media'
  | 'unverified';

/** 運用状態 */
export type TuitionStatus = 'draft' | 'published' | 'rejected';

/** データの作成元 */
export type TuitionOrigin = 'ai' | 'manual';

/** 就学支援金の適用区分 */
export type TuitionSupportFund = 'before' | 'after' | 'unknown';

/** コース別・通学頻度別の費用パターン（plans JSONB の要素） */
export interface TuitionPlan {
  /** 表示ラベル（例: 「週5日コース（就学支援金適用前）」） */
  label?: string | null;
  course_name?: string | null;
  /** 通学頻度（例: 「週1日」「年数回スクーリング」） */
  attendance?: string | null;
  first_year_min?: number | null;
  first_year_max?: number | null;
  annual_min?: number | null;
  annual_max?: number | null;
  monthly_min?: number | null;
  monthly_max?: number | null;
  /** 就学支援金: before=適用前 / after=適用後 / unknown=不明 */
  support_fund?: TuitionSupportFund | null;
  note?: string | null;
}

/** 任意の費目内訳（breakdown JSONB の要素） */
export interface TuitionBreakdownItem {
  /** 費目名（例: 入学金・授業料・施設費・教材費・スクーリング費・サポート費） */
  item: string;
  amount_min?: number | null;
  amount_max?: number | null;
  note?: string | null;
}

/** 出典URL（source_urls JSONB の要素。内部管理用） */
export interface TuitionSourceUrl {
  url: string;
  /** 例: tuition_page / admission_pdf / official_top / external_media */
  kind?: string | null;
  note?: string | null;
}

/** 公開表示用の学費目安（内部管理フィールドを含まない） */
export interface PublicTuitionEstimate {
  school_id: string;
  display_mode: TuitionDisplayMode;
  first_year_min: number | null;
  first_year_max: number | null;
  annual_min: number | null;
  annual_max: number | null;
  monthly_min: number | null;
  monthly_max: number | null;
  plans: TuitionPlan[];
  support_fund_note: string | null;
  public_note: string | null;
}

/** 管理画面・API用の完全な学費目安レコード */
export interface TuitionEstimate extends PublicTuitionEstimate {
  id: string;
  breakdown: TuitionBreakdownItem[] | null;
  source_type: TuitionSourceType;
  source_urls: TuitionSourceUrl[];
  source_excerpt: string | null;
  verified_at: string | null; // DATE (YYYY-MM-DD)
  internal_memo: string | null;
  origin: TuitionOrigin;
  status: TuitionStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** 管理画面フォーム・draft upsert 用の入力型 */
export interface TuitionEstimateInput {
  display_mode: TuitionDisplayMode;
  first_year_min: number | null;
  first_year_max: number | null;
  annual_min: number | null;
  annual_max: number | null;
  monthly_min: number | null;
  monthly_max: number | null;
  plans: TuitionPlan[];
  breakdown: TuitionBreakdownItem[] | null;
  support_fund_note: string | null;
  public_note: string | null;
  source_type: TuitionSourceType;
  source_urls: TuitionSourceUrl[];
  source_excerpt: string | null;
  verified_at: string | null;
  internal_memo: string | null;
}

/** 公開表示で select するカラム（内部管理フィールドを含めない） */
export const PUBLIC_TUITION_SELECT =
  'school_id, display_mode, first_year_min, first_year_max, annual_min, annual_max, monthly_min, monthly_max, plans, support_fund_note, public_note';
