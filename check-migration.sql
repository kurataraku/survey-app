-- マイグレーション実行状況を確認するSQL
-- Supabase SQL Editorで実行してください

-- 1. prefecturesカラムが存在するか確認
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'schools' 
  AND column_name IN ('prefecture', 'prefectures')
ORDER BY column_name;

-- 2. 学校データのprefectures配列の内容を確認
SELECT 
  id,
  name,
  prefecture,
  prefectures,
  array_length(prefectures, 1) as prefectures_count
FROM schools
WHERE is_public = true
ORDER BY name
LIMIT 10;

