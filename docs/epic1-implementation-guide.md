# Epic1 実装ガイド

このガイドでは、Epic1（DB移行：schools + survey_responses拡張）の実装手順を説明します。

## 実装ファイル一覧

### SQLファイル

1. **supabase-schema-epic1-schools.sql** - schoolsテーブルの作成
2. **supabase-schema-epic1-survey-responses-alter.sql** - survey_responsesテーブルの拡張
3. **supabase-schema-epic1-aggregates.sql** - aggregatesテーブルの作成
4. **supabase-schema-epic1-backfill.sql** - 既存データの移行（Backfill）

### コードファイル

1. **lib/utils.ts** - `generateSlug`関数を追加
2. **app/api/submit/route.ts** - schoolsテーブルとの連携と検索用カラムへの保存処理を追加

## 実装手順

### Step 1: SupabaseでSQLファイルを実行

以下の順序でSupabaseのSQL EditorでSQLファイルを実行してください。

#### 1.1 schoolsテーブルの作成

**ファイル**: `supabase-schema-epic1-schools.sql`

1. Supabaseダッシュボードにログイン
2. 「SQL Editor」を開く
3. 「New query」をクリック
4. `supabase-schema-epic1-schools.sql`の内容をコピー＆ペースト
5. 「RUN」ボタンをクリック
6. 成功メッセージを確認

#### 1.2 survey_responsesテーブルの拡張

**ファイル**: `supabase-schema-epic1-survey-responses-alter.sql`

1. 新しいクエリを作成
2. `supabase-schema-epic1-survey-responses-alter.sql`の内容をコピー＆ペースト
3. 「RUN」ボタンをクリック
4. 成功メッセージを確認

#### 1.3 aggregatesテーブルの作成

**ファイル**: `supabase-schema-epic1-aggregates.sql`

1. 新しいクエリを作成
2. `supabase-schema-epic1-aggregates.sql`の内容をコピー＆ペースト
3. 「RUN」ボタンをクリック
4. 成功メッセージを確認

### Step 2: 既存データの移行（Backfill）

**ファイル**: `supabase-schema-epic1-backfill.sql`

1. 新しいクエリを作成
2. `supabase-schema-epic1-backfill.sql`の内容をコピー＆ペースト
3. 「RUN」ボタンをクリック
4. 実行結果を確認

#### 2.1 重複候補の確認

Backfill SQLを実行すると、`duplicate_school_candidates`テンプテーブルが作成されます。

以下のクエリで重複候補を確認してください：

```sql
SELECT * FROM duplicate_school_candidates ORDER BY name1;
```

重複している学校が見つかった場合、手動でマージしてください：

1. どちらの学校IDを残すか決定
2. `survey_responses`テーブルの`school_id`を更新
3. 不要な学校レコードを削除

例：
```sql
-- school_id = 'old-id' を 'new-id' に統合
UPDATE survey_responses 
SET school_id = 'new-id' 
WHERE school_id = 'old-id';

-- 古い学校レコードを削除
DELETE FROM schools WHERE id = 'old-id';
```

#### 2.2 移行結果の確認

Backfill SQLの最後に含まれている確認クエリを実行して、移行が正しく完了したことを確認してください：

```sql
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

### Step 3: コードの確認

以下のファイルが正しく更新されていることを確認してください：

1. **lib/utils.ts** - `generateSlug`関数が追加されている
2. **app/api/submit/route.ts** - schoolsテーブルとの連携と検索用カラムへの保存処理が追加されている

### Step 4: 動作確認

#### 4.1 新規投稿のテスト

1. アンケートフォーム（`/survey`）にアクセス
2. 新しい口コミを投稿
3. SupabaseのTable Editorで以下を確認：
   - `survey_responses`テーブルに新しいレコードが作成されている
   - `school_id`が正しく設定されている
   - `schools`テーブルに新しい学校が作成されている（存在しない学校名の場合）
   - 検索用カラム（`enrollment_year`, `attendance_frequency`など）に値が保存されている
   - `answers` JSONBにも値が保存されている（二重保存）

#### 4.2 既存学校への投稿のテスト

1. 既に存在する学校名で口コミを投稿
2. SupabaseのTable Editorで以下を確認：
   - `school_id`が既存の学校IDに設定されている
   - 新しい学校レコードが作成されていない

## トラブルシューティング

### SQL実行エラー

#### エラー: "relation 'schools' does not exist"

→ `supabase-schema-epic1-schools.sql`を先に実行してください。

#### エラー: "relation 'survey_responses' does not exist"

→ 既存のテーブルが存在しない可能性があります。`supabase-schema.sql`または`supabase-schema-safe.sql`を先に実行してください。

#### エラー: "column 'school_id' does not exist"

→ `supabase-schema-epic1-survey-responses-alter.sql`を先に実行してください。

### データ移行エラー

#### school_idがNULLのまま

→ Backfill SQLのStep 3が正しく実行されていない可能性があります。以下のクエリで確認してください：

```sql
-- school_nameに対応するschoolsレコードが存在するか確認
SELECT DISTINCT sr.school_name
FROM survey_responses sr
WHERE sr.school_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM schools s WHERE s.name = sr.school_name
  );
```

該当する学校名がある場合、Step 1を再実行してください。

#### 検索用カラムがNULLのまま

→ Backfill SQLのStep 4が正しく実行されていない可能性があります。`answers` JSONBにデータが存在するか確認してください：

```sql
SELECT id, answers
FROM survey_responses
WHERE answers IS NULL OR answers = '{}'::jsonb;
```

## 次のステップ

Epic1が完了したら、Epic2（Media MVP）に進みます。

Epic2では以下の機能を実装します：
- 検索API
- 学校詳細ページ
- 口コミ一覧ページ
- いいね機能









