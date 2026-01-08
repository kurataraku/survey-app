# テーブル構造の確認方法

## エラーが発生した場合の対処法

`column "id" does not exist`というエラーが出た場合、まずテーブルの構造を確認してください。

## ステップ1: テーブルの構造を確認

SupabaseのSQL Editorで以下のSQLを実行してください：

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'survey_responses'
ORDER BY ordinal_position;
```

これで、`survey_responses`テーブルに存在するすべてのカラム名とデータ型が表示されます。

## ステップ2: テーブルの主キーを確認

```sql
SELECT 
  a.attname AS column_name,
  t.typname AS data_type
FROM pg_index i
JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
JOIN pg_class c ON c.oid = i.indrelid
JOIN pg_type t ON t.oid = a.atttypid
WHERE c.relname = 'survey_responses'
  AND i.indisprimary;
```

## ステップ3: すべてのデータを確認（カラム名を指定しない）

```sql
SELECT * 
FROM survey_responses 
ORDER BY created_at DESC 
LIMIT 10;
```

これで、テーブルに存在するすべてのカラムが表示されます。

## ステップ4: answersカラムのみを確認

```sql
SELECT 
  answers,
  created_at
FROM survey_responses 
ORDER BY created_at DESC 
LIMIT 10;
```

## ステップ5: 都道府県データを確認（カラム名を指定しない）

```sql
SELECT 
  answers->>'campus_prefecture' as campus_prefecture,
  answers->>'attendance_frequency' as attendance_frequency,
  answers->'reason_for_choosing' as reason_for_choosing
FROM survey_responses 
ORDER BY created_at DESC 
LIMIT 20;
```

## トラブルシューティング

### テーブルが存在しない場合

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%survey%';
```

これで、`survey`という文字を含むテーブル名がすべて表示されます。

### カラム名が異なる場合

テーブル構造を確認した後、実際のカラム名に合わせてSQLを修正してください。









