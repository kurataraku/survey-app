# Epic2: ページ遷移404エラーの即座の修正方法

## 問題

ネットワークタブで`/api/schools/[slug]`へのリクエストが404エラーになっている。

## 原因

データベースの`schools`テーブルに`slug`が正しく設定されていない、またはslugが不適切な値になっている。

## 解決方法

### Step 1: 現在のslugの状態を確認

SupabaseのSQL Editorで以下のクエリを実行して、現在のslugの状態を確認してください：

```sql
-- すべての学校のslugを確認
SELECT id, name, slug, created_at 
FROM schools 
ORDER BY created_at DESC
LIMIT 20;
```

### Step 2: slugを更新するSQLを実行

`supabase-schema-epic2-update-school-slugs.sql`の内容をSupabaseのSQL Editorで実行してください：

1. Supabaseダッシュボード → 「SQL Editor」
2. 「New query」をクリック
3. `supabase-schema-epic2-update-school-slugs.sql`の内容をすべてコピー＆ペースト
4. 「RUN」ボタンをクリック
5. 成功メッセージを確認

### Step 3: 実行結果を確認

以下のクエリで、slugが正しく設定されたことを確認：

```sql
-- slugが正しく設定されているか確認
SELECT id, name, slug 
FROM schools 
WHERE slug IS NULL OR slug = '';

-- 結果が0件であれば、すべての学校にslugが設定されています
```

### Step 4: 開発サーバーを再起動

1. ターミナルで `Ctrl + C` を押して開発サーバーを停止
2. `npm run dev` で再起動

### Step 5: ブラウザで確認

1. ブラウザのページを完全にリロード（Ctrl + F5 または Cmd + Shift + R）
2. 学校検索ページ（`http://localhost:3000/schools`）にアクセス
3. 学校カードをクリック
4. ネットワークタブで404エラーが解消されたことを確認
5. ページ遷移が正常に動作することを確認

## トラブルシューティング

### SQL実行後にエラーが出る場合

- エラーメッセージの内容を確認
- `schools`テーブルが存在することを確認
- `slug`カラムが存在することを確認

### まだ404エラーが出る場合

1. ブラウザのキャッシュをクリア（Ctrl + Shift + Delete）
2. 開発サーバーを再起動
3. ブラウザのページを完全にリロード（Ctrl + F5）

### slugが重複している場合

SQLファイルには重複を解決する処理が含まれていますが、手動で確認する場合は：

```sql
SELECT slug, COUNT(*) as count, array_agg(name) as school_names
FROM schools 
WHERE slug IS NOT NULL AND slug != ''
GROUP BY slug 
HAVING COUNT(*) > 1;
```

重複が見つかった場合は、手動で修正するか、SQLファイルの重複解決処理を確認してください。














