# Vercel本番環境への反映手順

現在のVercelドメイン（`https://real-review.vercel.app/`）で、今回実装した認証機能を本番環境に反映させる手順です。

## 📋 前提条件

- Vercelアカウントにログインできること
- 本番環境のSupabaseプロジェクトが準備されていること
- Resendアカウントが準備されていること
- GitリポジトリがVercelに接続されていること

## 🚀 手順1: 最新のコードをGitにプッシュ

まず、最新の変更をGitリポジトリにプッシュします。

```bash
# 現在のブランチを確認
git status

# 変更をコミット（既にコミット済みの場合はスキップ）
git add .
git commit -m "認証機能の実装を完了"

# mainブランチにプッシュ
git push origin main
```

**注意**: Vercelは`main`ブランチへのプッシュを自動的に検知してデプロイします。

## 🔧 手順2: Vercelの環境変数を設定

Vercelダッシュボードで、必要な環境変数を設定します。

### 2-1. Vercelダッシュボードにアクセス

1. [Vercel Dashboard](https://vercel.com/dashboard) にログイン
2. プロジェクト `real-review`（または該当するプロジェクト名）を選択

### 2-2. 環境変数の設定

1. プロジェクトページで **Settings** をクリック
2. 左側メニューから **Environment Variables** をクリック
3. 以下の環境変数を追加：

#### 必須の環境変数

**Supabase関連：**
```
NEXT_PUBLIC_SUPABASE_URL = 本番環境のSupabaseプロジェクトURL
NEXT_PUBLIC_SUPABASE_ANON_KEY = 本番環境のSupabase anonキー
SUPABASE_SERVICE_ROLE_KEY = 本番環境のSupabase service_roleキー
```

**サイトURL：**
```
NEXT_PUBLIC_SITE_URL = https://real-review.vercel.app
```

**メール送信関連：**
```
EMAIL_SERVICE = resend
EMAIL_API_KEY = ResendのAPIキー
EMAIL_FROM = メール送信元アドレス
```

#### 環境変数の取得方法

**Supabase環境変数：**
1. Supabaseダッシュボード → プロジェクト選択
2. Settings → API
3. Project URL、anon publicキー、service_roleキーをコピー

**Resend環境変数：**
1. Resendダッシュボード → API Keys
2. APIキーをコピー（または新規作成）

**EMAIL_FROMについて：**
- 開発環境で`onboarding@resend.dev`を使用している場合、そのまま使用可能
- ただし、`onboarding@resend.dev`はResendアカウントのメールアドレスにのみ送信可能
- 本番環境で任意のメールアドレスに送信する場合は、カスタムドメインの検証が必要

### 2-3. 環境変数の追加手順

各環境変数を追加：

1. **Key** に環境変数名を入力（例: `NEXT_PUBLIC_SUPABASE_URL`）
2. **Value** に値を入力
3. **Environment** で適用環境を選択：
   - Production（本番環境）
   - Preview（プレビュー環境）
   - Development（開発環境）
   - 通常は **Production** を選択
4. **Add** をクリック

**重要**: `NEXT_PUBLIC_` で始まる環境変数は、クライアント側でも使用されるため、機密情報を含めないでください。

### 2-4. 環境変数の確認

すべての環境変数を追加した後、以下のように表示されることを確認：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `EMAIL_SERVICE`
- `EMAIL_API_KEY`
- `EMAIL_FROM`

## 🔐 手順3: Supabaseの設定

### 3-1. Redirect URLsの設定

Supabaseダッシュボードで、パスワードリセット用のリダイレクトURLを設定します。

1. **Supabaseダッシュボードにログイン**
   - https://supabase.com/dashboard にアクセス

2. **プロジェクトを選択**
   - 本番環境で使用するSupabaseプロジェクトを選択

3. **URL Configurationを開く**
   - 左側メニューから **Authentication** をクリック
   - **URL Configuration** をクリック

4. **Redirect URLsに追加**
   - **Redirect URLs** セクションを確認
   - 以下のURLが登録されているか確認：
     ```
     https://real-review.vercel.app/admin/reset-password
     ```
   - 登録されていない場合は、**Add URL** をクリックして追加
   - URLを入力して **Save** をクリック

5. **Site URLの確認**
   - **Site URL** が `https://real-review.vercel.app` に設定されているか確認
   - 異なる場合は更新

### 3-2. データベーススキーマの確認

本番環境のSupabaseプロジェクトに、必要なテーブルが作成されていることを確認：

1. Supabaseダッシュボード → **Table Editor**
2. 以下のテーブルが存在することを確認：
   - `admin_users` - 管理者ユーザー情報
   - その他の必要なテーブル

3. テーブルが存在しない場合は、`supabase-schema.sql` を実行：
   - **SQL Editor** → **New query**
   - `supabase-schema.sql` の内容をコピー＆ペースト
   - **Run** をクリック

## 📧 手順4: Resendの設定（メール送信）

### 4-1. 開発環境と同じ設定を使用する場合

開発環境で `onboarding@resend.dev` を使用している場合：

1. **EMAIL_FROM の設定**
   - Vercelの環境変数で `EMAIL_FROM = onboarding@resend.dev` を設定

2. **制限事項**
   - `onboarding@resend.dev` は、Resendアカウントのメールアドレスにのみ送信可能
   - 本番環境でも同じ制限が適用されます

### 4-2. カスタムドメインを使用する場合（推奨）

本番環境で任意のメールアドレスに送信する場合は、カスタムドメインの検証が必要です。

詳細は `RESEND_DOMAIN_VERIFICATION_GUIDE.md` を参照してください。

**簡易手順：**
1. Resendダッシュボード → **Domains** → **Add Domain**
2. DNSレコードを設定（TXT、DKIM、SPFなど）
3. ドメインの検証完了を待つ
4. `EMAIL_FROM` を検証済みドメインのメールアドレスに設定（例: `noreply@yourdomain.com`）

**注意**: カスタムドメインの検証には時間がかかる場合があります（数時間〜24時間）。

## 🚀 手順5: Vercelへのデプロイ

### 5-1. 自動デプロイの場合

VercelにGitリポジトリが接続されている場合、`main`ブランチへのプッシュで自動的にデプロイされます。

1. **Gitにプッシュ**
   ```bash
   git push origin main
   ```

2. **Vercelダッシュボードでデプロイを確認**
   - Vercelダッシュボード → プロジェクト → **Deployments**
   - 最新のデプロイメントのステータスを確認
   - **Ready** になれば完了

### 5-2. 手動デプロイの場合

Vercel CLIを使用する場合：

```bash
# Vercel CLIをインストール（未インストールの場合）
npm i -g vercel

# プロジェクトにログイン
vercel login

# 本番環境にデプロイ
vercel --prod
```

### 5-3. 環境変数設定後の再デプロイ

環境変数を追加・変更した後は、再デプロイが必要です：

1. **Vercelダッシュボード → Deployments**
2. 最新のデプロイメントの **…** メニューをクリック
3. **Redeploy** をクリック
4. または、Gitに新しいコミットをプッシュ

## ✅ 手順6: 動作確認

デプロイが完了したら、以下を確認してください。

### 6-1. 基本的な動作確認

1. **サイトが正常に表示される**
   - https://real-review.vercel.app/ にアクセス
   - エラーが表示されていないか確認

2. **ログインページが表示される**
   - https://real-review.vercel.app/admin/login にアクセス
   - ログインフォームが表示されることを確認

### 6-2. 認証機能の確認

1. **ログイン機能**
   - 既存の管理者アカウントでログイン
   - 正常にログインできることを確認

2. **管理者ユーザー追加機能**
   - ログイン後、管理者ユーザーを追加
   - エラーが発生しないことを確認

3. **メール送信機能**
   - 管理者ユーザー追加時にメールが送信されるか確認
   - メールが届くことを確認（開発環境と同じメールアドレスを使用する場合）

4. **パスワードリセット機能**
   - メール内のリンクをクリック
   - `https://real-review.vercel.app/admin/reset-password` に遷移することを確認
   - パスワードを正常に設定できることを確認

### 6-3. 環境変数の確認

Vercelダッシュボードで、環境変数が正しく設定されているか確認：

- `NEXT_PUBLIC_SITE_URL` が `https://real-review.vercel.app` になっているか
- Supabaseの環境変数が本番環境のプロジェクトを指しているか
- Resendの環境変数が正しく設定されているか

## 🔧 トラブルシューティング

### エラー: メールが送信されない

**原因と解決方法：**

1. **ResendのAPIキーが正しくない**
   - Vercelの環境変数 `EMAIL_API_KEY` を確認
   - ResendダッシュボードでAPIキーを再確認

2. **EMAIL_FROMが正しくない**
   - `onboarding@resend.dev` を使用する場合、送信先がResendアカウントのメールアドレスであることを確認
   - カスタムドメインを使用する場合、ドメインが検証されていることを確認

3. **環境変数が反映されていない**
   - 環境変数設定後、Vercelで再デプロイを実行

### エラー: パスワードリセットページに遷移できない

**原因と解決方法：**

1. **SupabaseのRedirect URLsに登録されていない**
   - Supabaseダッシュボード → Authentication → URL Configuration
   - `https://real-review.vercel.app/admin/reset-password` が登録されているか確認

2. **NEXT_PUBLIC_SITE_URLが正しく設定されていない**
   - Vercelの環境変数で `NEXT_PUBLIC_SITE_URL = https://real-review.vercel.app` を確認
   - 環境変数設定後、再デプロイを実行

### エラー: ビルドエラー

**原因と解決方法：**

1. **環境変数が不足している**
   - Vercelダッシュボードで、必要な環境変数がすべて設定されているか確認
   - デプロイメントログを確認

2. **TypeScriptエラー**
   - ローカルで `npm run build` を実行してエラーを確認
   - エラーを修正してから再デプロイ

## 📝 チェックリスト

デプロイ前：

- [ ] 最新のコードがGitリポジトリにプッシュされている
- [ ] Vercelの環境変数がすべて設定されている
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `NEXT_PUBLIC_SITE_URL = https://real-review.vercel.app`
  - [ ] `EMAIL_SERVICE = resend`
  - [ ] `EMAIL_API_KEY`
  - [ ] `EMAIL_FROM`
- [ ] SupabaseのRedirect URLsに `https://real-review.vercel.app/admin/reset-password` が登録されている
- [ ] 本番環境のSupabaseプロジェクトに必要なテーブルが作成されている
- [ ] ローカルでビルドが成功する（`npm run build`）

デプロイ後：

- [ ] サイトが正常に表示される
- [ ] ログイン機能が正常に動作する
- [ ] 管理者ユーザー追加機能が正常に動作する
- [ ] メール送信が正常に動作する（開発環境と同じメールアドレスを使用する場合）
- [ ] パスワードリセット機能が正常に動作する
- [ ] パスワード設定画面に正常に遷移できる

## 🔗 関連ドキュメント

- `DEPLOYMENT_GUIDE.md` - 一般的なデプロイガイド
- `RESEND_DOMAIN_VERIFICATION_GUIDE.md` - Resendドメイン検証の詳細ガイド
- `RESEND_SETUP_CHECKLIST.md` - Resend設定のチェックリスト

## 💡 次のステップ

本番環境で動作確認が完了したら：

1. **カスタムドメインの検討**
   - 自社ドメインでの公開を検討
   - カスタムドメインへの移行手順を検討

2. **セキュリティの強化**
   - パスワードポリシーの確認
   - ログイン試行回数の制限などを検討

3. **監視とログ**
   - エラーログの監視
   - メール送信の成功率を監視
