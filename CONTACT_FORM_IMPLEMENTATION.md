# お問い合わせフォーム実装まとめ

## 実装日
2026年1月8日

## 追加/変更したファイル一覧

### データベース
- `supabase-migrations/create-contact-tables.sql` - テーブル作成とRLSポリシー

### 公開側フォーム
- `app/contact/page.tsx` - お問い合わせフォームページ
- `app/api/contact/route.ts` - お問い合わせ送信API

### 管理画面
- `app/admin/settings/contact/page.tsx` - 通知先メール設定画面
- `app/admin/contacts/page.tsx` - お問い合わせ一覧画面
- `app/admin/contacts/[id]/page.tsx` - お問い合わせ詳細画面
- `app/api/admin/settings/contact/route.ts` - 通知先設定API
- `app/api/admin/contacts/route.ts` - お問い合わせ一覧取得API
- `app/api/admin/contacts/[id]/route.ts` - お問い合わせ詳細・更新API

### その他
- `app/admin/page.tsx` - 管理画面メニューに「お問い合わせ管理」を追加

## 環境変数一覧

以下の環境変数を `.env.local` に追加してください：

```env
# メール送信サービス（resend, sendgrid, postmark など）
EMAIL_SERVICE=resend

# メール送信APIキー（Resendの場合）
EMAIL_API_KEY=re_xxxxxxxxxxxxx

# 送信元メールアドレス
EMAIL_FROM=noreply@example.com

# サイトURL（管理画面へのリンク用、任意）
NEXT_PUBLIC_SITE_URL=https://example.com
```

### メール送信サービスの設定

#### Resend を使用する場合
1. [Resend](https://resend.com) にアカウントを作成
2. APIキーを取得
3. ドメインを検証（送信元メールアドレスに使用）
4. `.env.local` に以下を設定：
   ```env
   EMAIL_SERVICE=resend
   EMAIL_API_KEY=re_xxxxxxxxxxxxx
   EMAIL_FROM=noreply@yourdomain.com
   ```

#### その他のメールサービス
現在は Resend のみ対応しています。SendGrid や Postmark を使用する場合は、`app/api/contact/route.ts` の `sendNotificationEmail` 関数を拡張してください。

## SupabaseのSQL実行手順

1. Supabaseダッシュボードにログイン
2. SQL Editor を開く
3. `supabase-migrations/create-contact-tables.sql` の内容をコピー＆ペースト
4. 実行

または、Supabase CLI を使用している場合：
```bash
supabase db push
```

## 動作確認手順

### 1. データベースのセットアップ
- SupabaseでSQLを実行してテーブルを作成
- RLSポリシーが正しく設定されているか確認

### 2. 環境変数の設定
- `.env.local` にメール送信関連の環境変数を設定

### 3. 公開側フォームのテスト
1. `http://localhost:3000/contact` にアクセス
2. フォームに必要事項を入力
3. 送信ボタンをクリック
4. 成功メッセージが表示されることを確認
5. Supabaseの `contact_messages` テーブルにデータが保存されているか確認

### 4. メール通知のテスト
1. 管理画面で通知先メールアドレスを設定（`/admin/settings/contact`）
2. 再度お問い合わせフォームから送信
3. 設定したメールアドレスに通知メールが届くことを確認

### 5. 管理画面のテスト
1. `/admin/contacts` にアクセス
2. お問い合わせ一覧が表示されることを確認
3. フィルター（すべて/未読/既読）が動作することを確認
4. 詳細ページ（`/admin/contacts/[id]`）で以下を確認：
   - 問い合わせ内容が正しく表示される
   - 既読/未読の切り替えが動作する
   - IPアドレス、User-Agentが表示される（取得できた場合）

### 6. レート制限のテスト
1. 同じIPアドレスから60秒以内に2回送信を試みる
2. 2回目は「送信頻度が高すぎます」というエラーが返されることを確認

### 7. バリデーションのテスト
- メールアドレスが未入力または無効な形式の場合、エラーが表示される
- 件名が未入力の場合、エラーが表示される
- お問い合わせ内容が未入力または2000文字を超える場合、エラーが表示される

## 注意事項

### 認証について
現在、管理画面のAPIには簡易的な認証チェックのみ実装されています（TODOコメントあり）。
本番環境では、Supabase Auth などを使用した適切な認証を実装してください。

### レート制限について
現在のレート制限はメモリベースの簡易実装です。サーバーを再起動するとリセットされます。
本番環境では、Redis などを使用した永続的なレート制限の実装を推奨します。

### メール送信エラーについて
メール送信に失敗しても、お問い合わせはデータベースに保存されます。
管理画面で確認できるため、メール送信が失敗してもデータは失われません。

## トラブルシューティング

### メールが届かない
1. `EMAIL_API_KEY` が正しく設定されているか確認
2. `EMAIL_FROM` のドメインがメールサービスで検証されているか確認
3. 通知先メールアドレスが正しく設定されているか確認（`/admin/settings/contact`）
4. サーバーログでエラーを確認

### お問い合わせが保存されない
1. Supabaseのテーブルが正しく作成されているか確認
2. RLSポリシーが正しく設定されているか確認
3. サーバーログでエラーを確認

### 管理画面にアクセスできない
1. 認証が正しく実装されているか確認
2. SupabaseのRLSポリシーが管理者のみアクセス可能になっているか確認
