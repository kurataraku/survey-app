# Resendドメイン検証ガイド（本番環境向け）

本番環境でResendアカウントのメールアドレス以外にもメール送信できるようにするための、カスタムドメイン検証手順です。

## 📋 概要

`onboarding@resend.dev`を使用する場合、Resendアカウントのメールアドレスにのみ送信可能という制限があります。本番環境で任意のメールアドレスに送信するには、独自ドメインをResendで検証する必要があります。

## ✅ 前提条件

- Resendアカウントを持っていること
- 使用したいドメインのDNS管理権限を持っていること
- ドメインがすでに取得されていること

## 🚀 ステップ1: Resendダッシュボードでドメインを追加

1. **Resendダッシュボードにログイン**
   - https://resend.com にアクセス
   - アカウントにログイン

2. **Domainsセクションを開く**
   - 左側のメニューから「**Domains**」をクリック

3. **ドメインを追加**
   - 「**Add Domain**」ボタンをクリック
   - ドメイン名を入力（例: `example.com`）
     - **注意**: `www`や`http://`、`https://`は含めない
     - サブドメインも可能（例: `mail.example.com`）
   - 「**Add**」をクリック

4. **DNSレコードを確認**
   - Resendが表示するDNSレコードを確認
   - 以下のレコードが表示されます：
     - **Domain Verification (TXT)** - **必須**: ドメイン検証用
     - **DKIM (TXT)** - **必須**: メール認証用（`resend._domainkey`）
     - **SPF (MX + TXT)** - **推奨**: メール送信の信頼性向上
     - **DMARC (TXT)** - **オプション**: メール認証ポリシー

   **重要**: ドメイン検証には以下が**必須**です：
   - ✅ **Domain Verification (TXT)** - 必ず設定してください
   - ✅ **DKIM (TXT)** - `resend._domainkey` のTXTレコード、必ず設定してください
   - ⚠️ **SPF (MX + TXT)** - 設定を推奨（メールの信頼性向上）
   - ⚠️ **DMARC (TXT)** - オプション（後で設定可能）

## 🔧 ステップ2: DNSレコードを設定

DNSプロバイダの管理画面で、Resendが指定したDNSレコードを追加します。

### 例1: Cloudflareの場合

1. **Cloudflareダッシュボードにログイン**
   - https://dash.cloudflare.com にアクセス

2. **ドメインを選択**
   - ドメイン一覧から対象のドメインをクリック

3. **DNS設定を開く**
   - 左側メニューから「**DNS**」→「**Records**」をクリック

4. **Domain Verification (TXT)レコードを追加**（必須）
   - 「**Add record**」をクリック
   - **Type**: `TXT`を選択
   - **Name**: Resendが表示する値（通常は`@`またはルートドメイン）
   - **Content**: Resendが表示する「Domain Verification」のTXTレコードの値
   - **TTL**: `Auto`または`3600`
   - 「**Save**」をクリック

5. **DKIM (TXT)レコードを追加**（必須）
   - 「**Add record**」をクリック
   - **Type**: `TXT`を選択
   - **Name**: `resend._domainkey`（Resendが表示する値）
   - **Content**: Resendが表示する「DKIM」のTXTレコードの値（`p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ...`で始まる長い文字列）
   - **TTL**: `Auto`または`3600`
   - 「**Save**」をクリック

6. **SPF (MX)レコードを追加**（推奨）
   - 「**Add record**」をクリック
   - **Type**: `MX`を選択
   - **Name**: `send`（Resendが表示する値）
   - **Mail server**: `feedback-smtp.ap-northeast-1.amazonses.com`（Resendが表示する値、リージョンによって異なる場合があります）
   - **Priority**: `10`（Resendが表示する値）
   - **TTL**: `Auto`または`3600`
   - 「**Save**」をクリック

7. **SPF (TXT)レコードを追加**（推奨）
   - 「**Add record**」をクリック
   - **Type**: `TXT`を選択
   - **Name**: `send`（Resendが表示する値）
   - **Content**: `v=spf1 include:amazonses.com ~all`（Resendが表示する値）
   - **TTL**: `Auto`または`3600`
   - 「**Save**」をクリック

8. **DMARC (TXT)レコードを追加**（オプション）
   - 「**Add record**」をクリック
   - **Type**: `TXT`を選択
   - **Name**: `_dmarc`（Resendが表示する値）
   - **Content**: `v=DMARC1; p=none;`（Resendが表示する値）
   - **TTL**: `Auto`または`3600`
   - 「**Save**」をクリック

### 例2: AWS Route 53の場合

1. **Route 53コンソールにログイン**
   - https://console.aws.amazon.com/route53 にアクセス

