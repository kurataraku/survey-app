# Supabase設定ガイド - 通信制高校リアルレビュー

このガイドでは、Supabaseの設定を最初から行う手順を説明します。

## 📋 前提条件

- Supabaseアカウントを持っていること（なければ [supabase.com](https://supabase.com) で作成）
- Node.jsとnpmがインストールされていること

## 🚀 セットアップ手順

### ステップ1: Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com) にアクセスしてログイン
2. ダッシュボードで「**New Project**」をクリック
3. 以下の情報を入力：
   - **Project Name**: プロジェクト名（例: `survey-app`）
   - **Database Password**: 強力なパスワードを設定（後で必要になります）
   - **Region**: 最寄りのリージョンを選択（例: `Northeast Asia (Tokyo)`）
4. 「**Create new project**」をクリック
5. プロジェクトの作成完了まで数分待ちます（2-3分程度）

### ステップ2: 環境変数の取得

1. Supabaseダッシュボードで、作成したプロジェクトを開く
2. 左側のメニューから「**Settings**」（⚙️アイコン）をクリック
3. 「**API**」をクリック
4. 以下の情報をコピーします：

   **a. Project URL**
   - 「**Project URL**」セクションのURLをコピー
   - 例: `https://abcdefghijklmnop.supabase.co`

   **b. anon public キー**
   - 「**Project API keys**」セクションの「**anon public**」キーをコピー
   - 長い文字列です（`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`のような形式）
   - 「**Reveal**」ボタンをクリックして表示

   **c. service_role キー**
   - 同じセクションの「**service_role**」キーをコピー
   - ⚠️ **重要**: このキーは機密情報です。絶対に公開しないでください
   - 「**Reveal**」ボタンをクリックして表示

### ステップ3: .env.localファイルの作成

1. プロジェクトのルートディレクトリ（`survey-app`）に `.env.local` ファイルを作成
2. `.env.local.example` を参考に、以下の内容を記入：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

3. 実際の値に置き換える：
   - `https://your-project-id.supabase.co` → ステップ2でコピーしたProject URL
   - `your_anon_key_here` → ステップ2でコピーしたanon publicキー
   - `your_service_role_key_here` → ステップ2でコピーしたservice_roleキー

**例：**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjE2MjM5MDIyLCJleHAiOjE5MzE4MTUwMjJ9.yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

### ステップ4: データベーステーブルの作成

1. Supabaseダッシュボードで、左側のメニューから「**SQL Editor**」をクリック
2. 「**New query**」をクリック
3. `supabase-schema.sql` ファイルを開いて、その内容をすべてコピー
4. SQL Editorに貼り付け
5. 「**Run**」ボタン（または `Ctrl + Enter`）をクリックして実行
6. 成功メッセージが表示されることを確認

**確認方法：**
- 左側のメニューから「**Table Editor**」をクリック
- `survey_responses` テーブルが作成されていることを確認

### ステップ5: Row Level Security (RLS) の設定（オプション）

セキュリティを強化する場合は、RLSポリシーを設定できます：

1. Supabaseダッシュボードで「**Authentication**」→「**Policies**」をクリック
2. `survey_responses` テーブルを選択
3. 必要に応じてポリシーを追加

**注意**: 現在の実装では、APIルートでservice_roleキーを使用しているため、RLSは無効化されています。本番環境では適切なRLSポリシーを設定することを推奨します。

### ステップ6: 開発サーバーの再起動

環境変数を設定した後は、開発サーバーを再起動する必要があります：

1. 現在実行中の開発サーバーを停止（`Ctrl + C`）
2. 再度起動：

```bash
npm run dev
```

3. ブラウザで [http://localhost:3000/survey](http://localhost:3000/survey) を開いて動作確認

## ✅ 動作確認

1. アンケートフォームにアクセス: [http://localhost:3000/survey](http://localhost:3000/survey)
2. フォームに回答を入力
3. 送信ボタンをクリック
4. Supabaseダッシュボードの「**Table Editor**」で `survey_responses` テーブルを確認
5. データが正しく保存されていることを確認

## 🔧 トラブルシューティング

### 環境変数が読み込まれない

- `.env.local` ファイルがプロジェクトのルートディレクトリにあることを確認
- 開発サーバーを再起動
- ファイル名が `.env.local` であることを確認（`.env.local.txt` ではない）

### Supabase接続エラー

- Project URLとAPIキーが正しいことを確認
- Supabaseプロジェクトがアクティブであることを確認
- ネットワーク接続を確認

### テーブルが見つからない

- SQL Editorで `supabase-schema.sql` が正しく実行されたことを確認
- Table Editorでテーブルが作成されていることを確認
- テーブル名が `survey_responses` であることを確認

## 📝 注意事項

- `.env.local` ファイルは絶対にGitにコミットしないでください（`.gitignore`に含まれています）
- `SUPABASE_SERVICE_ROLE_KEY` は機密情報です。絶対に公開しないでください
- 本番環境では、環境変数を適切に管理してください（Vercel、Netlifyなどの環境変数設定を使用）

