# .env.localファイルの作成方法（詳細手順）

## 方法1: Cursor（またはVS Code）で作成（最も簡単）

### 手順

1. **Cursorでプロジェクトを開く**
   - Cursorを起動
   - `survey-app`フォルダを開く（既に開いている場合はそのまま）

2. **新しいファイルを作成**
   - 左側のエクスプローラー（ファイル一覧）で`survey-app`フォルダを右クリック
   - 「新しいファイル」をクリック
   - ファイル名を **`.env.local`** と入力（先頭のドット（.）を含める）

3. **内容を入力**
   以下の内容をコピー＆ペーストしてください：

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

4. **実際の値を設定**
   - `https://your-project-id.supabase.co` を Supabase の Project URL に置き換え
   - `your_anon_key_here` を Supabase の anon public キーに置き換え
   - `your_service_role_key_here` を Supabase の service_role キーに置き換え

5. **保存**
   - Ctrl + S で保存

## 方法2: エクスプローラーで作成

### 手順

1. **エクスプローラーを開く**
   - Windowsキー + E でエクスプローラーを開く
   - 以下のパスに移動：
     ```
     C:\Users\taka-\OneDrive\デスクトップ\project\delta-recruit-static-starter\survey-app
     ```

2. **テキストファイルを作成**
   - フォルダ内の空白部分を右クリック
   - 「新規作成」→「テキスト ドキュメント」をクリック
   - ファイル名を **`env.local.txt`** に変更（Enterキーを押す）

3. **ファイル名を変更**
   - 作成したファイルを右クリック
   - 「名前の変更」をクリック
   - ファイル名を **`.env.local`** に変更（先頭にドットを付ける）
   - 「拡張子を変更すると、ファイルが使えなくなる可能性があります」と表示されたら「はい」をクリック

4. **内容を入力**
   - ファイルをダブルクリックして開く（メモ帳で開かれます）
   - 以下の内容をコピー＆ペースト：

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

5. **実際の値を設定して保存**
   - 実際のSupabaseの値に置き換え
   - Ctrl + S で保存

## 方法3: コマンドプロンプトで作成

### 手順

1. **コマンドプロンプトを開く**
   - Windowsキー + R
   - `cmd` と入力してEnter

2. **survey-appフォルダに移動**
   ```
   cd C:\Users\taka-\OneDrive\デスクトップ\project\delta-recruit-static-starter\survey-app
   ```

3. **ファイルを作成**
   ```
   echo. > .env.local
   ```

4. **ファイルを編集**
   - エクスプローラーで`.env.local`ファイルを開く
   - または、VS Codeで開いて編集

## 重要な注意事項

- **ファイル名は正確に `.env.local` にしてください**（先頭のドットを含む）
- **拡張子は不要です**（`.env.local.txt`ではなく`.env.local`）
- **実際のSupabaseの値に置き換える必要があります**
- **このファイルはGitにコミットしないでください**（既に`.gitignore`に含まれています）

## Supabaseの値の取得方法

1. [Supabase](https://supabase.com)にログイン
2. プロジェクトを選択
3. 左メニューから「Settings」→「API」をクリック
4. 以下の値をコピー：
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`に設定
   - **anon public** キー → `NEXT_PUBLIC_SUPABASE_ANON_KEY`に設定
   - **service_role** キー → `SUPABASE_SERVICE_ROLE_KEY`に設定

## 設定後の確認

ファイルを作成したら、以下のコマンドで確認できます：

```bash
cd survey-app
type .env.local
```

（PowerShellの場合は `Get-Content .env.local`）

## トラブルシューティング

### ファイル名にドットが付けられない場合

1. エクスプローラーの「表示」タブを開く
2. 「ファイル名拡張子」にチェックを入れる
3. 再度ファイル名を変更

### ファイルが見えない場合

- エクスプローラーの「表示」タブで「隠しファイル」にチェックを入れる
- `.env.local`は隠しファイルとして扱われる場合があります

