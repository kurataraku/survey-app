-- 相談AIロジック説明ページ用の運用ドキュメント（管理画面から編集可能）
CREATE TABLE IF NOT EXISTS consultation_ai_logic_docs (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000002',
  purpose_intro TEXT NOT NULL DEFAULT '',
  purpose_note TEXT NOT NULL DEFAULT '',
  logic_flow_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_rules_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  improvement_history_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  review_loop_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  caution_notes_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES admin_users(id) ON DELETE SET NULL
);

INSERT INTO consultation_ai_logic_docs (id)
VALUES ('00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_consultation_ai_logic_docs_updated_at
  ON consultation_ai_logic_docs(updated_at DESC);

ALTER TABLE consultation_ai_logic_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "管理者のみconsultation_ai_logic_docsを参照可能"
  ON consultation_ai_logic_docs
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "管理者のみconsultation_ai_logic_docsを更新可能"
  ON consultation_ai_logic_docs
  FOR UPDATE
  USING (auth.role() = 'authenticated');
