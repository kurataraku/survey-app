# Epic2: slug 404エラーの解決方法

## 問題

学校検索ページから学校をクリックした際に、`/api/schools/12-28test`などのリクエストが404エラーになっている。

## 原因

データベースの`schools`テーブルに`slug`が正しく設定されていない可能性があります。フロントエンドで`slug`を使ってURLを生成していますが、データベースにそのslugが存在しないため、404エラーが発生しています。

## 解決方法

### Step 1: データベースのslugを確認

SupabaseのSQL Editorで以下のクエリを実行して、slugの状態を確認してください：

```sql
SELECT id, name, slug FROM schools LIMIT 10;
```

`slug`が`null`または空文字列のレコードがある場合は、Step 2に進んでください。

### Step 2: slugを更新するSQLを実行

`supabase-schema-epic2-update-school-slugs.sql`の内容をSupabaseのSQL Editorで実行してください：

1. Supabaseダッシュボード → 「SQL Editor」
2. 「New query」をクリック
3. `supabase-schema-epic2-update-school-slugs.sql`の内容をコピー＆ペースト
4. 「RUN」ボタンをクリック

これで、既存の学校にslugが自動生成されます。

### Step 3: 実行結果を確認

以下のクエリで、slugが正しく設定されたことを確認してください：

```sql
SELECT id, name, slug FROM schools WHERE name LIKE '%12/28test%';
```

`slug`が`12-28test`になっていることを確認してください。

### Step 4: ブラウザで動作確認

1. ブラウザのページをリロード（F5）
2. 学校検索ページから学校をクリック
3. ページ遷移が正常に動作することを確認

## 注意事項

- SQL実行後、ブラウザのページをリロードしないと、新しいslugが反映されない場合があります
- 重複するslugが生成される可能性があるため、実行後に重複を確認することを推奨します

重複確認クエリ：

```sql
SELECT slug, COUNT(*) as count 
FROM schools 
GROUP BY slug 
HAVING COUNT(*) > 1;
```

重複がある場合は、手動で修正してください。







