# Cursorで.env.localファイルを作成する方法

## ステップバイステップ手順

### ステップ1: ファイルを作成

1. **Cursorの左側のエクスプローラーを確認**
   - 左側のサイドバーにファイル一覧が表示されているはずです
   - `survey-app`フォルダが表示されていることを確認

2. **新しいファイルを作成**
   - 左側のエクスプローラーで`survey-app`フォルダを**右クリック**
   - メニューから「**新しいファイル**」を選択
   - ファイル名を **`.env.local`** と入力（先頭のドット（.）を含める）
   - Enterキーを押す

### ステップ2: 内容を入力

1. **ファイルが開かれる**
   - `.env.local`ファイルがエディタで開かれます

2. **以下の内容をコピー＆ペースト**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

### ステップ3: Supabaseの実際の値に置き換え

1. **Supabaseのダッシュボードを開く**
   - [https://supabase.com](https://supabase.com) にアクセス
   - ログインしてプロジェクトを選択

2. **API設定を開く**
   - 左メニューから「**Settings**」をクリック
   - 「**API**」をクリック

3. **値をコピー**
   - **Project URL** をコピー
     - 例: `https://abcdefghijklmnop.supabase.co`
   - **anon public** キーをコピー
     - 長い文字列です（`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`のような形式）
   - **service_role** キーをコピー
     - これも長い文字列です（⚠️ 機密情報なので注意）

4. **.env.localファイルに貼り付け**
   - `.env.local`ファイルを開いたまま
   - `your-project-id.supabase.co` の部分を実際のProject URLに置き換え
   - `your_anon_key_here` を実際のanon publicキーに置き換え
   - `your_service_role_key_here` を実際のservice_roleキーに置き換え

   完成例：
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODk2NzI5MCwiZXhwIjoxOTU0NTQzMjkwfQ.example
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjM4OTY3MjkwLCJleHAiOjE5NTQ1NDMyOTB9.example
   ```

### ステップ4: 保存

- **Ctrl + S**（Windows）または **Cmd + S**（Mac）で保存
- または、メニューから「ファイル」→「保存」

### ステップ5: 開発サーバーを再起動

環境変数を設定した後は、開発サーバーを再起動する必要があります：

1. **ターミナルで開発サーバーを停止**
   - ターミナルで **Ctrl + C** を押す

2. **再度起動**
   ```bash
   cd survey-app
   npm run dev
   ```

## 確認方法

ファイルが正しく作成されたか確認するには：

1. **Cursorのエクスプローラーで確認**
   - 左側のファイル一覧に`.env.local`が表示されているか確認
   - ファイル名の前にドット（.）が付いていることを確認

2. **ファイル内容を確認**
   - `.env.local`ファイルを開いて、3行すべてに値が入っているか確認
   - `your-project-id`や`your_anon_key_here`などのプレースホルダーが残っていないか確認

## トラブルシューティング

### ファイル名にドットが付けられない場合

- ファイル名を入力する際、最初にドット（.）を入力してから`env.local`と続けて入力してください
- 例: `.` → `env` → `.` → `local` ではなく、`.env.local`と一気に入力

### ファイルが見えない場合

- Cursorのエクスプローラーで「**表示**」→「**隠しファイルを表示**」を確認
- `.env.local`は隠しファイルとして扱われる場合があります

### 保存できない場合

- ファイルが読み取り専用になっていないか確認
- Cursorを管理者権限で実行してみてください

## 重要な注意事項

- ✅ ファイル名は正確に **`.env.local`** にしてください（先頭のドットを含む）
- ✅ 拡張子は不要です（`.env.local.txt`ではなく`.env.local`）
- ✅ 各行の`=`の前後にスペースは不要です
- ✅ 値に引用符（`"`や`'`）は付けないでください
- ⚠️ このファイルはGitにコミットしないでください（既に`.gitignore`に含まれています）
- ⚠️ `SUPABASE_SERVICE_ROLE_KEY`は機密情報なので、絶対に公開しないでください


