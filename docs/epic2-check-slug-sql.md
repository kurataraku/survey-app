# Epic2: slug確認用SQLクエリ

## 現在のslugの状態を確認

SupabaseのSQL Editorで以下のクエリを実行して、slugの状態を確認してください：

```sql
-- すべての学校のslugを確認
SELECT id, name, slug FROM schools ORDER BY created_at DESC;

-- slugがnullまたは空の学校を確認
SELECT id, name, slug FROM schools WHERE slug IS NULL OR slug = '';

-- 特定の学校名のslugを確認（例: "12/28test"）
SELECT id, name, slug FROM schools WHERE name LIKE '%12/28test%';
```

## slugを更新する

上記のクエリでslugがnullまたは空の学校が見つかった場合は、`supabase-schema-epic2-update-school-slugs.sql`を実行してください。



