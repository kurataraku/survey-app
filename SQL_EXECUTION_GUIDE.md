# SQL実行ガイド

## エラーについて

`import { MetadataRoute } from 'next';`というエラーが出る場合、TypeScriptファイル（`app/sitemap.ts`）を実行してしまっている可能性があります。

**必ずSQLファイル（`.sql`）のみを実行してください。**

## 正しい実行手順

### 1. SupabaseのSQL Editorを開く

1. Supabaseダッシュボードにログイン
2. 左メニューから「SQL Editor」をクリック
3. 「New query」をクリック

### 2. SQLファイルの内容をコピー

以下のファイルから**SQL部分のみ**をコピーしてください：

- `supabase-migrations/add-rls-policies.sql`
- `supabase-migrations/add-slug-unique-constraint.sql`

### 3. SQL Editorに貼り付け

コピーしたSQLをSQL Editorに貼り付けます。

**重要**: TypeScriptのコード（`import`や`export`など）が含まれていないことを確認してください。

### 4. 実行

「Run」ボタンをクリックして実行します。

## 実行するSQLファイル一覧

### 優先度: 高

1. **`supabase-migrations/add-rls-policies.sql`**
   - RLSポリシーを追加
   - セキュリティ上最重要

2. **`supabase-migrations/add-slug-unique-constraint.sql`**
   - slugのユニーク制約を追加
   - SEOとデータ整合性に重要

## トラブルシューティング

### エラー: "syntax error at or near"

- **原因**: TypeScriptファイルを実行している
- **解決策**: `.sql`ファイルのみを実行してください

### エラー: "relation does not exist"

- **原因**: テーブルが存在しない
- **解決策**: 先にテーブルを作成するSQLを実行してください

### エラー: "policy already exists"

- **原因**: 既にポリシーが存在する
- **解決策**: `DROP POLICY IF EXISTS`が含まれているので、そのまま再実行してください

## 確認クエリ

実行後、以下のクエリでRLSが有効になっているか確認できます：

```sql
-- RLSが有効になっているか確認
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('schools', 'survey_responses', 'articles');

-- ポリシーが作成されているか確認
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('schools', 'survey_responses', 'articles');
```
