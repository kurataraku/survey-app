# Epic2: slugがnullの場合の対処法

## 問題

学校検索ページから学校をクリックしてもページ遷移しない場合、`schools`テーブルの`slug`カラムが`null`になっている可能性があります。

## 解決方法

### 方法1: 既存のschoolsテーブルのslugを更新（推奨）

以下のSQLをSupabaseのSQL Editorで実行してください：

1. Supabaseダッシュボード → 「SQL Editor」
2. 「New query」をクリック
3. `supabase-schema-epic2-update-school-slugs.sql`の内容をコピー＆ペースト
4. 「RUN」ボタンをクリック

これで、既存の学校にslugが自動生成されます。

### 方法2: 現在の実装で対応（既に対応済み）

現在の実装では、`slug`が`null`の場合、IDベースのURL（`/schools/id/[id]`）を使用します。これにより、slugがnullでもページ遷移は動作します。

ただし、より良いユーザー体験のため、方法1でslugを設定することを推奨します。

## 確認方法

### 1. slugがnullの学校を確認

SupabaseのSQL Editorで以下のクエリを実行：

```sql
SELECT id, name, slug FROM schools WHERE slug IS NULL OR slug = '';
```

### 2. 重複するslugを確認

```sql
SELECT slug, COUNT(*) as count 
FROM schools 
GROUP BY slug 
HAVING COUNT(*) > 1;
```

重複がある場合は、手動で修正してください。

## 今後の対応

新しい学校が作成される際は、`app/api/submit/route.ts`で`generateSlug`関数を使用してslugが自動生成されるため、この問題は発生しません。















