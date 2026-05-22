-- schoolsテーブルに設置区分を追加
-- public: 公立通信制高校 / private: 私立通信制高校 / support: サポート校

ALTER TABLE schools
ADD COLUMN IF NOT EXISTS institution_type TEXT;

ALTER TABLE schools
DROP CONSTRAINT IF EXISTS schools_institution_type_check;

ALTER TABLE schools
ADD CONSTRAINT schools_institution_type_check
CHECK (
  institution_type IS NULL
  OR institution_type IN ('public', 'private', 'support')
);

CREATE INDEX IF NOT EXISTS idx_schools_institution_type
ON schools(institution_type);

COMMENT ON COLUMN schools.institution_type IS '設置区分: public（公立通信制高校）/ private（私立通信制高校）/ support（サポート校）';
