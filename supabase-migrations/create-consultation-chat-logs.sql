-- 相談AIチャットログ（精度改善・モニタリング用）
CREATE TABLE IF NOT EXISTS consultation_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  session_id TEXT,
  source TEXT,
  page_url TEXT,
  user_question TEXT NOT NULL,
  assistant_reply TEXT,
  conversation_preview TEXT,
  intent TEXT,
  focus_label TEXT,
  mentioned_schools TEXT[],
  prefecture TEXT,
  reason_group TEXT,
  route_json JSONB,
  model TEXT,
  sources_json JSONB,
  school_candidates_json JSONB,
  rag_doc_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  latency_ms INTEGER,
  is_reviewed BOOLEAN DEFAULT FALSE,
  review_notes TEXT,
  ip TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_consultation_chat_logs_created_at
  ON consultation_chat_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultation_chat_logs_session_id
  ON consultation_chat_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_consultation_chat_logs_status
  ON consultation_chat_logs(status);
CREATE INDEX IF NOT EXISTS idx_consultation_chat_logs_intent
  ON consultation_chat_logs(intent);
CREATE INDEX IF NOT EXISTS idx_consultation_chat_logs_is_reviewed
  ON consultation_chat_logs(is_reviewed);
CREATE INDEX IF NOT EXISTS idx_consultation_chat_logs_source
  ON consultation_chat_logs(source);

ALTER TABLE consultation_chat_logs ENABLE ROW LEVEL SECURITY;

-- 公開APIはService RoleでINSERT、管理画面はService RoleでSELECT/UPDATE
CREATE POLICY "管理者のみconsultation_chat_logsを参照可能"
  ON consultation_chat_logs
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "管理者のみconsultation_chat_logsを更新可能"
  ON consultation_chat_logs
  FOR UPDATE
  USING (auth.role() = 'authenticated');
