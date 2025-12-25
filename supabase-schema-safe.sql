-- 通信制高校リアルレビュー アンケート回答テーブル（安全版）
-- このファイルは既存のデータを保持したまま、カラムを追加・修正します
-- 既存のデータを削除しても問題ない場合は、supabase-schema.sql を使用してください

-- テーブルが存在しない場合のみ作成
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 基本情報
  school_name TEXT,
  respondent_role TEXT,
  status TEXT,
  
  -- 卒業後の進路（status = '卒業した' の場合のみ）
  graduation_path TEXT,
  graduation_path_other TEXT,
  
  -- 評価・コメント
  overall_satisfaction INTEGER,
  good_comment TEXT,
  bad_comment TEXT,
  
  -- その他の回答（JSONB形式で格納）
  answers JSONB DEFAULT '{}',
  
  -- 連絡先（任意）
  email TEXT
);

-- カラムが存在しない場合のみ追加
DO $$ 
BEGIN
  -- school_nameカラムの追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'survey_responses' AND column_name = 'school_name') THEN
    ALTER TABLE survey_responses ADD COLUMN school_name TEXT;
  END IF;
  
  -- respondent_roleカラムの追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'survey_responses' AND column_name = 'respondent_role') THEN
    ALTER TABLE survey_responses ADD COLUMN respondent_role TEXT;
  END IF;
  
  -- statusカラムの追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'survey_responses' AND column_name = 'status') THEN
    ALTER TABLE survey_responses ADD COLUMN status TEXT;
  END IF;
  
  -- graduation_pathカラムの追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'survey_responses' AND column_name = 'graduation_path') THEN
    ALTER TABLE survey_responses ADD COLUMN graduation_path TEXT;
  END IF;
  
  -- graduation_path_otherカラムの追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'survey_responses' AND column_name = 'graduation_path_other') THEN
    ALTER TABLE survey_responses ADD COLUMN graduation_path_other TEXT;
  END IF;
  
  -- overall_satisfactionカラムの追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'survey_responses' AND column_name = 'overall_satisfaction') THEN
    ALTER TABLE survey_responses ADD COLUMN overall_satisfaction INTEGER;
  END IF;
  
  -- good_commentカラムの追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'survey_responses' AND column_name = 'good_comment') THEN
    ALTER TABLE survey_responses ADD COLUMN good_comment TEXT;
  END IF;
  
  -- bad_commentカラムの追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'survey_responses' AND column_name = 'bad_comment') THEN
    ALTER TABLE survey_responses ADD COLUMN bad_comment TEXT;
  END IF;
  
  -- answersカラムの追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'survey_responses' AND column_name = 'answers') THEN
    ALTER TABLE survey_responses ADD COLUMN answers JSONB DEFAULT '{}';
  END IF;
  
  -- emailカラムの追加
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'survey_responses' AND column_name = 'email') THEN
    ALTER TABLE survey_responses ADD COLUMN email TEXT;
  END IF;
END $$;

-- インデックスの作成（既に存在する場合はスキップ）
CREATE INDEX IF NOT EXISTS idx_survey_responses_school_name ON survey_responses(school_name);
CREATE INDEX IF NOT EXISTS idx_survey_responses_status ON survey_responses(status);
CREATE INDEX IF NOT EXISTS idx_survey_responses_created_at ON survey_responses(created_at);
CREATE INDEX IF NOT EXISTS idx_survey_responses_overall_satisfaction ON survey_responses(overall_satisfaction);

-- JSONBカラムのインデックス（GINインデックス）
CREATE INDEX IF NOT EXISTS idx_survey_responses_answers ON survey_responses USING GIN (answers);

