# Epic1 SQL実行用（クリーンなSQLのみ）

このファイルには、SupabaseのSQL Editorで実行するためのSQLのみが含まれています。
TypeScriptコードは一切含まれていません。

## 実行順序

以下の順番で実行してください：

1. `supabase-schema-epic1-schools.sql`
2. `supabase-schema-epic1-survey-responses-alter.sql`
3. `supabase-schema-epic1-aggregates.sql`
4. `supabase-schema-epic1-backfill.sql`

---

## 1. schoolsテーブルの作成

```sql
-- Epic1: schoolsテーブルの作成
-- 学校マスタテーブル

-- テーブルの作成
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  prefecture TEXT NOT NULL,
  slug TEXT UNIQUE,
  intro TEXT,
  highlights JSONB,
  faq JSONB,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_schools_name ON schools(name);
CREATE INDEX IF NOT EXISTS idx_schools_prefecture ON schools(prefecture);
CREATE INDEX IF NOT EXISTS idx_schools_slug ON schools(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schools_is_public ON schools(is_public);

-- updated_atを自動更新するトリガー関数（既に存在する場合は上書き）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- トリガーの作成（既に存在する場合は何もしない）
DROP TRIGGER IF EXISTS update_schools_updated_at ON schools;
CREATE TRIGGER update_schools_updated_at 
  BEFORE UPDATE ON schools 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- コメント
COMMENT ON TABLE schools IS '学校マスタテーブル';
COMMENT ON COLUMN schools.name IS '学校名（一意）';
COMMENT ON COLUMN schools.prefecture IS '都道府県';
COMMENT ON COLUMN schools.slug IS 'SEO用スラッグ（URLに使用）';
COMMENT ON COLUMN schools.intro IS '学校の紹介文（CMS編集可能）';
COMMENT ON COLUMN schools.highlights IS '特徴箇条書き、推しポイント（JSONB形式、CMS編集可能）';
COMMENT ON COLUMN schools.faq IS 'FAQ（JSONB形式、CMS編集可能）';
COMMENT ON COLUMN schools.is_public IS '公開フラグ';
```

---

## 2. survey_responsesテーブルの拡張

```sql
-- Epic1: survey_responsesテーブルの拡張
-- 検索/集計/並び替えに必要な項目をカラム化

-- survey_responsesに追加カラムを追加
ALTER TABLE survey_responses
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enrollment_year INTEGER,
  ADD COLUMN IF NOT EXISTS attendance_frequency TEXT,
  ADD COLUMN IF NOT EXISTS reason_for_choosing TEXT[],
  ADD COLUMN IF NOT EXISTS staff_rating INTEGER,
  ADD COLUMN IF NOT EXISTS atmosphere_fit_rating INTEGER,
  ADD COLUMN IF NOT EXISTS credit_rating INTEGER,
  ADD COLUMN IF NOT EXISTS tuition_rating INTEGER,
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
```

---

## 3. aggregatesテーブルの作成

```sql
-- Epic1: aggregatesテーブルの作成
-- 学校別集計キャッシュ（検索カード高速化用）

-- aggregatesテーブルの作成（学校別集計キャッシュ）
CREATE TABLE IF NOT EXISTS aggregates (
  school_id UUID PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  review_count INTEGER NOT NULL DEFAULT 0,
  overall_avg NUMERIC(3, 2),
  staff_rating_avg NUMERIC(3, 2),
  atmosphere_fit_rating_avg NUMERIC(3, 2),
  credit_rating_avg NUMERIC(3, 2),
  tuition_rating_avg NUMERIC(3, 2),
  top_good_review_id UUID REFERENCES survey_responses(id) ON DELETE SET NULL,
  top_bad_review_id UUID REFERENCES survey_responses(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_aggregates_updated_at ON aggregates(updated_at);

-- updated_atを自動更新するトリガー
DROP TRIGGER IF EXISTS update_aggregates_updated_at ON aggregates;
CREATE TRIGGER update_aggregates_updated_at 
  BEFORE UPDATE ON aggregates 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- コメント
COMMENT ON TABLE aggregates IS '学校別集計キャッシュテーブル（検索カード高速化用）';
COMMENT ON COLUMN aggregates.school_id IS '学校ID（プライマリキー、schoolsテーブルへの外部キー）';
COMMENT ON COLUMN aggregates.review_count IS '口コミ数';
COMMENT ON COLUMN aggregates.overall_avg IS '総合満足度の平均';
COMMENT ON COLUMN aggregates.staff_rating_avg IS '先生・職員の対応評価の平均';
COMMENT ON COLUMN aggregates.atmosphere_fit_rating_avg IS '在校生の雰囲気が自分に合っていたか評価の平均';
COMMENT ON COLUMN aggregates.credit_rating_avg IS '単位取得のしやすさ評価の平均';
COMMENT ON COLUMN aggregates.tuition_rating_avg IS '学費の納得感評価の平均';
COMMENT ON COLUMN aggregates.top_good_review_id IS '代表の良い口コミID（いいね数が最も多いもの）';
COMMENT ON COLUMN aggregates.top_bad_review_id IS '代表の悪い口コミID（いいね数が最も多いもの）';
COMMENT ON COLUMN aggregates.updated_at IS '最終更新日時';
```

---

## 4. 既存データの移行（Backfill）

```sql
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
```

---

## 実行時の注意事項

1. **SQL Editorをクリアしてから貼り付け**
   - 新しいクエリを作成するか、既存のクエリを全選択（Ctrl+A）して削除してから貼り付けてください

2. **TypeScriptコードは含めない**
   - `import`や`export`で始まる行は含めないでください
   - SQLコマンド（`CREATE`, `ALTER`, `INSERT`, `UPDATE`など）のみを貼り付けてください

3. **実行順序を守る**
   - 上記の順番（1 → 2 → 3 → 4）で実行してください
   - 前のSQLが成功してから次のSQLを実行してください

4. **エラーが発生した場合**
   - エラーメッセージを確認してください
   - テーブルが既に存在する場合は、一部のコマンドがスキップされる場合があります（`IF NOT EXISTS`により）





