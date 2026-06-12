-- campus_locations JSONB に nearest_stations（最寄り駅・最大2件）を追加可能にする（スキーマ変更なし・コメント更新のみ）
-- 例: [{"prefecture":"東京都","city":"新宿区","nearest_stations":["JR山手線 新宿駅","丸の内線 新宿三丁目駅"]}]

COMMENT ON COLUMN schools.campus_locations IS 'キャンパス所在地: [{"prefecture":"東京都","city":"新宿区","nearest_stations":["JR山手線 新宿駅","丸の内線 新宿三丁目駅"]}] のJSONB配列';
