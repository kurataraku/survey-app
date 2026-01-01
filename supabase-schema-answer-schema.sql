-- answer_schema テーブルの作成
-- answers JSONB のキー定義を管理するテーブル

-- 既存のテーブルを削除（開発時にのみ実行）
-- DROP TABLE IF EXISTS answer_schema CASCADE;

-- テーブルの作成
CREATE TABLE IF NOT EXISTS answer_schema (
  key TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('string', 'number', 'string[]', 'number[]', 'boolean')),
  required BOOLEAN NOT NULL DEFAULT false,
  enum_values TEXT[],
  aliases TEXT[],
  description TEXT
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_answer_schema_type ON answer_schema(type);
CREATE INDEX IF NOT EXISTS idx_answer_schema_required ON answer_schema(required);

-- 初期データの挿入
-- 現在のコードで使用されているすべてのキーを登録

-- Step1: 基本情報
INSERT INTO answer_schema (key, type, required, description) VALUES
  ('reason_for_choosing', 'string[]', false, '通信制を選んだ理由（複数選択可）')
ON CONFLICT (key) DO NOTHING;

INSERT INTO answer_schema (key, type, required, description) VALUES
  ('course', 'string', false, '在籍していたコース')
ON CONFLICT (key) DO NOTHING;

INSERT INTO answer_schema (key, type, required, description) VALUES
  ('enrollment_type', 'string', false, '入学タイミング')
ON CONFLICT (key) DO NOTHING;

INSERT INTO answer_schema (key, type, required, description) VALUES
  ('enrollment_year', 'string', false, '入学年（4桁の文字列）')
ON CONFLICT (key) DO NOTHING;

-- Step2: 学習/環境
INSERT INTO answer_schema (key, type, required, description) VALUES
  ('attendance_frequency', 'string', false, '主な通学頻度')
ON CONFLICT (key) DO NOTHING;

INSERT INTO answer_schema (key, type, required, description) VALUES
  ('campus_prefecture', 'string', false, '主に通っていたキャンパス都道府県')
ON CONFLICT (key) DO NOTHING;

INSERT INTO answer_schema (key, type, required, description) VALUES
  ('teaching_style', 'string[]', false, '授業スタイル（複数選択可）')
ON CONFLICT (key) DO NOTHING;

INSERT INTO answer_schema (key, type, required, description) VALUES
  ('student_atmosphere', 'string[]', false, '生徒の雰囲気（複数選択可）')
ON CONFLICT (key) DO NOTHING;

INSERT INTO answer_schema (key, type, required, description) VALUES
  ('atmosphere_other', 'string', false, 'その他（生徒の雰囲気）')
ON CONFLICT (key) DO NOTHING;

-- Step3: 評価（すべて文字列型の数値 "1"〜"5" または "6"）
INSERT INTO answer_schema (key, type, required, description) VALUES
  ('flexibility_rating', 'string', false, '学びの柔軟さ（評価）')
ON CONFLICT (key) DO NOTHING;

INSERT INTO answer_schema (key, type, required, description) VALUES
  ('staff_rating', 'string', false, '先生・職員の対応（評価）')
ON CONFLICT (key) DO NOTHING;

INSERT INTO answer_schema (key, type, required, description) VALUES
  ('support_rating', 'string', false, '心や体調の波・不安などに対するサポート（評価）')
ON CONFLICT (key) DO NOTHING;

INSERT INTO answer_schema (key, type, required, description) VALUES
  ('atmosphere_fit_rating', 'string', false, '在校生の雰囲気が自分に合っていたか（評価）')
ON CONFLICT (key) DO NOTHING;

INSERT INTO answer_schema (key, type, required, description) VALUES
  ('credit_rating', 'string', false, '単位取得のしやすさ（評価）')
ON CONFLICT (key) DO NOTHING;

INSERT INTO answer_schema (key, type, required, description) VALUES
  ('unique_course_rating', 'string', false, '独自授業・コースの充実度（評価）')
ON CONFLICT (key) DO NOTHING;

INSERT INTO answer_schema (key, type, required, description) VALUES
  ('career_support_rating', 'string', false, '進路サポート（評価）')
ON CONFLICT (key) DO NOTHING;

INSERT INTO answer_schema (key, type, required, description) VALUES
  ('campus_life_rating', 'string', false, '行事やキャンパスライフの過ごしやすさ（評価）')
ON CONFLICT (key) DO NOTHING;

INSERT INTO answer_schema (key, type, required, description) VALUES
  ('tuition_rating', 'string', false, '学費の納得感（評価）')
ON CONFLICT (key) DO NOTHING;

-- コメント: 将来的にキー名が変更された場合、aliasesを使用して過去のキー名から新しいキー名にマッピングできます
-- 例: 将来 'enrollment_year' を 'enrollmentYear' に変更する場合
-- UPDATE answer_schema SET aliases = ARRAY['enrollment_year'] WHERE key = 'enrollmentYear';









