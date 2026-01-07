-- survey_responsesテーブルの拡張
-- school_id、school_name_inputカラムを追加（後方互換）

-- 1. school_idカラムを追加（schoolsテーブルへの外部キー）
ALTER TABLE survey_responses 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- 2. school_name_inputカラムを追加（ユーザー入力原文、その他入力時）
ALTER TABLE survey_responses 
ADD COLUMN IF NOT EXISTS school_name_input TEXT;

-- 3. school_idのインデックスを作成
CREATE INDEX IF NOT EXISTS idx_survey_responses_school_id ON survey_responses(school_id);

-- 4. 既存データのschool_idを設定（既存のschool_nameからschoolsテーブルを検索して設定）
-- 注意: この処理は時間がかかる可能性があるため、別途移行スクリプトで実行することも可能
-- ここではコメントアウトしておく
/*
UPDATE survey_responses sr
SET school_id = s.id
FROM schools s
WHERE sr.school_name = s.name
  AND sr.school_id IS NULL;
*/

-- コメント
COMMENT ON COLUMN survey_responses.school_id IS '選択された学校のID（schoolsテーブルへの外部キー）';
COMMENT ON COLUMN survey_responses.school_name_input IS 'ユーザーが入力した原文（その他入力時のみ保存）';

