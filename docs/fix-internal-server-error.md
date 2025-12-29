# Internal Server Errorの解決方法

## 原因

「Internal Server Error」が表示される主な原因は、**環境変数が設定されていない**ことです。

---

## 解決方法

### Step 1: ターミナルのエラーメッセージを確認

1. **開発サーバーが起動しているターミナルウィンドウを確認**
2. **エラーメッセージを確認**
   - 「Supabase環境変数が設定されていません」などのメッセージが表示されている可能性があります

### Step 2: .env.localファイルを作成

1. **VS Codeでプロジェクトルートを開く**
   - `survey-app`フォルダを開いていることを確認

2. **新しいファイルを作成**
   - エクスプローラーで右クリック → 「新規ファイル」
   - ファイル名を `.env.local` と入力（先頭のドットを含める）

3. **以下の内容をコピーして貼り付け**

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### Step 3: Supabaseから環境変数を取得

1. **Supabaseダッシュボードにアクセス**
   - https://supabase.com にログイン
   - プロジェクトを選択

2. **環境変数を取得**
   - 左側メニュー: **「Settings」** → **「API」**
   - 以下の3つの値をコピー:

   - **Project URL**: 例 `https://ltalctnqdeylgdkptmyg.supabase.co`
   - **anon public キー**: 「Reveal」をクリックしてコピー
   - **service_role キー**: 「Reveal」をクリックしてコピー（⚠️機密情報）

### Step 4: .env.localファイルに値を入力

`.env.local`ファイルを開き、以下のように値を入力:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ltalctnqdeylgdkptmyg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ここにanon publicキーを貼り付け
SUPABASE_SERVICE_ROLE_KEY=ここにservice_roleキーを貼り付け
```

**重要**:
- `=`の後に実際の値を貼り付ける
- 値の前後にスペースや引用符を入れない
- ファイルを保存（Ctrl + S）

### Step 5: 開発サーバーを再起動

**必ず再起動が必要です！**

1. **開発サーバーを停止**
   - ターミナルで **Ctrl + C** を押す

2. **再度起動**
   ```cmd
   npm run dev
   ```

### Step 6: ブラウザで確認

1. ブラウザで `http://localhost:3000/survey` にアクセス
2. エラーが解消されているか確認

---

## ターミナルのエラーメッセージを確認する方法

開発サーバーのターミナルウィンドウで、以下のようなエラーメッセージが表示されている可能性があります：

```
error - Supabase環境変数が設定されていません
```

または

```
Error: NEXT_PUBLIC_SUPABASE_URL is not defined
```

これらのエラーメッセージを確認して、具体的な問題を特定してください。




