# 管理者アカウント設定ガイド

## 前提条件

- Supabaseプロジェクトが作成されていること
- 環境変数（`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`）が設定されていること

## ステップ1: admin_usersテーブルの作成

1. Supabaseダッシュボードにログイン
2. 左側のメニューから「**SQL Editor**」をクリック
3. 「**New query**」をクリック
4. `supabase-migrations/create-admin-users.sql` の内容をコピーしてSQL Editorに貼り付け
5. 「**Run**」ボタンをクリックして実行
6. 成功メッセージを確認

次に、RLSポリシーを設定：

7. 新しいクエリを作成
8. `supabase-migrations/add-admin-users-rls.sql` の内容をコピーしてSQL Editorに貼り付け
9. 「**Run**」ボタンをクリックして実行

## ステップ2: 初期オーナーの作成

### 方法A: スクリプトを使用（推奨）

1. **SupabaseダッシュボードでSite URLを設定**（重要）：
   - Supabaseダッシュボード → **Authentication** → **URL Configuration**
   - **Site URL** に `http://localhost:3000` を設定（開発環境の場合）
   - **Redirect URLs** に `http://localhost:3000/**` を追加
   - 「**Save**」をクリック

2. `.env.local` ファイルに以下を追加：
   ```env
   ADMIN_OWNER_EMAIL=your-email@example.com
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
   （`your-email@example.com` を実際のメールアドレスに置き換え）

3. ターミナルで以下を実行：
   ```bash
   npm run setup:initial-owner
   ```

4. 指定したメールアドレスに招待メールが届きます
5. **メール内の「Accept the invite」リンクをクリック**して、Supabaseの認証ページでパスワードを設定してください
   - リンクをクリックすると、Supabaseの認証ページにリダイレクトされます
   - そこでパスワードを設定できます
   - 設定後、そのパスワードでログインできます

### 方法B: 手動で作成

1. Supabaseダッシュボードで「**Authentication**」→「**Users**」を開く
2. 「**Add user**」ボタンをクリック
3. 以下の情報を入力：
   - **Email**: 管理者のメールアドレス
   - **Password**: 初期パスワード（後で変更可能）
   - **Auto Confirm User**: ON に設定
4. 「**Create user**」をクリック

5. SQL Editorで以下を実行（`your-email@example.com` を実際のメールアドレスに置き換え）：
   ```sql
   INSERT INTO admin_users (email, role, is_active)
   VALUES ('your-email@example.com', 'owner', true);
   ```

## ステップ3: ログイン確認

1. ブラウザで `http://localhost:3000/admin/login` にアクセス
2. 設定したメールアドレスとパスワードでログイン
3. 管理画面にアクセスできることを確認

## トラブルシューティング

### 問題: パスワードが設定できていない
**解決策A: Supabaseダッシュボードから直接パスワードを設定（最も確実）**
1. Supabaseダッシュボード → **Authentication** → **Users** を開く
2. 該当ユーザー（登録したメールアドレス）をクリック
3. 「**Reset password**」セクションで新しいパスワードを入力
4. 「**Update user**」ボタンをクリック
5. 設定したパスワードで `http://localhost:3000/admin/login` にログイン

**解決策B: スクリプトから直接パスワードを設定（推奨）**
1. `.env.local` に以下を追加：
   ```env
   ADMIN_OWNER_EMAIL=your-email@example.com
   ADMIN_OWNER_PASSWORD=your-secure-password-here
   ```
   （`ADMIN_OWNER_PASSWORD` は8文字以上の強力なパスワード）
2. ターミナルで以下を実行：
   ```bash
   npm run set-password-directly
   ```
3. パスワードが環境変数に設定されていない場合は、対話的に入力が求められます
4. 設定したパスワードで `http://localhost:3000/admin/login` にログイン

**解決策C: パスワードリセットメールを送信（メールリンクが期限切れの場合）**
1. `.env.local` に `ADMIN_OWNER_EMAIL=your-email@example.com` が設定されていることを確認
2. ターミナルで以下を実行：
   ```bash
   npm run send-password-reset
   ```
3. **すぐに**メール内の「Reset password」リンクをクリックしてパスワードを設定（リンクは短時間で期限切れになります）

### 問題: 招待メールのリンクが `http://localhost:3000` を指している
**解決策：**
1. Supabaseダッシュボード → **Authentication** → **URL Configuration** でSite URLを設定
2. または、メール内の「Accept the invite」リンクを直接クリックして、Supabaseの認証ページでパスワードを設定

### エラー: "admin_usersテーブルが見つかりません"
- `supabase-migrations/create-admin-users.sql` が実行されているか確認してください

### エラー: "Auth session missing!"
- ログインが正しく完了していない可能性があります
- メールアドレスとパスワードが正しいか確認してください
- ブラウザのCookieが有効になっているか確認してください

### エラー: "認証が必要です。管理者権限がありません"
- `admin_users` テーブルに該当メールアドレスが登録されているか確認してください
- `is_active` が `true` になっているか確認してください
- SQL Editorで以下を実行して確認：
  ```sql
  SELECT * FROM admin_users WHERE email = 'your-email@example.com';
  ```
