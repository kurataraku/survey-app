export type RagSourceType =
  | 'review'
  | 'school'
  | 'school_summary'
  | 'article'
  | 'tuition'
  | 'course'
  | 'faq'
  | 'seo_section';

export type RagReasonGroup =
  | 'mental_relationship'
  | 'learning_style'
  | 'health_development';

export type RagDocumentUpsert = {
  source_type: RagSourceType;
  source_id: string;
  chunk_key: string;
  school_id: string | null;
  school_name: string | null;
  prefecture: string | null;
  reason_groups: RagReasonGroup[];
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  source_url: string | null;
  is_public: boolean;
  content_hash: string;
  embedding: string;
};

export type RagMatchRow = {
  id: string;
  source_type: RagSourceType;
  source_id: string;
  chunk_key: string;
  school_id: string | null;
  school_name: string | null;
  prefecture: string | null;
  reason_groups: RagReasonGroup[] | null;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  source_url: string | null;
  similarity: number;
  score: number;
};
