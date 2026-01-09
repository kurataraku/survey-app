# Vercel環境変数の確認・設定方法（完全版）

このガイドでは、Vercelで必要な環境変数を確認・設定する方法を詳しく説明します。

## 📋 必要な環境変数一覧

以下の4つの環境変数が必要です：

1. **`NEXT_PUBLIC_SUPABASE_URL`** - SupabaseプロジェクトのURL（必須）
2. **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** - Supabaseの匿名キー（必須）
3. **`SUPABASE_SERVICE_ROLE_KEY`** - Supabaseのサービスロールキー（必須）
4. **`NEXT_PUBLIC_SITE_URL`** - デプロイされたサイトのURL（推奨）

---

## ✅ ステップ1: 環境変数の現在の状態を確認

### 1-1. Vercelダッシュボードにアクセス

1. **ブラウザで https://vercel.com/dashboard を開く**
2. **ログイン**（GitHubアカウントでログインしている場合は自動的にログイン）

### 1-2. プロジェクトを選択

1. **左側のプロジェクト一覧から、デプロイしたプロジェクトをクリック**
   - 例: `survey-app` または `real-review`

### 1-3. Settingsタブを開く

1. **プロジェクトページの上部にある「Settings」タブをクリック**
   - タブの一覧: Overview, Deployments, Analytics, Settings, Team など

### 1-4. Environment Variablesを開く

1. **左側のメニューから「Environment Variables」をクリック**
   - Settingsページを開くと、左側にメニューが表示されます
   - 「Environment Variables」をクリック

### 1-5. 現在の環境変数を確認

1. **環境変数の一覧を確認**
   - 画面に環境変数の一覧が表示されます
   - 以下の4つの環境変数が表示されているか確認してください：
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `NEXT_PUBLIC_SITE_URL`

2. **各環境変数の状態を確認**
   - **Key（名前）**: 環境変数名が表示されている
   - **Value（値）**: 値が表示されている（「••••••」のように隠されている場合があります）
   - **Environments（環境）**: Production, Preview, Development のどれに設定されているか表示

3. **環境変数が存在しない場合**
   - 一覧に表示されていない場合は、設定されていません
   - この場合は、次のステップで追加する必要があります

---

## 🔧 ステップ2: Supabaseから環境変数の値を取得

環境変数を設定する前に、Supabaseから実際の値を取得する必要があります。

### 2-1. Supabaseダッシュボードにアクセス

1. **ブラウザで https://supabase.com/dashboard を開く**
2. **ログイン**

### 2-2. プロジェクトを選択

1. **左側のプロジェクト一覧から、使用しているプロジェクトをクリック**
   - 複数のプロジェクトがある場合は、正しいプロジェクトを選択してください

### 2-3. API設定を開く

1. **左側のメニューから「Settings」をクリック**
2. **「API」をクリック**
   - Settingsページの左側メニューに「API」という項目があります

### 2-4. 環境変数の値をコピー

以下の3つの値をコピーしてください：

#### ① NEXT_PUBLIC_SUPABASE_URL

1. **「Project URL」という項目を探す**
   - ページの上部に「Project URL」という項目があります
   - 値の例: `https://abcdefghijklmnop.supabase.co`

2. **「Copy」ボタンをクリックしてコピー**
   - または、値を選択して Ctrl+C（Mac: Cmd+C）でコピー

3. **メモ帳などに一時的に保存**
   - 次のステップで使用します

#### ② NEXT_PUBLIC_SUPABASE_ANON_KEY

1. **「Project API keys」セクションを探す**
   - 「anon public」という項目があります

2. **「Reveal」ボタンをクリック**
   - 値が「••••••」のように隠されている場合は、「Reveal」ボタンをクリックして表示

3. **「Copy」ボタンをクリックしてコピー**
   - 値の例: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0Mjg5NzYwMCwiZXhwIjoxOTU4NDczNjAwfQ.abcdefghijklmnopqrstuvwxyz1234567890`

4. **メモ帳などに一時的に保存**

#### ③ SUPABASE_SERVICE_ROLE_KEY

1. **「Project API keys」セクションで「service_role」という項目を探す**
   - 「anon public」の下に「service_role」という項目があります

2. **⚠️ 重要: 「Reveal」ボタンをクリック**
   - このキーは機密情報なので、注意して取り扱ってください
   - 「Reveal」ボタンをクリックして表示

3. **「Copy」ボタンをクリックしてコピー**
   - 値の例: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQyODk3NjAwLCJleHAiOjE5NTg0NzM2MDB9.abcdefghijklmnopqrstuvwxyz1234567890`

4. **メモ帳などに一時的に保存**
   - ⚠️ このキーは機密情報です。他人に共有しないでください

---

## 🌐 ステップ3: デプロイされたサイトのURLを確認

`NEXT_PUBLIC_SITE_URL` には、デプロイされたサイトのURLを設定します。

