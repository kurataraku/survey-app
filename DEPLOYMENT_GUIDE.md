# 本番環境へのデプロイガイド

このガイドでは、実装した認証機能を含むアプリケーションを本番環境に反映させる手順を説明します。

## 📋 前提条件

- 本番環境のURLが決まっていること（例: `https://yourdomain.com`）
- Supabaseプロジェクトが本番環境用に設定されていること
- Resendアカウントが設定されていること
- Gitリポジトリが準備されていること（GitHub、GitLabなど）

## 🚀 デプロイ手順

### ステップ1: 環境変数の準備

本番環境で必要な環境変数を確認・設定します。

#### 必要な環境変数一覧

```
NEXT_PUBLIC_SUPABASE_URL=本番環境のSupabaseプロジェクトURL
NEXT_PUBLIC_SUPABASE_ANON_KEY=本番環境のSupabase anonキー
SUPABASE_SERVICE_ROLE_KEY=本番環境のSupabase service_roleキー
NEXT_PUBLIC_SITE_URL=本番環境のサイトURL（例: https://yourdomain.com）
EMAIL_SERVICE=resend
EMAIL_API_KEY=ResendのAPIキー
EMAIL_FROM=検証済みドメインのメールアドレス（例: noreply@yourdomain.com）
```

#### 環境変数の取得方法

**1. Supabase環境変数**
- Supabaseダッシュボード → Settings → API
- Project URL、anon publicキー、service_roleキーをコピー

**2. Resend環境変数**
- Resendダッシュボード → API Keys
- APIキーをコピー（または新規作成）

**3. NEXT_PUBLIC_SITE_URL**
- 本番環境のURLを設定（例: `https://yourdomain.com`）
- このURLは、パスワードリセットメールのリンクなどで使用されます

### ステップ2: Supabaseの設定

#### 2-1. Redirect URLsの設定

Supabaseダッシュボードで、パスワードリセット用のリダイレクトURLを設定します。

1. Supabaseダッシュボードにログイン
2. プロジェクトを選択
3. **Authentication** → **URL Configuration** を開く
4. **Redirect URLs** セクションに以下を追加：
   ```
   https://yourdomain.com/admin/reset-password
   ```
   （`yourdomain.com`を実際のドメインに置き換えてください）

5. **保存**をクリック

#### 2-2. 本番環境のSupabaseプロジェクト

開発環境とは別のSupabaseプロジェクトを使用する場合：
- データベーススキーマ（`supabase-schema.sql`）が本番環境に適用されていることを確認
- `admin_users`テーブルが存在することを確認

### ステップ3: Resendの設定

#### 3-1. ドメインの検証

本番環境でメール送信を行うには、ドメインの検証が必要です。

詳細な手順は `RESEND_DOMAIN_VERIFICATION_GUIDE.md` を参照してください。

**概要：**
1. Resendダッシュボード → Domains
2. ドメインを追加（例: `yourdomain.com`）
3. DNSレコードを設定（TXT、CNAME、MX、DMARC）
4. 検証完了を待つ（数時間〜24時間）

#### 3-2. 送信元メールアドレスの設定

検証済みドメインのメールアドレスを `EMAIL_FROM` に設定します。

例：
```
EMAIL_FROM=noreply@yourdomain.com
```

### ステップ4: デプロイ方法の選択

Next.jsアプリケーションのデプロイ方法には、以下の選択肢があります。

#### 方法A: Vercel（推奨）

VercelはNext.js開発元が提供するホスティングサービスで、最も簡単にデプロイできます。

