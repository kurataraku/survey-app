# ローカル開発環境の環境変数設定

## 問題

「サーバーから予期しない形式のレスポンスが返されました。環境変数が正しく設定されているか確認してください。」というエラーが表示される場合は、`.env.local`ファイルが作成されていないか、環境変数が正しく設定されていません。

---

## 解決方法

### Step 1: Supabaseダッシュボードで環境変数を取得

1. **Supabaseダッシュボードにアクセス**
   - https://supabase.com にログイン
   - プロジェクトを選択（参考: `ltalctnqdeylgdkptmyg`）

2. **環境変数を取得**
   - 左側のメニューから **「Settings」** → **「API」** をクリック
   - 以下の3つの値をコピーしてください：

   #### ① Project URL
   - 「Project URL」セクションの値
   - 例: `https://ltalctnqdeylgdkptmyg.supabase.co`

   #### ② anon public キー
   - 「Project API keys」セクションの「anon public」キー
   - 「Reveal」ボタンをクリックして表示
   - 長い文字列（JWTトークン）が表示されます

   #### ③ service_role キー（⚠️機密情報）
   - 「Project API keys」セクションの「service_role」キー
   - 「Reveal」ボタンをクリックして表示
   - ⚠️ **このキーは機密情報です。絶対に公開しないでください**

---

### Step 2: .env.localファイルを編集

1. **VS Codeで`.env.local`ファイルを開く**
   - プロジェクトルート（`survey-app`フォルダ）に`.env.local`ファイルが作成されているはずです
   - 開いて編集してください

2. **以下の形式で値を入力**

```env
NEXT_PUBLIC_SUPABASE_URL=https://ltalctnqdeylgdkptmyg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0YWxjdG5xZGV5bGdka3B0bXlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE5NTUwMDAsImV4cCI6MjA0NzUzMTAwMH0.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0YWxjdG5xZGV5bGdka3B0bXlnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTk1NTAwMCwiZXhwIjoyMDQ3NTMxMDAwfQ.yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

**重要**: 
- `=`の後に実際の値を貼り付けてください
- 値の前後にはスペースや余分な文字を入れないでください
- 引用符（`"`や`'`）は不要です

---

### Step 3: 開発サーバーを再起動

環境変数を設定した後は、**必ず開発サーバーを再起動**してください。

1. **現在の開発サーバーを停止**
   - ターミナルで **Ctrl + C** を押す

2. **再度起動**
   ```cmd
   npm run dev
   ```

3. **起動確認**
   - ターミナルに以下のメッセージが表示されれば成功:
   ```
   ▲ Next.js 16.1.1
   - Local:        http://localhost:3000
   - Ready in X.Xs
   ```

---

### Step 4: 動作確認

1. **ブラウザでアンケートフォームにアクセス**
   ```
   http://localhost:3000/survey
   ```

2. **テスト投稿を実行**
   - フォームに必要事項を入力
   - 送信ボタンをクリック

3. **成功の確認**
   - 「回答ありがとうございました！」と表示されれば成功
   - エラーが表示されないことを確認

---

## トラブルシューティング

### エラーが続く場合

1. **環境変数が正しく設定されているか確認**
   - `.env.local`ファイルの各値が正しいか確認
   - 前後にスペースや引用符が入っていないか確認

2. **開発サーバーを再起動したか確認**
   - 環境変数を変更した後は、必ず開発サーバーを再起動してください

3. **ファイル名を確認**
   - ファイル名は正確に `.env.local` である必要があります
   - `.env.local.txt` や `.env` では動作しません

4. **Supabaseプロジェクトが正しいか確認**
   - Supabaseダッシュボードで、正しいプロジェクトを選択しているか確認

---

## セキュリティ注意事項

⚠️ **`.env.local`ファイルは絶対にGitにコミットしないでください**

- `.gitignore`に既に含まれているはずですが、確認してください
- このファイルには機密情報（`SUPABASE_SERVICE_ROLE_KEY`）が含まれています