### 3-1. Vercelダッシュボードで確認

1. **Vercelダッシュボードに戻る**
2. **プロジェクトページの「Deployments」タブをクリック**
3. **最新のデプロイメントを確認**
   - 「Visit」ボタンの横、またはデプロイメントカードの上部にURLが表示されています
   - 例: `https://real-review.vercel.app`
   - または: `https://survey-app-abc123.vercel.app`

4. **URLをコピー**
   - URLを選択して Ctrl+C（Mac: Cmd+C）でコピー
   - メモ帳などに一時的に保存

### 3-2. カスタムドメインを使用している場合

カスタムドメイン（例: `https://example.com`）を設定している場合は、そのドメインを使用してください。

---

## ➕ ステップ4: Vercelで環境変数を追加

### 4-1. Environment Variablesページに戻る

1. **Vercelダッシュボードでプロジェクトを選択**
2. **「Settings」タブをクリック**
3. **左メニューから「Environment Variables」をクリック**

### 4-2. 最初の環境変数を追加: NEXT_PUBLIC_SUPABASE_URL

1. **「Add New」ボタンをクリック**
   - ページの右上または下部に「Add New」ボタンがあります

2. **Key（名前）を入力**
   - 「Key」または「Name」というフィールドがあります
   - 以下の文字列を**正確に**入力してください（コピー&ペースト推奨）:
     ```
     NEXT_PUBLIC_SUPABASE_URL
     ```
   - **注意事項**:
     - 大文字小文字を正確に入力してください
     - アンダースコア（_）を使用してください（ハイフンではありません）
     - 先頭や末尾にスペースを入れないでください

3. **Value（値）を入力**
   - 「Value」というフィールドがあります
   - ステップ2-4でコピーした「Project URL」を貼り付けます
   - 例: `https://abcdefghijklmnop.supabase.co`
   - **注意事項**:
     - `https://` から始まる完全なURLを入力してください
     - 末尾に `/`（スラッシュ）は**付けないでください**
     - 余分なスペースを入れないでください

4. **Environment（環境）を選択**
   - 「Environment」または「Environments」というセクションがあります
   - 以下の3つすべてにチェックを入れてください:
     - ☑ **Production**（本番環境）
     - ☑ **Preview**（プレビュー環境）
     - ☑ **Development**（開発環境）
   - **重要**: すべての環境にチェックを入れることで、どの環境でもこの環境変数が使用されます

5. **「Save」ボタンをクリック**
   - 入力内容を確認したら、「**Save**」または「**Add**」ボタンをクリック
   - 環境変数が追加されたことを確認してください

### 4-3. 2番目の環境変数を追加: NEXT_PUBLIC_SUPABASE_ANON_KEY

1. **再度「Add New」ボタンをクリック**

2. **Key（名前）を入力**
   - 以下の文字列を入力:
     ```
     NEXT_PUBLIC_SUPABASE_ANON_KEY
     ```

3. **Value（値）を入力**
   - ステップ2-4でコピーした「anon public」キーを貼り付けます
   - 値は長い文字列です（`eyJ...` で始まる）

4. **Environment（環境）を選択**
   - ☑ Production
   - ☑ Preview
   - ☑ Development

5. **「Save」ボタンをクリック**

### 4-4. 3番目の環境変数を追加: SUPABASE_SERVICE_ROLE_KEY

1. **再度「Add New」ボタンをクリック**

2. **Key（名前）を入力**
   - 以下の文字列を入力:
     ```
     SUPABASE_SERVICE_ROLE_KEY
     ```

3. **Value（値）を入力**
   - ステップ2-4でコピーした「service_role」キーを貼り付けます
   - ⚠️ このキーは機密情報です。取り扱いに注意してください

4. **Environment（環境）を選択**
   - ☑ Production
   - ☑ Preview
   - ☑ Development

5. **「Save」ボタンをクリック**

### 4-5. 4番目の環境変数を追加: NEXT_PUBLIC_SITE_URL（推奨）

1. **再度「Add New」ボタンをクリック**

2. **Key（名前）を入力**
   - 以下の文字列を入力:
     ```
     NEXT_PUBLIC_SITE_URL
     ```

3. **Value（値）を入力**
   - ステップ3で確認したデプロイされたサイトのURLを入力します
   - 例: `https://real-review.vercel.app`
   - **注意事項**:
     - `https://` から始まる完全なURLを入力してください
     - 末尾に `/`（スラッシュ）は**付けないでください**

4. **Environment（環境）を選択**
   - ☑ Production
   - ☑ Preview
   - ☑ Development

5. **「Save」ボタンをクリック**

---

## ✅ ステップ5: 環境変数の設定を確認

### 5-1. 環境変数の一覧を確認