**手順：**
1. [Vercel](https://vercel.com)にログイン（GitHubアカウントでログイン可能）
2. **Add New Project** をクリック
3. Gitリポジトリを選択（GitHub、GitLab、Bitbucketなど）
4. プロジェクトをインポート
5. **Environment Variables** セクションで、必要な環境変数を設定
6. **Deploy** をクリック

**環境変数の設定：**
- Vercelダッシュボード → プロジェクト → Settings → Environment Variables
- 上記「ステップ1」の環境変数をすべて追加

**自動デプロイ：**
- `main`ブランチへのプッシュで自動的にデプロイされます
- プルリクエストごとにプレビュー環境が作成されます

#### 方法B: Netlify

NetlifyもNext.jsアプリケーションのデプロイに適しています。

**手順：**
1. [Netlify](https://netlify.com)にログイン
2. **Add new site** → **Import an existing project**
3. Gitリポジトリを接続
4. ビルド設定：
   - Build command: `npm run build`
   - Publish directory: `.next`
5. **Environment variables** で環境変数を設定
6. **Deploy site** をクリック

**環境変数の設定：**
- Netlifyダッシュボード → Site settings → Environment variables
- 上記「ステップ1」の環境変数をすべて追加

#### 方法C: 独自サーバー（VPS、AWS、GCPなど）

独自のサーバーを使用する場合の手順：

**1. サーバーの準備**
```bash
# Node.jsとnpmをインストール（Node.js 18以上が必要）
# 例: Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2をインストール（プロセス管理）
sudo npm install -g pm2
```

**2. アプリケーションのクローン**
```bash
git clone <your-repository-url>
cd survey-app
npm install
```

**3. 環境変数の設定**
```bash
# .env.productionファイルを作成
nano .env.production

# 環境変数を記述
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# ... その他の環境変数
```

**4. ビルドと起動**
```bash
# ビルド
npm run build

# PM2で起動
pm2 start npm --name "survey-app" -- start

# 自動起動設定
pm2 startup
pm2 save
```

**5. Nginxの設定（リバースプロキシ）**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### ステップ5: デプロイ後の確認

デプロイが完了したら、以下を確認してください。

#### 5-1. 基本的な動作確認

1. **サイトが正常に表示されるか確認**
   - 本番URL（例: `https://yourdomain.com`）にアクセス
   - エラーが表示されていないか確認

2. **認証機能の確認**
   - `/admin/login` にアクセス
   - ログインが正常に動作するか確認

3. **パスワードリセット機能の確認**
   - 管理者ユーザーを追加
   - メールが正常に送信されるか確認
   - メール内のリンクからパスワード設定画面に遷移できるか確認
   - パスワードを正常に設定できるか確認

#### 5-2. 環境変数の確認

本番環境で使用されている環境変数が正しく設定されているか確認：

- `NEXT_PUBLIC_SITE_URL` が本番環境のURLになっているか
- Supabaseの環境変数が本番環境のプロジェクトを指しているか
- Resendの環境変数が正しく設定されているか

#### 5-3. SupabaseのRedirect URLsの確認

Supabaseダッシュボードで、Redirect URLsに本番環境のURLが登録されているか確認：

```
https://yourdomain.com/admin/reset-password
```

### ステップ6: トラブルシューティング

#### エラー: メールが送信されない

**原因と解決方法：**
1. **Resendのドメインが検証されていない**
   - Resendダッシュボードでドメインの検証状況を確認
   - `RESEND_DOMAIN_VERIFICATION_GUIDE.md` を参照

2. **EMAIL_FROMが検証済みドメインのメールアドレスでない**
   - `EMAIL_FROM` が検証済みドメインのメールアドレスであることを確認
   - 例: `noreply@yourdomain.com`（`yourdomain.com`が検証済みドメイン）

3. **APIキーが正しくない**
   - ResendダッシュボードでAPIキーを確認
   - 環境変数 `EMAIL_API_KEY` が正しく設定されているか確認

#### エラー: パスワードリセットページに遷移できない

**原因と解決方法：**
1. **SupabaseのRedirect URLsに本番環境のURLが登録されていない**
   - Supabaseダッシュボード → Authentication → URL Configuration
   - Redirect URLsに `https://yourdomain.com/admin/reset-password` を追加

2. **NEXT_PUBLIC_SITE_URLが正しく設定されていない**
   - 環境変数 `NEXT_PUBLIC_SITE_URL` が本番環境のURLになっているか確認
   - 設定後、アプリケーションを再デプロイ

#### エラー: ビルドエラー

**原因と解決方法：**
1. **環境変数が不足している**
   - 必要な環境変数がすべて設定されているか確認
   - `package.json` の `build` スクリプトでビルドエラーが発生していないか確認

2. **依存関係の問題**
   ```bash
   npm install
   npm run build
   ```
   - ローカルでビルドが成功することを確認してからデプロイ

## 📝 チェックリスト

デプロイ前に確認：

- [ ] 本番環境のSupabaseプロジェクトが準備されている
- [ ] 本番環境の環境変数がすべて設定されている
- [ ] SupabaseのRedirect URLsに本番環境のURLが登録されている
- [ ] Resendのドメインが検証されている（本番環境用）
- [ ] `EMAIL_FROM` が検証済みドメインのメールアドレスになっている
- [ ] `NEXT_PUBLIC_SITE_URL` が本番環境のURLになっている
- [ ] ローカルでビルドが成功する（`npm run build`）

デプロイ後：

- [ ] サイトが正常に表示される
- [ ] ログイン機能が正常に動作する
- [ ] 管理者ユーザー追加機能が正常に動作する
- [ ] メール送信が正常に動作する
- [ ] パスワードリセット機能が正常に動作する
- [ ] パスワード設定画面に正常に遷移できる

## 🔗 関連ドキュメント

- `RESEND_DOMAIN_VERIFICATION_GUIDE.md` - Resendドメイン検証の詳細ガイド
- `RESEND_SETUP_CHECKLIST.md` - Resend設定のチェックリスト
- `SUPABASE_SETUP.md` - Supabase設定ガイド
