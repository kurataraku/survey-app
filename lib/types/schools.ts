export interface School {
  id: string;
  name: string;
  prefecture: string;
  prefectures?: string[]; // 複数の都道府県に対応
  slug: string | null;
  intro: string | null;
  highlights: string[] | null; // JSONB配列
  faq: Array<{ question: string; answer: string }> | null; // JSONB配列
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface SchoolFormData {
  name: string;
  prefecture: string;
  prefectures?: string[]; // 複数の都道府県に対応
  slug: string;
  intro: string;
  highlights: string[];
  faq: Array<{ question: string; answer: string }>;
  is_public: boolean;
}





