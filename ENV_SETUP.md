# 環境変数の設定方法

## 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com)にアクセスしてアカウントを作成（またはログイン）
2. 「New Project」をクリックして新しいプロジェクトを作成
3. プロジェクト名、データベースパスワード、リージョンを設定してプロジェクトを作成

## 2. 環境変数の取得

1. Supabaseのダッシュボードで、作成したプロジェクトを開く
2. 左側のメニューから「Settings」→「API」をクリック
3. 以下の情報をコピー：
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`に設定
   - **anon public** キー → `NEXT_PUBLIC_SUPABASE_ANON_KEY`に設定
   - **service_role** キー（機密情報） → `SUPABASE_SERVICE_ROLE_KEY`に設定

## 3. .env.localファイルの作成

`survey-app`ディレクトリに`.env.local`ファイルを作成し、以下の内容を記入してください：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**重要**: 
- `your-project-id`、`your_anon_key_here`、`your_service_role_key_here`を実際の値に置き換えてください
- `.env.local`ファイルは絶対にGitにコミットしないでください（既に`.gitignore`に含まれています）

## 4. Supabaseテーブルの作成

1. Supabaseのダッシュボードで、左側のメニューから「SQL Editor」をクリック
2. 「New query」をクリック
3. `supabase-schema.sql`ファイルの内容をコピー＆ペースト
4. 「Run」ボタンをクリックして実行

## 5. 開発サーバーの再起動

環境変数を設定した後は、開発サーバーを再起動する必要があります：

1. 現在実行中の開発サーバーを停止（Ctrl+C）
2. 再度起動：
   ```bash
   npm run dev
   ```

これで、アンケートフォームからデータを送信できるようになります。


