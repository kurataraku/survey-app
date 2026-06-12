export type SchoolInstitutionType = 'public' | 'private' | 'support';

export type SchoolCampusLocation = {
  prefecture: string;
  city: string;
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





