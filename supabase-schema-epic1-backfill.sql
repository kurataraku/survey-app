-- Epic1: 既存データの移行（Backfill）
-- survey_responsesからschoolsテーブルを生成し、school_idを設定
-- answers JSONBから検索用カラムにデータをコピー

-- ============================================================================
-- Step 1: survey_responsesから重複を除いたschool_nameリストを取得してschoolsテーブルに挿入
-- ============================================================================
INSERT INTO schools (name, prefecture, slug, is_public)
SELECT DISTINCT
  sr.school_name AS name,
  COALESCE(
    sr.answers->>'campus_prefecture', 
    '不明'
  ) AS prefecture,
  LOWER(REGEXP_REPLACE(
    REGEXP_REPLACE(sr.school_name, '[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]', '-', 'g'),
    '-+', '-', 'g'
  )) AS slug,
  true AS is_public
FROM survey_responses sr
WHERE sr.school_name IS NOT NULL 
  AND sr.school_name != ''
  AND NOT EXISTS (
    SELECT 1 FROM schools s WHERE s.name = sr.school_name
  )
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Step 2: 重複候補のリストを作成（手動確認用）
-- このクエリの結果を確認して、必要に応じて手動でマージしてください
-- ============================================================================
-- 重複候補を一時テーブルに格納
DROP TABLE IF EXISTS duplicate_school_candidates;
CREATE TEMP TABLE duplicate_school_candidates AS
SELECT 
  s1.id AS id1,
  s1.name AS name1,
  s1.prefecture AS prefecture1,
  s2.id AS id2,
  s2.name AS name2,
  s2.prefecture AS prefecture2
FROM schools s1
JOIN schools s2 ON s1.id < s2.id
WHERE 
  -- 全角/半角、大文字/小文字、スペースを正規化して比較
  UPPER(REGEXP_REPLACE(s1.name, '[[:space:]]', '', 'g')) = 
  UPPER(REGEXP_REPLACE(s2.name, '[[:space:]]', '', 'g'))
  OR
  -- 読みが同じ可能性（簡易版：ひらがな/カタカナを統一）
  REGEXP_REPLACE(
    TRANSLATE(s1.name, 
      'カキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン', 
      'かきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'
    ), 
    '[^a-zA-Z0-9\u3040-\u309F\u4E00-\u9FAF]', '', 'g'
  ) = 
  REGEXP_REPLACE(
    TRANSLATE(s2.name, 
      'カキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン', 
      'かきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'
    ), 
    '[^a-zA-Z0-9\u3040-\u309F\u4E00-\u9FAF]', '', 'g'
  );

-- 重複候補を確認（この結果を確認して手動でマージしてください）
SELECT * FROM duplicate_school_candidates ORDER BY name1;

-- ============================================================================
-- Step 3: survey_responses.school_idを更新（school_nameからschools.idを取得）
-- ============================================================================
UPDATE survey_responses sr
SET school_id = s.id
FROM schools s
WHERE sr.school_name = s.name
  AND sr.school_id IS NULL;

-- ============================================================================
-- Step 4: answers JSONBから検索用カラムにデータをコピー
-- ============================================================================
UPDATE survey_responses
SET 
  -- enrollment_year: 4桁の年のみを抽出
  enrollment_year = CASE 
    WHEN answers->>'enrollment_year' ~ '^\d{4}$' 
    THEN (answers->>'enrollment_year')::INTEGER 
    ELSE NULL 
  END,
  -- attendance_frequency: 文字列のまま
  attendance_frequency = answers->>'attendance_frequency',
  -- reason_for_choosing: 配列に変換
  reason_for_choosing = ARRAY(
    SELECT jsonb_array_elements_text(answers->'reason_for_choosing')
    WHERE answers->'reason_for_choosing' IS NOT NULL
  ),
  -- staff_rating: 1-5の数値のみ
  staff_rating = CASE 
    WHEN answers->>'staff_rating' ~ '^[1-5]$' 
    THEN (answers->>'staff_rating')::INTEGER 
    ELSE NULL 
  END,
  -- atmosphere_fit_rating: 1-5の数値のみ
  atmosphere_fit_rating = CASE 
    WHEN answers->>'atmosphere_fit_rating' ~ '^[1-5]$' 
    THEN (answers->>'atmosphere_fit_rating')::INTEGER 
    ELSE NULL 
  END,
  -- credit_rating: 1-5の数値のみ
  credit_rating = CASE 
    WHEN answers->>'credit_rating' ~ '^[1-5]$' 
    THEN (answers->>'credit_rating')::INTEGER 
    ELSE NULL 
  END,
  -- tuition_rating: 1-6の数値のみ（6は「評価できない」）
  tuition_rating = CASE 
    WHEN answers->>'tuition_rating' ~ '^[1-6]$' 
    THEN (answers->>'tuition_rating')::INTEGER 
    ELSE NULL 
  END
WHERE answers IS NOT NULL AND answers != '{}'::jsonb;

-- ============================================================================
-- 確認クエリ（実行後の確認用）
-- ============================================================================

-- 1. schoolsテーブルの学校数を確認
SELECT COUNT(*) AS school_count FROM schools;

-- 2. school_idが設定されている口コミ数を確認
SELECT COUNT(*) AS review_count_with_school_id 
FROM survey_responses 
WHERE school_id IS NOT NULL;

-- 3. 検索用カラムが設定されている口コミ数を確認
SELECT 
  COUNT(*) AS total_reviews,
  COUNT(enrollment_year) AS enrollment_year_count,
  COUNT(attendance_frequency) AS attendance_frequency_count,
  COUNT(reason_for_choosing) AS reason_for_choosing_count,
  COUNT(staff_rating) AS staff_rating_count,
  COUNT(atmosphere_fit_rating) AS atmosphere_fit_rating_count,
  COUNT(credit_rating) AS credit_rating_count,
  COUNT(tuition_rating) AS tuition_rating_count
FROM survey_responses;

