2. **ホストゾーンを選択**
   - 「**Hosted zones**」をクリック
   - 対象のドメインをクリック

3. **Domain Verification (TXT)レコードを追加**（必須）
   - 「**Create record**」をクリック
   - **Record name**: Resendが表示する値（通常はルートドメインまたは`@`）
   - **Record type**: `TXT`を選択
   - **Value**: Resendが表示する「Domain Verification」のTXTレコードの値
   - 「**Create records**」をクリック

4. **DKIM (TXT)レコードを追加**（必須）
   - 「**Create record**」をクリック
   - **Record name**: `resend._domainkey`（Resendが表示する値）
   - **Record type**: `TXT`を選択
   - **Value**: Resendが表示する「DKIM」のTXTレコードの値
   - 「**Create records**」をクリック

5. **SPF (MX)レコードを追加**（推奨）
   - 「**Create record**」をクリック
   - **Record name**: `send`（Resendが表示する値）
   - **Record type**: `MX`を選択
   - **Value**: `feedback-smtp.ap-northeast-1.amazonses.com`（Resendが表示する値、リージョンによって異なる場合があります）
   - **Priority**: `10`（Resendが表示する値）
   - 「**Create records**」をクリック

6. **SPF (TXT)レコードを追加**（推奨）
   - 「**Create record**」をクリック
   - **Record name**: `send`（Resendが表示する値）
   - **Record type**: `TXT`を選択
   - **Value**: `v=spf1 include:amazonses.com ~all`（Resendが表示する値）
   - 「**Create records**」をクリック

7. **DMARC (TXT)レコードを追加**（オプション）
   - 「**Create record**」をクリック
   - **Record name**: `_dmarc`（Resendが表示する値）
   - **Record type**: `TXT`を選択
   - **Value**: `v=DMARC1; p=none;`（Resendが表示する値）
   - 「**Create records**」をクリック

### 例3: お名前.comの場合

1. **お名前.com Naviにログイン**
   - https://www.onamae.com にアクセス

2. **ドメインを選択**
   - 「**ドメイン**」→「**DNS関連機能の設定**」をクリック
   - 対象のドメインを選択

3. **DNSレコード設定を開く**
   - 「**DNSレコード設定を利用する**」を選択
   - 「**設定する**」をクリック

4. **Domain Verification (TXT)レコードを追加**（必須）
   - 「**TXT**」を選択
   - **ホスト名**: Resendが表示する値（通常は`@`）
   - **TXT値**: Resendが表示する「Domain Verification」のTXTレコードの値
   - 「**追加**」をクリック

5. **DKIM (TXT)レコードを追加**（必須）
   - 「**TXT**」を選択
   - **ホスト名**: `resend._domainkey`（Resendが表示する値）
   - **TXT値**: Resendが表示する「DKIM」のTXTレコードの値
   - 「**追加**」をクリック

6. **SPF (MX)レコードを追加**（推奨）
   - 「**MX**」を選択
   - **ホスト名**: `send`（Resendが表示する値）
   - **優先度**: `10`（Resendが表示する値）
   - **値**: `feedback-smtp.ap-northeast-1.amazonses.com`（Resendが表示する値、リージョンによって異なる場合があります）
   - 「**追加**」をクリック

7. **SPF (TXT)レコードを追加**（推奨）
   - 「**TXT**」を選択
   - **ホスト名**: `send`（Resendが表示する値）
   - **TXT値**: `v=spf1 include:amazonses.com ~all`（Resendが表示する値）
   - 「**追加**」をクリック

8. **DMARC (TXT)レコードを追加**（オプション）
   - 「**TXT**」を選択
   - **ホスト名**: `_dmarc`（Resendが表示する値）
   - **TXT値**: `v=DMARC1; p=none;`（Resendが表示する値）
   - 「**追加**」をクリック

6. **変更を保存**
   - すべてのレコードを追加後、「**確認画面へ進む**」をクリック
   - 内容を確認して「**設定する**」をクリック

### その他のDNSプロバイダの場合

一般的な手順：

1. DNS管理画面にログイン
2. 対象ドメインのDNS設定を開く

3. **Domain Verification (TXT)レコードを追加**（必須）
   - レコードタイプ: `TXT`
   - ホスト名/Name: Resendが表示する値（通常は`@`またはルートドメイン）
   - 値/Value: Resendが表示する「Domain Verification」のTXTレコードの値

4. **DKIM (TXT)レコードを追加**（必須）
   - レコードタイプ: `TXT`
   - ホスト名/Name: `resend._domainkey`（Resendが表示する値）
   - 値/Value: Resendが表示する「DKIM」のTXTレコードの値

