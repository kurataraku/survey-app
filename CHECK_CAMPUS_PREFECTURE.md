# 都道府県データの確認方法

このガイドでは、データベースに都道府県（`campus_prefecture`）のデータが保存されているかどうかを確認する方法を説明します。

## 方法1: Supabaseダッシュボードで確認（最も簡単）

### ステップ1: Supabaseダッシュボードにアクセス

1. [Supabaseダッシュボード](https://app.supabase.com/)にログイン
2. プロジェクトを選択

### ステップ2: SQL Editorを開く

1. 左側のメニューから「**SQL Editor**」をクリック
2. 「**New query**」をクリック

### ステップ3: 以下のSQLを実行

```sql
SELECT 
  id,
  school_name,
  created_at,
  answers->>'campus_prefecture' as campus_prefecture,
  answers->>'attendance_frequency' as attendance_frequency,
  answers->'reason_for_choosing' as reason_for_choosing,
  jsonb_pretty(answers) as answers_formatted
FROM survey_responses
ORDER BY created_at DESC
LIMIT 20;
```

### ステップ4: 結果を確認

- `campus_prefecture`カラムに都道府県名が表示されているか確認
- `answers_formatted`カラムをクリックすると、整形されたJSONが表示されます
- `campus_prefecture`が`null`や空の場合は、データが保存されていません

## 方法2: 特定の学校名で確認

「test」という学校名の口コミを確認する場合：

```sql
SELECT 
  id,
  school_name,
  created_at,
  answers->>'campus_prefecture' as campus_prefecture,
  answers->>'attendance_frequency' as attendance_frequency,
  answers->'reason_for_choosing' as reason_for_choosing,
  jsonb_pretty(answers) as answers_formatted
FROM survey_responses
WHERE school_name = 'test'
ORDER BY created_at DESC;
```

## 方法3: 都道府県が保存されている口コミのみを確認

```sql
SELECT 
  id,
  school_name,
  created_at,
  answers->>'campus_prefecture' as campus_prefecture
FROM survey_responses
WHERE answers->>'campus_prefecture' IS NOT NULL
  AND answers->>'campus_prefecture' != ''
ORDER BY created_at DESC;
```

## 方法4: 都道府県が保存されていない口コミを確認

```sql
SELECT 
  id,
  school_name,
  created_at,
  answers->>'campus_prefecture' as campus_prefecture,
  jsonb_pretty(answers) as answers_formatted
FROM survey_responses
WHERE answers->>'campus_prefecture' IS NULL
   OR answers->>'campus_prefecture' = ''
ORDER BY created_at DESC;
```

## 方法5: Table Editorで確認

1. 左側のメニューから「**Table Editor**」をクリック
2. `survey_responses`テーブルを選択
3. 各行の`answers`カラムをクリック
4. JSONエディタが開いて、`campus_prefecture`の値を確認できます

## トラブルシューティング

### `campus_prefecture`が`null`の場合

- アンケート送信時に都道府県が選択されていない可能性があります
- `normalizeAnswers`関数で都道府県が除外されている可能性があります
- データベースに保存される前に値が失われている可能性があります

### `campus_prefecture`が空文字列の場合

- アンケート送信時に都道府県が選択されていない可能性があります
- バリデーションエラーで値が空になっている可能性があります

### 確認すべきポイント

1. **アンケートフォーム**: 都道府県の選択が必須になっているか
2. **APIエンドポイント** (`app/api/submit/route.ts`): `campus_prefecture`が正しく保存されているか
3. **`normalizeAnswers`関数**: 都道府県が除外されていないか
4. **データベーススキーマ**: `answer_schema`テーブルに`campus_prefecture`が定義されているか

## 次のステップ

都道府県のデータが保存されていない場合：

1. アンケートフォームで都道府県を選択して送信
2. ターミナルのログを確認（`app/api/submit/route.ts`のログ）
3. データベースで再度確認

都道府県のデータが保存されているのに表示されない場合：

1. APIエンドポイント（`app/api/home/route.ts`）のログを確認
2. ブラウザのコンソール（F12）でAPIレスポンスを確認
3. `ReviewCard`コンポーネントに正しく値が渡されているか確認








