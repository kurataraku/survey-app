# Vercelデプロイガイド

## デプロイ後の環境変数設定

VercelのWebダッシュボードからデプロイを実行した後、以下の環境変数を設定する必要があります。

### 1. Vercelダッシュボードで環境変数を設定

1. Vercelダッシュボードでプロジェクトを開く
2. 「Settings」→「Environment Variables」をクリック
3. 以下の環境変数を追加：

#### 必須環境変数

```
NEXT_PUBLIC_SUPABASE_URL
```
- **値**: SupabaseのProject URL（例: `https://xxxxx.supabase.co`）
- **環境**: Production, Preview, Development すべてに設定

```
NEXT_PUBLIC_SUPABASE_ANON_KEY
```
- **値**: Supabaseのanon publicキー
- **環境**: Production, Preview, Development すべてに設定

```
SUPABASE_SERVICE_ROLE_KEY
```
- **値**: Supabaseのservice_roleキー（機密情報）
- **環境**: Production, Preview, Development すべてに設定
- **注意**: このキーは機密情報のため、慎重に取り扱ってください

```
NEXT_PUBLIC_SITE_URL
```
- **値**: デプロイ後のサイトURL（例: `https://your-project.vercel.app`）
- **環境**: Production, Preview, Development すべてに設定
- **注意**: デプロイ後に自動生成されるURLを使用するか、カスタムドメインを設定した場合はそのURLを使用

#### オプション環境変数（お問い合わせフォームを使用する場合）

```
RESEND_API_KEY
```
- **値**: Resend APIキー
- **環境**: Production, Preview, Development すべてに設定
- **取得方法**: [Resend](https://resend.com) にログインしてAPIキーを取得

```
EMAIL_FROM
```
- **値**: 送信元メールアドレス（例: `onboarding@resend.dev` または `noreply@yourdomain.com`）
- **環境**: Production, Preview, Development すべてに設定
- **注意**: 開発環境では `onboarding@resend.dev` を使用（Resendアカウントのメールアドレス宛のみ送信可能）

### 2. 環境変数の取得方法

#### Supabaseの環境変数

1. [Supabase](https://supabase.com) にログイン
2. プロジェクトを選択
3. 「Settings」→「API」を開く
4. 以下の値をコピー：
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** キー → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** キー → `SUPABASE_SERVICE_ROLE_KEY`

#### Resend APIキー（お問い合わせフォームを使用する場合）

1. [Resend](https://resend.com) にログイン
2. 「API Keys」を開く
3. 新しいAPIキーを作成または既存のキーをコピー
4. `RESEND_API_KEY` に設定

### 3. 環境変数設定後の再デプロイ

環境変数を設定した後、以下のいずれかの方法で再デプロイしてください：

1. **自動再デプロイ**: 環境変数を追加すると、Vercelが自動的に再デプロイを開始します
2. **手動再デプロイ**: 「Deployments」タブから最新のデプロイを選択し、「Redeploy」をクリック

### 4. デプロイの確認

デプロイが完了したら、以下を確認してください：

1. **デプロイステータス**: Vercelダッシュボードで「Ready」になっているか確認
2. **サイトアクセス**: デプロイされたURLにアクセスして、サイトが正常に表示されるか確認
3. **エラーログ**: 「Deployments」タブでビルドログを確認し、エラーがないか確認

### 5. よくある問題と解決方法

#### 問題: 環境変数が反映されない

**解決方法**:
- 環境変数を設定した後、必ず再デプロイを実行してください
- 環境変数の値に余分なスペースや改行が含まれていないか確認してください
- Production, Preview, Development すべての環境に設定されているか確認してください

#### 問題: ビルドエラーが発生する

**解決方法**:
- 「Deployments」タブでビルドログを確認し、エラーメッセージを確認してください
- 環境変数が正しく設定されているか確認してください
- `package.json` の依存関係が正しくインストールされているか確認してください

#### 問題: サイトが表示されない

**解決方法**:
- デプロイステータスが「Ready」になっているか確認してください
- ブラウザのコンソールでエラーがないか確認してください
- Supabaseの接続設定が正しいか確認してください

### 6. カスタムドメインの設定（オプション）

カスタムドメインを設定する場合：

1. Vercelダッシュボードで「Settings」→「Domains」を開く
2. ドメインを追加
3. DNS設定を更新（Vercelの指示に従う）
4. `NEXT_PUBLIC_SITE_URL` をカスタムドメインに更新

### 7. 本番環境の確認事項

デプロイ前に以下を確認してください：

- [ ] 環境変数がすべて設定されている
- [ ] SupabaseのRLSポリシーが正しく設定されている
- [ ] ダミーデータが削除されている
- [ ] 集計データが正しく計算されている
- [ ] SEO設定（sitemap, robots.txt）が正しく動作している
- [ ] お問い合わせフォームが正しく動作している（使用する場合）

## サポート

問題が発生した場合は、Vercelのダッシュボードでビルドログを確認し、エラーメッセージを参照してください。
