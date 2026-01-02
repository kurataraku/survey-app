-- Epic1: survey_responsesテーブルの拡張
-- 検索/集計/並び替えに必要な項目をカラム化

-- survey_responsesに追加カラムを追加
ALTER TABLE survey_responses
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enrollment_year INTEGER, -- answersから抽出
  ADD COLUMN IF NOT EXISTS attendance_frequency TEXT, -- answersから抽出
  ADD COLUMN IF NOT EXISTS reason_for_choosing TEXT[], -- answersから抽出（複数選択）
  ADD COLUMN IF NOT EXISTS staff_rating INTEGER, -- answersから抽出（1-5）
  ADD COLUMN IF NOT EXISTS atmosphere_fit_rating INTEGER, -- answersから抽出（1-5）
  ADD COLUMN IF NOT EXISTS credit_rating INTEGER, -- answersから抽出（1-5）
  ADD COLUMN IF NOT EXISTS tuition_rating INTEGER, -- answersから抽出（1-5）
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_survey_responses_school_id ON survey_responses(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_responses_enrollment_year ON survey_responses(enrollment_year) WHERE enrollment_year IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_responses_attendance_frequency ON survey_responses(attendance_frequency) WHERE attendance_frequency IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_survey_responses_is_public ON survey_responses(is_public);
CREATE INDEX IF NOT EXISTS idx_survey_responses_reason_for_choosing ON survey_responses USING GIN (reason_for_choosing) WHERE reason_for_choosing IS NOT NULL;

-- コメント
COMMENT ON COLUMN survey_responses.school_id IS '学校ID（schoolsテーブルへの外部キー）';
COMMENT ON COLUMN survey_responses.enrollment_year IS '入学年（検索・集計用）';
COMMENT ON COLUMN survey_responses.attendance_frequency IS '主な通学頻度（検索・集計用）';
COMMENT ON COLUMN survey_responses.reason_for_choosing IS '通信制を選んだ理由（検索・集計用、複数選択）';
COMMENT ON COLUMN survey_responses.staff_rating IS '先生・職員の対応評価（検索・集計用、1-5）';
COMMENT ON COLUMN survey_responses.atmosphere_fit_rating IS '在校生の雰囲気が自分に合っていたか評価（検索・集計用、1-5）';
COMMENT ON COLUMN survey_responses.credit_rating IS '単位取得のしやすさ評価（検索・集計用、1-5）';
COMMENT ON COLUMN survey_responses.tuition_rating IS '学費の納得感評価（検索・集計用、1-5）';
COMMENT ON COLUMN survey_responses.is_public IS '公開フラグ';

-- 注意: 既存のschool_nameカラムは移行期間中は残します（後方互換性のため）