5. **SPF (MX)レコードを追加**（推奨）
   - レコードタイプ: `MX`
   - ホスト名/Name: `send`（Resendが表示する値）
   - 値/Target: `feedback-smtp.ap-northeast-1.amazonses.com`（Resendが表示する値、リージョンによって異なる場合があります）
   - 優先度/Priority: `10`（Resendが表示する値）

6. **SPF (TXT)レコードを追加**（推奨）
   - レコードタイプ: `TXT`
   - ホスト名/Name: `send`（Resendが表示する値）
   - 値/Value: `v=spf1 include:amazonses.com ~all`（Resendが表示する値）

7. **DMARC (TXT)レコードを追加**（オプション）
   - レコードタイプ: `TXT`
   - ホスト名/Name: `_dmarc`（Resendが表示する値）
   - 値/Value: `v=DMARC1; p=none;`（Resendが表示する値）

## 📝 どのレコードを設定すべきか？

ResendのDNSレコード設定画面には複数のレコードが表示されますが、**最低限必要なのは以下2つ**です：

### ✅ 必須レコード（ドメイン検証に必要）

1. **Domain Verification (TXT)**
   - **Type**: `TXT`
   - **Name**: 通常は`@`またはルートドメイン
   - **Content**: Resendが表示する値
   - **目的**: ドメインの所有権を確認

2. **DKIM (TXT)**
   - **Type**: `TXT`
   - **Name**: `resend._domainkey`
   - **Content**: `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ...`で始まる長い文字列
   - **目的**: メールの認証と信頼性向上

### ⚠️ 推奨レコード（メール送信の信頼性向上）

3. **SPF (MX)**
   - **Type**: `MX`
   - **Name**: `send`
   - **Content**: `feedback-smtp.ap-northeast-1.amazonses.com`（リージョンによって異なる）
   - **Priority**: `10`
   - **目的**: メール送信サーバーの指定

4. **SPF (TXT)**
   - **Type**: `TXT`
   - **Name**: `send`
   - **Content**: `v=spf1 include:amazonses.com ~all`
   - **目的**: 送信元メールサーバーの認証

### 🔵 オプションレコード（後で設定可能）

5. **DMARC (TXT)**
   - **Type**: `TXT`
   - **Name**: `_dmarc`
   - **Content**: `v=DMARC1; p=none;`
   - **目的**: メール認証ポリシーの設定

**推奨設定順序:**
1. まず**必須レコード**（Domain Verification + DKIM）を設定して検証
2. 検証が成功したら、**推奨レコード**（SPF）を追加
3. 必要に応じて**DMARC**を追加

## ⏱️ ステップ3: DNSレコードの反映を待つ

DNSレコードの反映には時間がかかります：

- **通常**: 数分〜30分程度
- **最大**: 48時間（通常はもっと早く反映されます）

**確認方法:**

コマンドラインで確認できます：

```bash
# Domain Verification (TXT)レコードの確認
nslookup -type=TXT yourdomain.com

# DKIM (TXT)レコードの確認
nslookup -type=TXT resend._domainkey.yourdomain.com

# SPF (MX)レコードの確認
nslookup -type=MX send.yourdomain.com

# SPF (TXT)レコードの確認
nslookup -type=TXT send.yourdomain.com
```

または、オンラインツールを使用：

- https://mxtoolbox.com/
- https://dnschecker.org/

## ✅ ステップ4: Resendでドメインを検証

1. **Resendダッシュボードに戻る**
   - 「**Domains**」セクションを開く
   - 追加したドメインを選択

2. **検証を実行**
   - 「**Verify**」ボタンをクリック
   - ResendがDNSレコードをチェックします

3. **検証結果を確認**
   - 検証が成功すると、ステータスが「**Verified**」に変わります
   - 各DNSレコードの検証状況が表示されます
   - **必須レコード**（Domain Verification + DKIM）が両方とも検証成功していることを確認

4. **検証に失敗した場合**
   - **必須レコード**（Domain Verification + DKIM）が両方とも設定されているか確認
   - DNSレコードが正しく設定されているか再確認
   - DNSレコードの反映を待つ（反映まで時間がかかる場合があります）
   - レコードの値にスペースや余分な文字がないか確認
   - レコードのName（ホスト名）が正しいか確認（特に`resend._domainkey`）

## 🔄 ステップ5: 環境変数を更新

### 「検証済みドメイン」とは？

**検証済みドメイン**とは、Resendダッシュボードで「Verified」ステータスになっているドメインのことです。

