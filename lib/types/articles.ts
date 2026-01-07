export type ArticleCategory = 'interview' | 'useful_info';

export interface Article {
  id: string;
  title: string;
  slug: string;
  category: ArticleCategory;
  content: string | null;
  excerpt: string | null;
  featured_image_url: string | null;
  is_public: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  meta_title: string | null;
  meta_description: string | null;
  schools?: ArticleSchool[];
}

export interface ArticleSchool {
  id: string;
  article_id: string;
  school_id: string;
  display_order: number;
  note: string | null;
  school?: {
    id: string;
    name: string;
    prefecture: string;
    slug: string | null;
    review_count?: number;
    overall_avg?: number | null;
  };
}

export interface ArticleFormData {
  title: string;
  slug: string;
  category: ArticleCategory;
  content: string;
  excerpt: string;
  featured_image_url: string;
  is_public: boolean;
  published_at: string | null;
  meta_title: string;
  meta_description: string;
}











