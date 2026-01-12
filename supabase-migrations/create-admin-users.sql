-- 管理画面認証: admin_usersテーブルの作成
-- 管理者（運営関係者）を管理するテーブル

-- テーブルの作成
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON admin_users(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_users_role_active ON admin_users(role, is_active);

-- updated_atを自動更新するトリガー
CREATE TRIGGER update_admin_users_updated_at 
  BEFORE UPDATE ON admin_users 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- コメント
COMMENT ON TABLE admin_users IS '管理画面へのアクセス権限を持つ管理者一覧';
COMMENT ON COLUMN admin_users.email IS 'Supabase Authのemailと一致させる（一意）';
COMMENT ON COLUMN admin_users.role IS '権限レベル: owner（全権限）または admin（通常の管理画面機能のみ）';
COMMENT ON COLUMN admin_users.is_active IS 'アクティブフラグ（falseの場合はアクセス不可）';
