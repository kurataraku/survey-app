-- 管理画面認証: admin_usersテーブルのRLSポリシー
-- 管理者のみがadmin_usersテーブルにアクセス可能にする

-- RLSを有効化
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- ポリシー: 管理者（admin_usersに登録され、is_active=true）のみが全レコードを読み取り可能
CREATE POLICY "管理者のみがadmin_usersを読み取り可能"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.email = auth.jwt() ->> 'email'
      AND au.is_active = true
    )
  );

-- ポリシー: ownerのみがレコードを挿入可能
CREATE POLICY "ownerのみがadmin_usersを挿入可能"
  ON admin_users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.email = auth.jwt() ->> 'email'
      AND au.role = 'owner'
      AND au.is_active = true
    )
  );

-- ポリシー: ownerのみがレコードを更新可能
CREATE POLICY "ownerのみがadmin_usersを更新可能"
  ON admin_users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.email = auth.jwt() ->> 'email'
      AND au.role = 'owner'
      AND au.is_active = true
    )
  );

-- ポリシー: ownerのみがレコードを削除可能
CREATE POLICY "ownerのみがadmin_usersを削除可能"
  ON admin_users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.email = auth.jwt() ->> 'email'
      AND au.role = 'owner'
      AND au.is_active = true
    )
  );
