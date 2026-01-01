export interface Review {
  id: string;
  school_id: string | null;
  school_name: string;
  respondent_role: string;
  status: string;
  overall_satisfaction: number;
  good_comment: string;
  bad_comment: string;
  is_public: boolean;
  created_at: string;
}

export interface ReviewListResponse {
  reviews: Review[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}



