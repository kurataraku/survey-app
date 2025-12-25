# Supabase設定 - クイックスタートガイド

このガイドに従って、Supabase設定を最初から行ってください。

## 🎯 5分で完了する手順

### 1. Supabaseプロジェクトの作成（2分）

1. [https://supabase.com](https://supabase.com) にアクセスしてログイン
2. 「**New Project**」をクリック
3. プロジェクト情報を入力：
   - **Name**: `survey-app`（任意）
   - **Database Password**: 強力なパスワードを設定
   - **Region**: `Northeast Asia (Tokyo)` を推奨
4. 「**Create new project**」をクリック
5. プロジェクト作成完了まで待つ（2-3分）

### 2. 環境変数の取得（1分）

1. プロジェクトダッシュボードで「**Settings**」→「**API**」を開く
2. 以下の3つの値をコピー：
   - **Project URL**（例: `https://xxxxx.supabase.co`）
   - **anon public** キー（「Reveal」をクリック）
   - **service_role** キー（「Reveal」をクリック、⚠️機密情報）

### 3. .env.localファイルの作成（1分）

プロジェクトルート（`survey-app`フォルダ）に `.env.local` ファイルを作成し、以下を貼り付け：

```env
NEXT_PUBLIC_SUPABASE_URL=ここにProject URLを貼り付け
NEXT_PUBLIC_SUPABASE_ANON_KEY=ここにanon publicキーを貼り付け
SUPABASE_SERVICE_ROLE_KEY=ここにservice_roleキーを貼り付け
```

実際の値に置き換えて保存してください。

### 4. データベーステーブルの作成（1分）

1. Supabaseダッシュボードで「**SQL Editor**」を開く
2. 「**New query**」をクリック
3. このプロジェクトの `supabase-schema.sql` ファイルを開く
4. 内容をすべてコピーしてSQL Editorに貼り付け
5. 「**Run**」ボタンをクリック
6. 成功メッセージを確認

### 5. 開発サーバーの起動

ターミナルで以下を実行：

```bash
npm run dev
```

ブラウザで [http://localhost:3000/survey](http://localhost:3000/survey) を開いて動作確認！

## ✅ 動作確認

1. アンケートフォームが表示される
2. フォームに回答を入力
3. 送信ボタンをクリック
4. Supabaseダッシュボードの「**Table Editor**」で `survey_responses` テーブルを確認
5. データが保存されていることを確認

## 📚 詳細情報

- 詳細な手順: `SUPABASE_SETUP.md` を参照
- チェックリスト: `SUPABASE_RESET_CHECKLIST.md` を参照

## ❓ トラブルシューティング

### 環境変数エラーが出る

- `.env.local` ファイルがプロジェクトルートにあるか確認
- 開発サーバーを再起動（`Ctrl + C` → `npm run dev`）
- 値に余分なスペースや改行がないか確認

### テーブルが見つからない

- SQL Editorで `supabase-schema.sql` が実行されたか確認
- Table Editorで `survey_responses` テーブルが存在するか確認

### 接続エラー

- Project URLとAPIキーが正しいか確認
- Supabaseプロジェクトがアクティブか確認

