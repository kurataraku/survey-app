export type SchoolInstitutionType = 'public' | 'private' | 'support';

/**
 * 拠点の種類。未設定の既存データは「通学できる拠点」として扱う（後方互換）。
 * exam_venue / event_only は地域LPの拠点数・所在地集計に含めない。
 */
export type CampusLocationType =
  | 'headquarters'
  | 'commute_campus'
  | 'required_schooling_venue'
  | 'support_campus'
  | 'exam_venue'
  | 'event_only';

export type SchoolCampusLocation = {
  prefecture: string;
  city: string;
  /** 番地まで含む所在地（公立校など一部のみ） */
  address?: string;
  location_type?: CampusLocationType;
  /** 最寄り駅（最大2件。例: ["JR山手線 新宿駅", "丸の内線 新宿三丁目駅"]） */
  nearest_stations?: string[];
  /** @deprecated nearest_stations を使用。旧データ読み込み用 */
  nearest_station?: string;
};

export interface School {
  id: string;
  name: string;
  prefecture: string;
  prefectures?: string[]; // 複数の都道府県に対応
  institution_type: SchoolInstitutionType | null;
  campus_locations?: SchoolCampusLocation[] | null;
  slug: string | null;
  intro: string | null;
  highlights: string[] | null; // JSONB配列
  faq: Array<{ question: string; answer: string }> | null; // JSONB配列
  official_url?: string | null; // 公式サイトURL（学費AI抽出の起点。管理用）
  official_url_verified?: boolean; // 公式URLを人間が確認済みか（false=AI推定など未確認）
  official_url_source?: string | null; // 公式URLの取得元: manual / ai
  is_public: boolean;
  status?: string; // 'active' | 'pending' | 'merged'
  created_at: string;
  updated_at: string;
}

export interface SchoolFormData {
  name: string;
  prefecture: string;
  prefectures?: string[]; // 複数の都道府県に対応
  institution_type: SchoolInstitutionType | '';
  campus_locations: SchoolCampusLocation[];
  slug: string;
  intro: string;
  highlights: string[];
  faq: Array<{ question: string; answer: string }>;
  official_url?: string;
  is_public: boolean;
}