**具体例:**
- あなたが所有するドメイン: `example.com`
- Resendダッシュボードで`example.com`を追加
- DNSレコードを設定して検証を実行
- 検証が成功すると、`example.com`が「**検証済みドメイン**」になります

**検証済みドメインの確認方法:**
1. Resendダッシュボードの「**Domains**」セクションを開く
2. 追加したドメインのステータスが「**Verified**」になっていることを確認

### 検証済みドメインのメールアドレスとは？

検証済みドメインのメールアドレスとは、**検証済みドメインを使用したメールアドレス**のことです。

**具体例:**
- 検証済みドメイン: `example.com`
- 検証済みドメインのメールアドレス例:
  - `noreply@example.com` ✅
  - `hello@example.com` ✅
  - `info@example.com` ✅
  - `admin@example.com` ✅

**検証されていないドメインのメールアドレス（使用不可）:**
- `onboarding@resend.dev` - これはResendのテスト用ドメイン（制限あり）
- `user@gmail.com` - これはGmailのドメイン（検証していない）
- `test@otherdomain.com` - これは検証していないドメイン

### 環境変数の更新方法

検証が完了したら、`.env.local`（または本番環境の環境変数）を更新します：

```env
EMAIL_SERVICE=resend
EMAIL_API_KEY=re_xxxxxxxxxxxxx  # Resend APIキー（変更なし）
EMAIL_FROM=noreply@example.com  # 検証済みドメインのメールアドレス
```

**設定のポイント:**

1. **`EMAIL_FROM`のドメイン部分**が検証済みドメインである必要があります
   - ✅ 正しい例: `noreply@example.com`（`example.com`が検証済みの場合）
   - ❌ 間違い: `noreply@otherdomain.com`（`otherdomain.com`が検証されていない）

2. **メールアドレスの形式**は正しい必要があります
   - ✅ 正しい形式: `noreply@example.com`
   - ❌ 間違った形式: `noreply@`（ドメインがない）

3. **メールアドレスのローカル部分**（@の前）は自由に設定できます
   - `noreply@example.com`
   - `hello@example.com`
   - `info@example.com`
   - など、検証済みドメインであれば任意のメールアドレスを指定可能

   **具体例: `careeressence.jp`が検証済みの場合**
   - ✅ `noreply@careeressence.jp` - 使用可能
   - ✅ `hello@careeressence.jp` - 使用可能
   - ✅ `info@careeressence.jp` - 使用可能
   - ✅ `admin@careeressence.jp` - 使用可能
   - ✅ `support@careeressence.jp` - 使用可能
   - ✅ `no-reply@careeressence.jp` - 使用可能（ハイフンもOK）
   - ✅ `contact.us@careeressence.jp` - 使用可能（ドットもOK）
   - ✅ `user_name@careeressence.jp` - 使用可能（アンダースコアもOK）
   - ✅ `test123@careeressence.jp` - 使用可能（数字もOK）

   **注意点:**
   - ローカル部分（@の前）は、英数字、ハイフン（-）、アンダースコア（_）、ドット（.）が使用可能
   - 特殊文字や日本語は避けることを推奨
   - メールアドレスの形式として有効である必要がある

**設定例:**

あなたが`careeressence.jp`を検証した場合：

```env
# 検証済みドメイン: careeressence.jp
EMAIL_FROM=noreply@careeressence.jp  # ✅ 正しい
EMAIL_FROM=hello@careeressence.jp    # ✅ 正しい（ローカル部分は自由）
EMAIL_FROM=info@careeressence.jp     # ✅ 正しい（ローカル部分は自由）
EMAIL_FROM=admin@careeressence.jp    # ✅ 正しい（ローカル部分は自由）
EMAIL_FROM=no-reply@careeressence.jp # ✅ 正しい（ハイフンも使用可能）
```

```env
# 検証済みドメイン: careeressence.jp
EMAIL_FROM=noreply@otherdomain.com  # ❌ 間違い（otherdomain.comは検証されていない）
EMAIL_FROM=onboarding@resend.dev     # ⚠️ テスト用（制限あり）
EMAIL_FROM=user@careeressence.com    # ❌ 間違い（careeressence.comは検証されていない、.jpではない）
```

**よくある質問:**

**Q: `careeressence.jp`が検証済みの場合、`@careeressence.jp`の前は何でもいいですか？**

A: はい、基本的には何でも構いません。ただし、以下の点に注意してください：

- ✅ **使用可能な文字**: 英数字、ハイフン（-）、アンダースコア（_）、ドット（.）
- ✅ **例**: `noreply@careeressence.jp`、`hello@careeressence.jp`、`admin@careeressence.jp`など
- ⚠️ **推奨**: わかりやすく、用途に応じた名前にする（例: `noreply`、`hello`、`info`、`admin`など）
- ❌ **避けるべき**: 特殊文字、日本語、スペースなど

