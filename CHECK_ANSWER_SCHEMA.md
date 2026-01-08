# answer_schemaテーブルの確認方法

## 問題

`campus_prefecture`がデータベースに保存されない原因は、`normalizeAnswers`関数が`answer_schema`テーブルからスキーマを取得しているためです。もし`answer_schema`テーブルに`campus_prefecture`が存在しない場合、`normalizeAnswers`関数は`campus_prefecture`を破棄してしまいます。

## 確認方法

### ステップ1: answer_schemaテーブルを確認

SupabaseのSQL Editorで以下のSQLを実行してください：

```sql
SELECT * FROM answer_schema WHERE key = 'campus_prefecture';
```

### ステップ2: answer_schemaテーブルのすべてのデータを確認

```sql
SELECT * FROM answer_schema ORDER BY key;
```

### ステップ3: campus_prefectureが存在しない場合

以下のSQLを実行して、`campus_prefecture`を`answer_schema`テーブルに追加してください：

```sql
INSERT INTO answer_schema (key, type, required, description) 
VALUES ('campus_prefecture', 'string', false, '主に通っていたキャンパス都道府県')
ON CONFLICT (key) DO NOTHING;
```

## トラブルシューティング

### answer_schemaテーブルが存在しない場合

`supabase-schema-answer-schema.sql`ファイルを実行して、テーブルを作成してください。

### campus_prefectureが正しく処理されない場合

1. `answer_schema`テーブルに`campus_prefecture`が存在するか確認
2. 新しい口コミを送信して、ターミナルのログを確認
3. `normalizeAnswers`関数のログで`campus_prefecture`が正しく処理されているか確認








