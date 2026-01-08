# お問い合わせメール通知の設定方法

## 必要な環境変数

`.env.local` ファイルに以下の環境変数を追加してください：

```env
# メール送信サービス（resend, sendgrid, postmark など）
# 現在は 'resend' のみ対応
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

## Resendの設定手順

1. **Resendアカウントの作成**
   - https://resend.com にアクセス
   - アカウントを作成

2. **APIキーの取得**
   - Resendダッシュボードにログイン
   - 「API Keys」セクションからAPIキーを生成
   - 生成されたAPIキーを `EMAIL_API_KEY` に設定

3. **ドメインの検証（本番環境の場合）**

   **開発環境の場合（簡単な方法）**:
   - `resend.dev` ドメインはテスト用で、**自分のメールアドレス（Resendアカウントのメールアドレス）にしか送信できません**
   - 開発環境では、管理画面（`/admin/settings/contact`）の通知先メールアドレスを**自分のメールアドレス**に設定してください
   - `EMAIL_FROM=onboarding@resend.dev` のまま使用できます

   **本番環境の場合**:
   - 「Domains」セクションでドメインを追加
   - DNSレコードを設定してドメインを検証
   - 検証後、そのドメインのメールアドレスを `EMAIL_FROM` に設定

4. **テスト送信**
   - お問い合わせフォームから送信
   - サーバーログ（開発サーバーのコンソール）でエラーを確認
   - メールが届かない場合は、ログのエラーメッセージを確認

## トラブルシューティング

### メールが届かない場合

1. **環境変数の確認**
   - `.env.local` に `EMAIL_API_KEY` と `EMAIL_FROM` が設定されているか確認
   - 開発サーバーを再起動（環境変数の変更を反映）

2. **サーバーログの確認**
   - 開発サーバーのコンソールで以下のログを確認：
     - `[Contact API] メール送信を試行します`
     - `[Email] メール送信設定確認`
     - `[Email] Resend API レスポンス`
     - エラーメッセージがあれば、その内容を確認

3. **Resend APIの確認**
   - Resendダッシュボードの「Logs」セクションで送信履歴を確認
   - エラーがあれば、その内容を確認

4. **よくあるエラー**

   - `メール送信APIキーが設定されていません`: `EMAIL_API_KEY` が設定されていない
   - `送信元メールアドレスが設定されていません`: `EMAIL_FROM` が設定されていない
   - `Resend API error (422)`: ドメインが検証されていない、または無効なメールアドレス
   - `Resend API error (401)`: APIキーが無効
   - **`resend.dev domain can only send to your own email address`**: 
     - **原因**: `resend.dev` ドメインはテスト用で、Resendアカウントのメールアドレスにしか送信できません
     - **解決方法（開発環境）**: 管理画面（`/admin/settings/contact`）の通知先メールアドレスを**自分のメールアドレス（Resendアカウントのメールアドレス）**に設定してください
     - **解決方法（本番環境）**: ドメインを検証して、検証済みドメインのメールアドレスを `EMAIL_FROM` に設定してください

## 管理画面での通知先設定

1. `/admin/settings/contact` にアクセス
2. 「通知先メールアドレス」にメールアドレスを入力（複数の場合はカンマ区切り）
3. 「保存」をクリック

設定したメールアドレスに、お問い合わせが届いた際に通知メールが送信されます。
