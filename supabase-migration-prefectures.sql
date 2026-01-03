-- 学校テーブルにprefectures配列カラムを追加するマイグレーション
-- アンケートフォームは単一選択のまま、学校管理で複数都道府県を管理できるようにする

-- 1. schoolsテーブルにprefectures配列カラムを追加
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS prefectures TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 2. 既存のprefectureデータをprefectures配列に移行
UPDATE schools 
SET prefectures = ARRAY[prefecture]::TEXT[]
WHERE prefectures IS NULL OR array_length(prefectures, 1) IS NULL;

-- 3. prefectures配列のインデックスを作成（GINインデックス）
CREATE INDEX IF NOT EXISTS idx_schools_prefectures ON schools USING GIN (prefectures);

-- 4. コメントを追加
COMMENT ON COLUMN schools.prefectures IS '都道府県の配列（複数の都道府県に対応）';
COMMENT ON COLUMN schools.prefecture IS '都道府県（後方互換性のため保持、prefectures[0]と同期）';


