# answersカラム（JSONB）の確認方法

SupabaseのTable Editorで`answers`カラム（JSONB形式）を確認する方法を説明します。

## 方法1: Table Editorで確認

### ステップ1: テーブルを開く

1. Supabaseダッシュボードで「**Table Editor**」を開く
2. `survey_responses` テーブルを選択

### ステップ2: answersカラムを確認

SupabaseのTable Editorでは、JSONBカラムは以下のように表示されます：

1. **テーブルビューで確認**
   - `answers` カラムには `{...}` のようなJSON形式で表示されます
   - クリックすると、テキストエディタが開いてJSONの内容を確認できます

2. **行を選択して詳細表示**
   - 行をクリックして選択
   - 右側のパネル（または下部）に詳細情報が表示されます
   - `answers` フィールドがJSON形式で表示されます

3. **JSONビューアーで確認**
   - `answers` カラムのセルをダブルクリック
   - JSONエディタが開いて、整形されたJSONが表示されます

## 方法2: SQL Editorで確認（推奨・最も確実）

SQL Editorを使って、整形されたJSONを確認する方法です。

### ステップ1: SQL Editorを開く

1. Supabaseダッシュボードで「**SQL Editor**」をクリック
2. 「**New query**」をクリック

### ステップ2: 以下のSQLを実行

```sql
SELECT 
  id,
  school_name,
  respondent_role,
  status,
  overall_satisfaction,
  good_comment,
  bad_comment,
  answers,  -- JSONBカラム
  created_at
FROM survey_responses
ORDER BY created_at DESC
LIMIT 10;
```

### ステップ3: 結果を確認

- `answers` カラムにJSON形式のデータが表示されます
- クリックすると、整形されたJSONが表示されます

## 方法3: JSONを整形して確認するSQL

より見やすく整形されたJSONを確認したい場合：

```sql
SELECT 
  id,
  school_name,
  jsonb_pretty(answers) as answers_formatted,  -- 整形されたJSON
  created_at
FROM survey_responses
ORDER BY created_at DESC
LIMIT 10;
```

## 方法4: 特定のフィールドだけを抽出

`answers`の中の特定のフィールドだけを確認したい場合：

```sql
SELECT 
  id,
  school_name,
  answers->'reason_for_choosing' as reason_for_choosing,
  answers->'enrollment_type' as enrollment_type,
  answers->'enrollment_year' as enrollment_year,
  answers->'attendance_frequency' as attendance_frequency,
  answers->'flexibility_rating' as flexibility_rating,
  created_at
FROM survey_responses
ORDER BY created_at DESC;
```

## 方法5: すべてのデータを確認するSQL

すべてのカラムとanswersの内容を一度に確認：

```sql
SELECT * FROM survey_responses ORDER BY created_at DESC;
```

## 確認すべきanswersの内容

`answers`カラムには以下のようなJSONデータが格納されているはずです：

```json
{
  "reason_for_choosing": ["心の不調", "人間関係"],
  "course": "普通科",
  "enrollment_type": "新入学（中学卒業後）",
  "enrollment_year": "2024",
  "attendance_frequency": "週1〜2",
  "teaching_style": ["校舎集団中心", "オンラインライブ中心"],
  "student_atmosphere": ["まじめで授業/行事に積極的"],
  "atmosphere_other": null,
  "flexibility_rating": "3",
  "staff_rating": "3",
  "support_rating": "3",
  "atmosphere_fit_rating": "3",
  "credit_rating": "3",
  "unique_course_rating": "3",
  "career_support_rating": "3",
  "campus_life_rating": "3",
  "tuition_rating": "3"
}
```

## トラブルシューティング

### answersカラムが空の場合

- データが正しく送信されていない可能性があります
- ブラウザのコンソール（F12）でエラーを確認
- ターミナルのログを確認

### answersカラムが表示されない場合

- SQL Editorで確認する方法（方法2）を試してください
- テーブル構造が正しいか確認：
  ```sql
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'survey_responses';
  ```

## おすすめの確認方法

**最も確実な方法は「方法2: SQL Editorで確認」です。**

1. SQL Editorを開く
2. 上記の「方法2」のSQLを実行
3. 結果の`answers`カラムをクリックしてJSONを確認

これで、データが正しく保存されているか確認できます。