### 確認方法

1. **Resendダッシュボードで確認**
   - 「**Domains**」セクションで、ドメインのステータスが「**Verified**」になっているか確認

2. **環境変数を確認**
   - `.env.local`の`EMAIL_FROM`が、検証済みドメインのメールアドレスになっているか確認
   - 例: 検証済みドメインが`example.com`の場合、`EMAIL_FROM=noreply@example.com`のように設定

## 🔄 ステップ6: アプリケーションを再起動

環境変数を変更した場合、アプリケーションを再起動します：

**開発環境の場合:**
```bash
# 開発サーバーを停止（Ctrl + C）
# 再起動
npm run dev
```

**本番環境の場合:**
- Vercel: 自動的に再デプロイされます（環境変数を更新した場合）
- その他のホスティング: アプリケーションを再起動

## 🧪 ステップ7: メール送信をテスト

1. **管理者ユーザーを追加**
   - `/admin/admin-users` にアクセス
   - 任意のメールアドレスで管理者ユーザーを追加

2. **サーバーログを確認**
   - 開発サーバーのコンソールで以下を確認：
     - `[Email] Resend API リクエスト送信（パスワードリセット）`
     - `[Email] Resend API レスポンス（パスワードリセット）`
     - エラーがないことを確認

3. **Resendダッシュボードで確認**
   - Resendダッシュボードの「**Logs**」セクションを開く
   - 送信履歴を確認
   - 送信ステータスが「**Delivered**」または「**Sent**」であることを確認

4. **メール受信を確認**
   - 送信先メールアドレスの受信トレイを確認
   - 迷惑メールフォルダも確認

## 🐛 トラブルシューティング

### DNSレコードが反映されない

**原因:**
- DNSレコードの設定が正しくない
- DNSプロバイダの反映が遅い

**対処方法:**
1. DNSレコードの値を再確認
2. DNSプロバイダのドキュメントを参照
3. 反映を待つ（最大48時間）
4. DNSチェッカーツールで確認

### 検証が失敗する

**原因:**
- DNSレコードが正しく設定されていない
- レコードの値に誤りがある

**対処方法:**
1. Resendダッシュボードで各レコードの検証状況を確認
2. 失敗しているレコードを特定
3. DNS管理画面で該当レコードを確認
4. レコードの値を再確認（コピー&ペーストで誤りがないか）
5. TTLを短く設定して再試行

### メール送信が403エラーになる

**原因:**
- `EMAIL_FROM`に検証されていないドメインを指定している
- 環境変数が更新されていない

**対処方法:**
1. `.env.local`の`EMAIL_FROM`を確認
2. 検証済みドメインのメールアドレスになっているか確認
3. アプリケーションを再起動
4. Resendダッシュボードでドメインの検証状況を確認

### メールが届かない

**原因:**
- SPF/DKIMレコードが正しく設定されていない可能性
- メールが迷惑メールフォルダに届いている
- 送信先メールアドレスが無効

**対処方法:**
1. 迷惑メールフォルダを確認
2. Resendダッシュボードの「Logs」で送信ステータスを確認
3. 送信先メールアドレスの形式を確認
4. 別のメールアドレスでテスト

## 📝 補足情報

### 複数のドメインを検証する

Resendでは複数のドメインを検証できます：

1. 「**Domains**」セクションで「**Add Domain**」をクリック
2. 各ドメインに対してDNSレコードを設定
3. 各ドメインを個別に検証

### サブドメインを使用する

サブドメインを使用することも可能です：

- 例: `mail.example.com`
- ルートドメイン（`example.com`）とは別に検証が必要

### ドメイン検証の料金

- Resendの無料プランでもドメイン検証は可能
- 複数のドメインを検証することも可能（無料プランでも）

## ✅ チェックリスト

ドメイン検証が完了したら、以下を確認してください：

- [ ] Resendダッシュボードでドメインが「Verified」になっている
- [ ] `.env.local`の`EMAIL_FROM`が検証済みドメインのメールアドレスになっている
- [ ] アプリケーションを再起動した
- [ ] メール送信テストが成功した
- [ ] Resendダッシュボードの「Logs」で送信が確認できた
- [ ] 送信先メールアドレスにメールが届いた

## 📚 参考リンク

- [Resend公式ドキュメント - Domains](https://resend.com/docs/dashboard/domains/introduction)
- [DNSレコード設定ガイド](https://resend.com/docs/dashboard/domains/dns-records)
