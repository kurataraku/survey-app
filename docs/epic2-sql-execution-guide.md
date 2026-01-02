# Epic2 SQL実行ガイド

Epic2の実装を完了するために、SupabaseでSQLファイルを実行する必要があります。

## 実行するSQLファイル

以下のSQLファイルをSupabaseのSQL Editorで実行してください：

### 1. review_likesテーブルの作成

**ファイル**: `supabase-schema-epic2-review-likes.sql`

1. Supabaseダッシュボードにログイン
2. 左側のメニューから「**SQL Editor**」をクリック
3. 「**New query**」をクリック
4. `supabase-schema-epic2-review-likes.sql`の内容をコピー＆ペースト
5. 「**RUN**」ボタンをクリック
6. 成功メッセージを確認

## 実行後の確認

SQL実行後、以下の確認を行ってください：

### Table Editorで確認

1. 「**Table Editor**」を開く
2. `review_likes`テーブルが作成されていることを確認
3. 以下のカラムが存在することを確認：
   - `id` (uuid)
   - `review_id` (uuid)
   - `user_ip` (text)
   - `created_at` (timestamptz)

## 次のステップ

SQL実行が完了したら、Epic2の実装は完了です。動作確認を行ってください。

動作確認手順は `docs/epic2-verification-guide.md` を参照してください。







