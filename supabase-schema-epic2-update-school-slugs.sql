-- Epic2: 既存のschoolsテーブルのslugを更新
-- 既存のschoolsテーブルでslugがnullまたは不適切なレコードに対してslugを自動生成します

-- ステップ1: slugがnullまたは空の学校に対して、nameからslugを生成
UPDATE schools
SET slug = LOWER(
  TRIM(BOTH '-' FROM
    REGEXP_REPLACE(
      REGEXP_REPLACE(name, '[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]', '-', 'g'),
      '-+', '-', 'g'
    )
  )
)
WHERE slug IS NULL OR slug = '';

-- ステップ2: 空文字列になった場合や、日本語のみでslugが短すぎる場合は'unknown-' + idを使用
UPDATE schools
SET slug = 'unknown-' || id::text
WHERE slug IS NULL OR slug = '' OR LENGTH(slug) = 0;

-- ステップ3: 重複するslugがある場合、2つ目以降にidを追加
WITH duplicate_slugs AS (
  SELECT slug, array_agg(id ORDER BY created_at) as ids
  FROM schools
  WHERE slug IS NOT NULL AND slug != ''
  GROUP BY slug
  HAVING COUNT(*) > 1
)
UPDATE schools s
SET slug = s.slug || '-' || substring(s.id::text, 1, 8)
FROM duplicate_slugs ds
WHERE s.slug = ds.slug 
  AND s.id != ds.ids[1];

-- 重複するslugがある場合の処理（手動確認が必要な場合）
-- 以下のクエリで重複を確認できます：
-- SELECT slug, COUNT(*) as count FROM schools GROUP BY slug HAVING COUNT(*) > 1;

