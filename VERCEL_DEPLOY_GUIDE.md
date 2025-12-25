# Vercelデプロイガイド（初心者向け）

このガイドでは、通信制高校リアルレビューアプリをVercelにデプロイする手順を説明します。

## 📋 前提条件

- GitHubアカウントを持っていること
- Vercelアカウントを持っていること（無料で作成可能）

---

## 🚀 デプロイ手順

### ステップ1: すべてのファイルをGitにコミット

1. **ターミナル（コマンドプロンプト）を開く**
   - Windows: `Win + R` → `cmd` と入力してEnter
   - または、Cursorのターミナルを使用

2. **プロジェクトフォルダに移動**
   ```bash
   cd "C:\Users\taka-\OneDrive\デスクトップ\project\survey-app"
   ```

3. **すべてのファイルをGitに追加**
   ```bash
   git add .
   ```

4. **コミット（変更を保存）**
   ```bash
   git commit -m "Initial commit: Survey app ready for deployment"
   ```

---

### ステップ2: GitHubにリポジトリを作成してプッシュ

1. **GitHubにログイン**
   - https://github.com にアクセス
   - ログイン（アカウントがない場合は作成）

2. **新しいリポジトリを作成**
   - GitHubの右上の「+」ボタンをクリック
   - 「New repository」を選択
   - リポジトリ名を入力（例: `survey-app`）
   - 「Public」または「Private」を選択
   - 「Initialize this repository with a README」は**チェックしない**
   - 「Create repository」をクリック

3. **GitHubの指示に従ってプッシュ**
   GitHubで表示されるコマンドを実行します（通常は以下のようなコマンド）：
   
   ```bash
   git remote add origin https://github.com/あなたのユーザー名/survey-app.git
   git branch -M main
   git push -u origin main
   ```
   
   **注意**: `あなたのユーザー名` の部分は、あなたのGitHubユーザー名に置き換えてください。

---

### ステップ3: Vercelアカウントを作成

1. **Vercelにアクセス**
   - https://vercel.com にアクセス

2. **アカウントを作成**
   - 「Sign Up」をクリック
   - 「Continue with GitHub」を選択（GitHubアカウントでログイン）
   - 必要に応じて権限を許可

---

### ステップ4: Vercelでプロジェクトをインポート

1. **ダッシュボードに移動**
   - Vercelのダッシュボード（https://vercel.com/dashboard）にアクセス

2. **新しいプロジェクトを追加**
   - 「Add New...」→「Project」をクリック

3. **GitHubリポジトリを選択**
   - 先ほど作成したGitHubリポジトリ（`survey-app`）を選択
   - 「Import」をクリック

4. **プロジェクト設定**
   - **Framework Preset**: Next.js（自動検出されるはず）
   - **Root Directory**: `./`（そのまま）
   - **Build Command**: `npm run build`（自動設定されるはず）
   - **Output Directory**: `.next`（自動設定されるはず）
   - 「Deploy」をクリック

---

### ステップ5: 環境変数を設定（重要！）

デプロイが開始されますが、**環境変数を設定しないとアプリが動作しません**。

1. **環境変数設定画面に移動**
   - デプロイ中またはデプロイ後、プロジェクトの「Settings」タブをクリック
   - 左メニューから「Environment Variables」を選択

2. **以下の3つの環境変数を追加**

   | 変数名 | 値 |
   |--------|-----|
   | `NEXT_PUBLIC_SUPABASE_URL` | あなたのSupabaseプロジェクトのURL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | あなたのSupabaseの匿名キー |
   | `SUPABASE_SERVICE_ROLE_KEY` | あなたのSupabaseのサービスロールキー |

   **各環境変数の追加方法：**
   - 「Name」に変数名を入力
   - 「Value」に値を入力
   - 「Environment」で「Production」「Preview」「Development」すべてにチェック
   - 「Save」をクリック
   - 3つすべて追加するまで繰り返す

3. **環境変数の確認方法**
   - ローカルの `.env.local` ファイルを開いて確認
   - または、Supabaseのダッシュボードで確認

---

### ステップ6: 再デプロイ

環境変数を追加した後、再デプロイが必要です：

1. **「Deployments」タブをクリック**
2. **最新のデプロイメントの右側の「...」メニューをクリック**
3. **「Redeploy」を選択**
4. **「Redeploy」ボタンをクリック**

または、GitHubに新しいコミットをプッシュすると自動的に再デプロイされます。

---

### ステップ7: デプロイ完了の確認

1. **デプロイが完了するまで待つ**（通常1-2分）
2. **「Visit」ボタンをクリック**して、デプロイされたサイトを確認
3. **アンケートフォームが正常に動作するか確認**
   - `/survey` ページにアクセス
   - フォームが表示されるか確認
   - テスト送信を実行

---

## 🔧 トラブルシューティング

### デプロイが失敗する場合

1. **ビルドログを確認**
   - Vercelのデプロイメントページで「Build Logs」を確認
   - エラーメッセージを確認

2. **環境変数が正しく設定されているか確認**
   - Settings → Environment Variables で確認
   - すべての環境（Production, Preview, Development）に設定されているか確認

3. **ローカルでビルドが成功するか確認**
   ```bash
   npm run build
   ```

### アプリが動作しない場合

1. **環境変数が設定されているか確認**
   - Vercelのダッシュボードで確認
   - 値が正しいか確認（コピー&ペーストの際の余分なスペースなどに注意）

2. **ブラウザのコンソールでエラーを確認**
   - F12キーを押して開発者ツールを開く
   - 「Console」タブでエラーを確認

---

## 📝 今後の更新方法

コードを更新して再デプロイする場合：

1. **ローカルで変更を加える**
2. **Gitにコミット**
   ```bash
   git add .
   git commit -m "変更内容の説明"
   ```
3. **GitHubにプッシュ**
   ```bash
   git push
   ```
4. **Vercelが自動的に再デプロイ**（通常1-2分）

---

## 🎉 完了！

これで、あなたのアプリがインターネット上で公開されました！

デプロイされたURLは、Vercelのダッシュボードで確認できます。
例: `https://survey-app-xxxxx.vercel.app`

このURLを他の人に共有すれば、誰でもアンケートに回答できるようになります。

