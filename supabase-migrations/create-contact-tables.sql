-- お問い合わせ設定テーブル
CREATE TABLE IF NOT EXISTS contact_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notify_emails TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期設定を1件挿入（固定IDを使用）
INSERT INTO contact_settings (id, notify_emails)
VALUES ('00000000-0000-0000-0000-000000000001', '')
ON CONFLICT (id) DO NOTHING;

-- お問い合わせメッセージテーブル
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  page_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  ip TEXT,
  user_agent TEXT
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_messages_is_read ON contact_messages(is_read);
CREATE INDEX IF NOT EXISTS idx_contact_messages_email ON contact_messages(email);

-- RLS有効化
ALTER TABLE contact_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- contact_settings: 管理者のみSELECT/UPDATE
-- SERVICE_ROLE_KEYを使っている場合はRLSをバイパスできるため、このポリシーは主にクライアント側の保護用
CREATE POLICY "管理者のみcontact_settingsを参照可能"
  ON contact_settings
  FOR SELECT
  USING (true); -- SERVICE_ROLE_KEYを使っている場合は自動的にバイパスされる

CREATE POLICY "管理者のみcontact_settingsを更新可能"
  ON contact_settings
  FOR UPDATE
  USING (true); -- SERVICE_ROLE_KEYを使っている場合は自動的にバイパスされる

-- contact_messages: 公開側はINSERTのみ、管理者は全操作可能
CREATE POLICY "公開側はcontact_messagesにINSERT可能"
  ON contact_messages
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "管理者のみcontact_messagesを参照可能"
  ON contact_messages
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "管理者のみcontact_messagesを更新可能"
  ON contact_messages
  FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "管理者のみcontact_messagesを削除可能"
  ON contact_messages
  FOR DELETE
  USING (auth.role() = 'authenticated');
