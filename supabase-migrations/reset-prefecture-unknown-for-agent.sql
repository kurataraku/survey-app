-- AI エージェントの prefecture ステップを再実行する前に、
-- 「不明」が入っていると route の `if (school.prefecture)` で SKIP されるため「未入力」に戻す。
--
-- 注意: schools.prefecture は NOT NULL のため NULL は不可。
-- 空文字 '' は NOT NULL を満たし、API 上は falsy のため prefecture ステップが実行される。
-- 手動で Supabase SQL エディタから実行してください。

UPDATE schools
SET prefecture = '',
    prefectures = ARRAY[]::TEXT[]
WHERE prefecture = '不明';

-- 確認用
-- SELECT count(*) FROM schools WHERE prefecture = '不明';
-- SELECT count(*) FROM schools WHERE prefecture = '';