1. **Environment Variablesページで、以下の4つの環境変数が表示されているか確認**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL`

2. **各環境変数の値が正しいか確認**
   - Value列に値が表示されているか確認
   - 値が「••••••」のように隠されている場合は、問題ありません（セキュリティのため）

3. **各環境変数がすべての環境に設定されているか確認**
   - Environments列に「Production, Preview, Development」と表示されているか確認

### 5-2. 既存の環境変数を編集する場合

1. **環境変数の行の右側にある「...」メニューをクリック**
2. **「Edit」を選択**
3. **ValueやEnvironmentを変更**
4. **「Save」をクリック**

### 5-3. 既存の環境変数を削除する場合

1. **環境変数の行の右側にある「...」メニューをクリック**
2. **「Delete」を選択**
3. **確認ダイアログで「Delete」をクリック**

---

## 🔄 ステップ6: 再デプロイ

環境変数を追加・変更した後は、**必ず再デプロイが必要**です。

### 方法1: 手動で再デプロイ

1. **Vercelダッシュボードで「Deployments」タブをクリック**
2. **最新のデプロイメントの右側にある「...」メニュー（3つの点）をクリック**
3. **「Redeploy」を選択**
4. **確認ダイアログで「Redeploy」ボタンをクリック**
5. **デプロイが完了するまで待つ**（通常1-2分）

### 方法2: 新しいコミットをプッシュ（推奨）

1. **ローカルで新しいコミットを作成**
   ```bash
   git commit --allow-empty -m "Trigger redeploy after env vars update"
   git push origin main
   ```

2. **Vercelが自動的に再デプロイを開始**
   - GitHubにプッシュすると、Vercelが自動的に検知して再デプロイを開始します

---

## ✅ ステップ7: 動作確認

### 7-1. デプロイ完了を確認

1. **「Deployments」タブで最新のデプロイメントの状態を確認**
   - 「Ready」（緑色）になっていることを確認

### 7-2. サイトにアクセスして確認

1. **デプロイされたサイトにアクセス**
   - 例: `https://real-review.vercel.app`

2. **管理画面にアクセス**
   - `https://real-review.vercel.app/admin/schools` にアクセス
   - 「学校一覧の取得に失敗しました」というエラーが表示されなくなったか確認

3. **オートコンプリート機能を確認**
   - `/survey` ページにアクセス
   - 学校名の入力欄に文字を入力
   - 候補が表示されるか確認

### 7-3. ブラウザのコンソールで確認

1. **ブラウザの開発者ツールを開く**（F12キー）
2. **「Console」タブを開く**
3. **エラー（赤色）が表示されていないか確認**

### 7-4. VercelのFunctionログで確認

1. **Vercelダッシュボードで「Deployments」タブを開く**
2. **最新のデプロイメントを選択**
3. **「Functions」タブを開く**
4. **`/api/admin/schools` を選択**
5. **「Logs」タブでエラーがないか確認**

---

## 🔍 トラブルシューティング

### 問題1: 「Add New」ボタンが見つからない

**原因**: 権限がない可能性があります

**解決方法**:
- Vercelのプロジェクトのオーナーまたは管理者権限があるか確認してください
- 権限がない場合は、プロジェクトのオーナーに依頼してください

### 問題2: 環境変数を追加してもエラーが続く

**確認事項**:
1. 環境変数の値が正しいか確認
   - Supabaseダッシュボードで再度確認してください
   - コピー&ペーストの際に余分なスペースが入っていないか確認
2. すべての環境（Production, Preview, Development）に設定されているか確認
3. 再デプロイを実行したか確認
   - 環境変数を追加しただけでは反映されません。必ず再デプロイが必要です

### 問題3: Valueが長すぎて入力できない

**解決方法**:
- 値が非常に長い場合でも、すべての文字をコピー&ペーストしてください
- 途中で切れていないか確認してください

### 問題4: 環境変数が表示されない

**確認事項**:
1. 正しいプロジェクトを選択しているか確認
2. ページをリロード（F5キー）してみてください
3. ブラウザのキャッシュをクリアしてみてください

---

## 📝 チェックリスト

環境変数の設定が完了したら、以下のチェックリストで確認してください：

- [ ] `NEXT_PUBLIC_SUPABASE_URL` が追加されている
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` が追加されている
- [ ] `SUPABASE_SERVICE_ROLE_KEY` が追加されている
- [ ] `NEXT_PUBLIC_SITE_URL` が追加されている（推奨）
- [ ] すべての環境変数が「Production, Preview, Development」すべてに設定されている
- [ ] 再デプロイを実行した
- [ ] デプロイが完了し、「Ready」状態になっている
- [ ] `/admin/schools` ページが正常に表示される
- [ ] オートコンプリート機能が動作する
- [ ] ブラウザのコンソールにエラーが表示されない

---

## 🎉 完了！

すべての環境変数が正しく設定され、再デプロイが完了すれば、アプリケーションが正常に動作するはずです！

問題が続く場合は、エラーメッセージの詳細を共有してください。
