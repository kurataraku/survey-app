# Supabase設定リセットチェックリスト

このチェックリストに従って、Supabase設定を最初からやり直してください。

## ✅ チェックリスト

### 1. 既存の環境変数ファイルの確認・削除

- [ ] `.env.local` ファイルが存在する場合は削除またはリネーム
- [ ] `.env` ファイルが存在する場合は削除またはリネーム
- [ ] 他の `.env.*` ファイルがあれば確認

**注意**: 既存の設定をバックアップしたい場合は、ファイル名を変更（例: `.env.local.backup`）してください。

### 2. Supabaseプロジェクトの準備

#### オプションA: 新しいプロジェクトを作成する場合

- [ ] [Supabase](https://supabase.com) にログイン
- [ ] 「New Project」をクリック
- [ ] プロジェクト名、データベースパスワード、リージョンを設定
- [ ] プロジェクト作成完了を待つ（2-3分）

#### オプションB: 既存のプロジェクトを使用する場合

- [ ] Supabaseダッシュボードでプロジェクトを選択
- [ ] 既存のテーブルを確認
- [ ] 必要に応じてテーブルを削除（Table Editor → テーブル名 → Delete）

### 3. 環境変数の取得

- [ ] Supabaseダッシュボードで「Settings」→「API」を開く
- [ ] **Project URL** をコピー
- [ ] **anon public** キーをコピー（Revealボタンをクリック）
- [ ] **service_role** キーをコピー（Revealボタンをクリック）

### 4. .env.localファイルの作成

- [ ] プロジェクトルート（`survey-app`フォルダ）に `.env.local` ファイルを作成
- [ ] 以下の内容を記入：

```env
NEXT_PUBLIC_SUPABASE_URL=ここにProject URLを貼り付け
NEXT_PUBLIC_SUPABASE_ANON_KEY=ここにanon publicキーを貼り付け
SUPABASE_SERVICE_ROLE_KEY=ここにservice_roleキーを貼り付け
```

- [ ] 実際の値に置き換える
- [ ] ファイルを保存

### 5. データベーステーブルの作成

- [ ] Supabaseダッシュボードで「SQL Editor」を開く
- [ ] 「New query」をクリック
- [ ] `supabase-schema.sql` ファイルの内容をコピー
- [ ] SQL Editorに貼り付け
- [ ] 「Run」ボタンをクリック
- [ ] 成功メッセージを確認
- [ ] 「Table Editor」で `survey_responses` テーブルが作成されたことを確認

### 6. 開発サーバーの再起動

- [ ] 実行中の開発サーバーを停止（`Ctrl + C`）
- [ ] ターミナルで以下を実行：

```bash
npm run dev
```

- [ ] エラーがないことを確認

### 7. 動作確認

- [ ] ブラウザで [http://localhost:3000/survey](http://localhost:3000/survey) を開く
- [ ] アンケートフォームが表示されることを確認
- [ ] テストデータを入力して送信
- [ ] Supabaseダッシュボードの「Table Editor」でデータが保存されたことを確認

## 🔄 既存のテーブルをリセットする場合

既存のテーブルを削除して再作成したい場合：

1. Supabaseダッシュボードで「SQL Editor」を開く
2. 以下のSQLを実行：

```sql
-- テーブルを削除（注意：すべてのデータが削除されます）
DROP TABLE IF EXISTS survey_responses CASCADE;
```

3. `supabase-schema.sql` の内容を実行してテーブルを再作成

## 📚 詳細な手順

詳細な手順については、`SUPABASE_SETUP.md` を参照してください。

