-- 通信制高校リアルレビュー アンケート回答テーブル
-- 既存のテーブルとインデックスを削除（データも削除されます）
DROP TABLE IF EXISTS survey_responses CASCADE;

-- テーブルの作成
CREATE TABLE survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 基本情報
  school_name TEXT NOT NULL,
  respondent_role TEXT NOT NULL, -- '本人' or '保護者'
  status TEXT NOT NULL, -- '在籍中', '卒業した', '以前在籍していた（転校・退学など）'
  
  -- 卒業後の進路（status = '卒業した' の場合のみ）
  graduation_path TEXT,
  graduation_path_other TEXT,
  
  -- 評価・コメント
  overall_satisfaction INTEGER NOT NULL, -- 1-5
  good_comment TEXT NOT NULL,
  bad_comment TEXT NOT NULL,
  
  -- その他の回答（JSONB形式で格納）
  answers JSONB NOT NULL DEFAULT '{}',
  
  -- 連絡先（任意）
  email TEXT
);

-- インデックスの作成（検索・集計用）
CREATE INDEX idx_survey_responses_school_name ON survey_responses(school_name);
CREATE INDEX idx_survey_responses_status ON survey_responses(status);
CREATE INDEX idx_survey_responses_created_at ON survey_responses(created_at);
CREATE INDEX idx_survey_responses_overall_satisfaction ON survey_responses(overall_satisfaction);

-- JSONBカラムのインデックス（GINインデックス）
CREATE INDEX idx_survey_responses_answers ON survey_responses USING GIN (answers);

-- コメント: answers JSONBには以下のフィールドが格納されます
-- {
--   "reason_for_choosing": ["心の不調", "人間関係", ...],
--   "important_points": ["立地/アクセス", "先生職員", ...],
--   "enrollment_type": "新入学（中学卒業後）",
--   "enrollment_year": "2024",
--   "attendance_frequency": "週1〜2",
--   "teaching_style": ["校舎集団中心", "オンラインライブ中心", ...],
--   "student_atmosphere": ["まじめで授業/行事に積極的", ...],
--   "atmosphere_other": "その他の雰囲気の説明",
--   "flexibility_rating": "4",
--   "staff_rating": "5",
--   "support_rating": "4",
--   "atmosphere_fit_rating": "3",
--   "credit_rating": "4",
--   "unique_course_rating": "5",
--   "career_support_rating": "4",
--   "campus_life_rating": "6", -- 6は「評価できない」
--   "tuition_rating": "4"
-- }


