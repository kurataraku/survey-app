-- Epic2: 現在のschoolsテーブルのslugを確認するSQL

-- すべての学校のslugを確認
SELECT id, name, slug, created_at 
FROM schools 
ORDER BY created_at DESC;

-- slugがnullまたは空の学校を確認
SELECT id, name, slug 
FROM schools 
WHERE slug IS NULL OR slug = '' OR slug IS NULL;

-- 特定の学校名のslugを確認（例: "G高校"）
SELECT id, name, slug 
FROM schools 
WHERE name LIKE '%G高校%' OR name LIKE '%12/28test%';

-- slugの重複を確認
SELECT slug, COUNT(*) as count, array_agg(name) as school_names
FROM schools 
WHERE slug IS NOT NULL AND slug != ''
GROUP BY slug 
HAVING COUNT(*) > 1;









