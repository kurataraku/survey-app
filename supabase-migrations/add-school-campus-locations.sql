-- schoolsテーブルにキャンパス所在地（都道府県・市区町村）を追加
-- 例: [{"prefecture":"東京都","city":"新宿区"},{"prefecture":"東京都","city":"立川市"}]

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS campus_locations JSONB DEFAULT '[]'::JSONB;

CREATE INDEX IF NOT EXISTS idx_schools_campus_locations
ON schools USING GIN (campus_locations);

COMMENT ON COLUMN schools.campus_locations IS 'キャンパス所在地: [{"prefecture":"東京都","city":"新宿区"}] のJSONB配列';
