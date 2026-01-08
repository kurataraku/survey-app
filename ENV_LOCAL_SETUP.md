# .env.local ファイルの設定方法

## 📝 概要

`.env.local` ファイルは、アプリケーションで使用する環境変数を設定するファイルです。このファイルはGitにコミットされないため、機密情報を安全に保存できます。

## 🎯 手順

### 方法1: Cursor（エディタ）で作成（推奨）

1. **Cursorでプロジェクトを開く**
   - 既に開いている場合はそのまま

2. **新しいファイルを作成**
   - 左側のエクスプローラー（ファイル一覧）で `survey-app` フォルダを右クリック
   - 「新しいファイル」を選択
   - ファイル名を **`.env.local`** と入力（先頭のドット（.）を含める）

3. **内容を入力**
   以下のテンプレートをコピー＆ペーストしてください：

```env
# ============================================
# Supabase設定（必須）
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# ============================================
# メール送信設定（お問い合わせ機能用）
# ============================================
# メール送信サービス（現在は 'resend' のみ対応）
EMAIL_SERVICE=resend

# Resend APIキー（必須）
# Resendのダッシュボードから取得してください
EMAIL_API_KEY=re_xxxxxxxxxxxxx

# 送信元メールアドレス（必須）
# Resendで検証済みのドメインのメールアドレスを指定してください
EMAIL_FROM=noreply@yourdomain.com

# サイトURL（任意、管理画面へのリンク用）
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

4. **実際の値を設定**
   - Supabaseの値は既に設定されている場合はそのまま
   - メール送信用の値を設定（下記参照）

5. **保存**
   - `Ctrl + S` で保存

### 方法2: エクスプローラーで作成

1. **エクスプローラーを開く**
   - Windowsキー + E でエクスプローラーを開く
   - 以下のパスに移動：
     ```
     C:\Users\taka-\OneDrive\デスクトップ\project\survey-app
     ```

2. **テキストファイルを作成**
   - フォルダ内の空白部分を右クリック
   - 「新規作成」→「テキスト ドキュメント」をクリック
   - ファイル名を **`.env.local`** に変更
     - 注意: エクスプローラーで `.env.local.txt` になる場合は、ファイル名を変更する際に拡張子も含めて変更してください

3. **内容を入力**
   - ファイルを開いて、上記のテンプレートをコピー＆ペースト

4. **保存して閉じる**

## 🔑 各環境変数の取得方法

### Supabase設定（既に設定済みの可能性があります）

1. [Supabase](https://supabase.com) にログイン
2. プロジェクトを選択
3. 「Settings」→「API」を開く
4. 以下の値をコピー：
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** キー → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** キー → `SUPABASE_SERVICE_ROLE_KEY`

### メール送信設定（Resend）

#### 1. Resendアカウントの作成

1. [Resend](https://resend.com) にアクセス
2. アカウントを作成（無料プランあり）

#### 2. APIキーの取得

1. Resendダッシュボードにログイン
2. 左側のメニューから「API Keys」をクリック
3. 「Create API Key」をクリック
4. 名前を入力（例: "Survey App"）
5. 権限を選択（「Full Access」推奨）
6. 「Add」をクリック
7. 表示されたAPIキーをコピー（`re_` で始まる文字列）
8. **重要**: APIキーは一度しか表示されないため、必ずコピーして保存してください
9. `EMAIL_API_KEY` に貼り付け

#### 3. ドメインの検証（本番環境用）

**開発・テスト環境の場合**:
- Resendの無料プランでは、`onboarding@resend.dev` というテスト用の送信元メールアドレスが使用できます
- この場合は、`EMAIL_FROM=onboarding@resend.dev` と設定してください

**本番環境の場合**:
1. Resendダッシュボードで「Domains」をクリック
2. 「Add Domain」をクリック
3. ドメイン名を入力（例: `yourdomain.com`）
4. 表示されたDNSレコードを設定：
   - ドメインのDNS設定に、Resendが提供するTXTレコードとCNAMEレコードを追加
   - DNS設定の変更が反映されるまで数時間かかる場合があります
5. ドメインが検証されたら、そのドメインのメールアドレスを使用：
   - 例: `EMAIL_FROM=noreply@yourdomain.com`

## ✅ 設定例

### 開発環境の場合

```env
# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# メール送信設定（Resendのテスト用）
EMAIL_SERVICE=resend
EMAIL_API_KEY=re_1234567890abcdefghijklmnopqrstuvwxyz
EMAIL_FROM=onboarding@resend.dev
```

### 本番環境の場合

```env
# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# メール送信設定（検証済みドメイン）
EMAIL_SERVICE=resend
EMAIL_API_KEY=re_1234567890abcdefghijklmnopqrstuvwxyz
EMAIL_FROM=noreply@yourdomain.com
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

## 🔄 開発サーバーの再起動

環境変数を設定・変更した後は、**必ず開発サーバーを再起動**してください：

1. 現在実行中の開発サーバーを停止（`Ctrl + C`）
2. 再度起動：
   ```bash
   npm run dev
   ```

## ⚠️ 注意事項

1. **`.env.local` はGitにコミットしない**
   - 既に `.gitignore` に含まれているため、通常は問題ありません
   - 念のため、Gitにコミットされていないか確認してください

2. **環境変数の値にスペースや引用符は不要**
   - ❌ 間違い: `EMAIL_API_KEY="re_xxxxx"`
   - ✅ 正しい: `EMAIL_API_KEY=re_xxxxx`

3. **コメントは `#` で始まる行**
   - コメント行は無視されます

4. **ファイル名は正確に**
   - `.env.local`（先頭にドット）
   - `.env` や `.env.development` など、他の名前では動作しません

## 🧪 動作確認

設定後、以下で動作確認できます：

1. 開発サーバーを再起動
2. お問い合わせフォーム（`/contact`）から送信
3. 開発サーバーのコンソールでログを確認：
   - `[Contact API] メール送信を試行します` が表示されればOK
   - エラーがあれば、その内容を確認

## 📚 関連ドキュメント

- `CONTACT_EMAIL_SETUP.md` - メール送信の詳細設定
- `ENV_SETUP.md` - Supabase環境変数の設定
- `QUICK_START.md` - クイックスタートガイド
