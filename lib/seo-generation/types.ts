export type DraftType = 'knowledge' | 'school';

export type DraftStatus =
  | 'generating'
  | 'draft'
  | 'needs_review'
  | 'revised'
  | 'approved'
  | 'failed';

export type EvidenceKind = 'review' | 'web' | 'article' | 'school_info';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type GenerationStep =
  | 'plan'
  | 'research'
  | 'research-web'
  | 'write'
  | 'verify'
  | 'rewrite'
  | 'generate-image';

export interface OutlineSection {
  heading: string;
  level: 2 | 3;
  keyPoints: string[];
  isFaq?: boolean;
  dataSourceHint?: string;
}

export interface SeoMeta {
  metaTitle: string;
  metaDescription: string;
  excerpt?: string;
  focusKeyword: string;
  secondaryKeywords: string[];
}

export interface QualityScore {
  overall: number;
  factAccuracy: number;
  seoOptimization: number;
  readability: number;
  selfDataRatio: number;
  issues: QualityIssue[];
}

export interface QualityIssue {
  severity: 'error' | 'warning' | 'info';
  message: string;
  section?: string;
}

export interface TokenUsage {
  openai: number;
  perplexity: number;
  anthropic: number;
}

export interface SeoDraft {
  id: string;
  draft_type: DraftType;
  keyword: string;
  school_id: string | null;
  intent: string | null;
  audience: string | null;
  title: string | null;
  outline_json: OutlineSection[] | null;
  body_md: string | null;
  seo_meta: SeoMeta | null;
  quality_score: QualityScore | null;
  status: DraftStatus;
  current_step: GenerationStep | null;
  error_message: string | null;
  featured_image_url: string | null;
  tokens_used: TokenUsage;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  school?: { id: string; name: string; slug: string | null } | null;
}

export interface SeoDraftEvidence {
  id: string;
  draft_id: string;
  kind: EvidenceKind;
  source_id: string | null;
  url: string | null;
  title: string | null;
  excerpt: string | null;
  summary: string;
  section_ref: string | null;
  confidence: ConfidenceLevel;
  retrieved_at: string;
}

export interface SeoDraftWithEvidence extends SeoDraft {
  evidence: SeoDraftEvidence[];
}

export interface CreateDraftInput {
  keyword: string;
  draft_type: DraftType;
  school_id?: string;
}

export interface UpdateDraftInput {
  title?: string;
  body_md?: string;
  seo_meta?: SeoMeta;
  status?: DraftStatus;
  featured_image_url?: string | null;
}

export interface GenerationConfig {
  webResearch: boolean;
  maxReviews: number;
}
