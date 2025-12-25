# CSVエクスポートガイド

アンケート回答データをCSV形式でダウンロードする方法を説明します。

## 方法1: Supabaseダッシュボードから直接エクスポート（最も簡単）

### ステップ1: Table Editorでエクスポート

1. Supabaseダッシュボードで「**Table Editor**」を開く
2. `survey_responses` テーブルを選択
3. テーブルの右上にある「**...**」（三点リーダー）メニューをクリック
4. 「**Export as CSV**」または「**Download CSV**」を選択
5. CSVファイルがダウンロードされます

### ステップ2: SQL Editorでエクスポート

1. Supabaseダッシュボードで「**SQL Editor**」を開く
2. 「**New query**」をクリック
3. 以下のSQLを実行：

```sql
SELECT * FROM survey_responses ORDER BY created_at DESC;
```

4. 結果の右上にある「**Download**」ボタンまたは「**Export**」ボタンをクリック
5. 「**CSV**」形式を選択してダウンロード

## 方法2: SQLで整形してエクスポート

`answers`（JSONB）を展開して、より見やすい形式でエクスポートする場合：

```sql
SELECT 
  id,
  created_at,
  school_name,
  respondent_role,
  status,
  graduation_path,
  graduation_path_other,
  overall_satisfaction,
  good_comment,
  bad_comment,
  email,
  -- answersから各フィールドを展開
  answers->>'reason_for_choosing' as reason_for_choosing,
  answers->>'course' as course,
  answers->>'enrollment_type' as enrollment_type,
  answers->>'enrollment_year' as enrollment_year,
  answers->>'attendance_frequency' as attendance_frequency,
  answers->>'teaching_style' as teaching_style,
  answers->>'student_atmosphere' as student_atmosphere,
  answers->>'atmosphere_other' as atmosphere_other,
  answers->>'flexibility_rating' as flexibility_rating,
  answers->>'staff_rating' as staff_rating,
  answers->>'support_rating' as support_rating,
  answers->>'atmosphere_fit_rating' as atmosphere_fit_rating,
  answers->>'credit_rating' as credit_rating,
  answers->>'unique_course_rating' as unique_course_rating,
  answers->>'career_support_rating' as career_support_rating,
  answers->>'campus_life_rating' as campus_life_rating,
  answers->>'tuition_rating' as tuition_rating
FROM survey_responses
ORDER BY created_at DESC;
```

このSQLを実行後、「**Download**」ボタンからCSVをダウンロードできます。

## 方法3: 配列フィールドを文字列に変換

`reason_for_choosing`、`teaching_style`、`student_atmosphere`は配列なので、CSVで見やすくするために文字列に変換：

```sql
SELECT 
  id,
  created_at,
  school_name,
  respondent_role,
  status,
  graduation_path,
  graduation_path_other,
  overall_satisfaction,
  good_comment,
  bad_comment,
  email,
  -- 配列をカンマ区切りの文字列に変換
  array_to_string(ARRAY(SELECT jsonb_array_elements_text(answers->'reason_for_choosing')), ', ') as reason_for_choosing,
  answers->>'course' as course,
  answers->>'enrollment_type' as enrollment_type,
  answers->>'enrollment_year' as enrollment_year,
  answers->>'attendance_frequency' as attendance_frequency,
  array_to_string(ARRAY(SELECT jsonb_array_elements_text(answers->'teaching_style')), ', ') as teaching_style,
  array_to_string(ARRAY(SELECT jsonb_array_elements_text(answers->'student_atmosphere')), ', ') as student_atmosphere,
  answers->>'atmosphere_other' as atmosphere_other,
  answers->>'flexibility_rating' as flexibility_rating,
  answers->>'staff_rating' as staff_rating,
  answers->>'support_rating' as support_rating,
  answers->>'atmosphere_fit_rating' as atmosphere_fit_rating,
  answers->>'credit_rating' as credit_rating,
  answers->>'unique_course_rating' as unique_course_rating,
  answers->>'career_support_rating' as career_support_rating,
  answers->>'campus_life_rating' as campus_life_rating,
  answers->>'tuition_rating' as tuition_rating
FROM survey_responses
ORDER BY created_at DESC;
```

## 注意事項

- CSVファイルはUTF-8エンコーディングで保存されます
- Excelで開く場合、文字化けする場合は「データ」→「テキストファイル」からインポートし、文字コードを「UTF-8」に設定してください
- `answers`カラムがJSON形式のままの場合、Excelで開くと見づらい場合があります。方法2または方法3を使用することを推奨します

## おすすめ

**最も見やすい形式は「方法3」です。**
- すべてのフィールドが個別の列として表示されます
- 配列データもカンマ区切りの文字列として見やすく表示されます

