-- schoolsテーブルの拡張
-- name_normalized、statusカラムを追加

-- 1. name_normalizedカラムを追加（検索用正規化名）
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS name_normalized TEXT;

-- 2. 既存データのname_normalizedを生成（一時的に空文字列で初期化、後でアプリ側で更新）
UPDATE schools 
SET name_normalized = name
WHERE name_normalized IS NULL;

-- 3. name_normalizedをNOT NULLに変更（既存データがあるため）
ALTER TABLE schools 
ALTER COLUMN name_normalized SET NOT NULL;

-- 4. statusカラムを追加（'active'/'pending'/'merged'）
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- 5. prefecturesカラムが存在しない場合は追加（既存のマイグレーションで追加済みの可能性がある）
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS prefectures TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 6. name_normalizedのユニーク制約を追加
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_name_normalized_unique ON schools(name_normalized);

-- 7. statusカラムのインデックスを作成
CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(status);

-- コメント
COMMENT ON COLUMN schools.name_normalized IS '検索用正規化名（全角半角・空白・記号などを統一）';
COMMENT ON COLUMN schools.status IS '状態: active（正規に使う）/ pending（仮登録）/ merged（統合済みで非表示）';

