-- slugのユニーク制約追加
-- SEOとデータ整合性の向上

-- 既存のインデックスを削除（存在する場合）
DROP INDEX IF EXISTS idx_schools_slug_unique;

-- slugのユニーク制約を追加（NULLを許可するため、部分インデックスを使用）
CREATE UNIQUE INDEX idx_schools_slug_unique 
ON schools(slug) 
WHERE slug IS NOT NULL;

-- 重複するslugがある場合はエラーが発生する
-- 重複チェッククエリ（実行して確認）:
-- SELECT slug, COUNT(*) 
-- FROM schools 
-- WHERE slug IS NOT NULL 
-- GROUP BY slug 
-- HAVING COUNT(*) > 1;

-- 重複がある場合は、以下のクエリで修正が必要:
-- UPDATE schools 
-- SET slug = slug || '-' || id::text 
-- WHERE id IN (
--   SELECT id 
--   FROM schools 
--   WHERE slug IN (
--     SELECT slug 
--     FROM schools 
--     WHERE slug IS NOT NULL 
--     GROUP BY slug 
--     HAVING COUNT(*) > 1
--   )
-- );
