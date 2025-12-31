# Epic1 SQL実行ガイド

このガイドでは、Epic1で必要なSQLを実行する手順を説明します。

## 実行するSQLファイル

以下の4つのSQLファイルを**順番に**実行してください：

1. `docs/epic1-01-schools.sql` - schoolsテーブルの作成
2. `docs/epic1-02-survey-responses-alter.sql` - survey_responsesテーブルの拡張
3. `docs/epic1-03-aggregates.sql` - aggregatesテーブルの作成
4. `docs/epic1-04-backfill.sql` - 既存データの移行

## 実行手順

### Step 1: SupabaseのSQL Editorを開く

1. Supabaseダッシュボードにログイン
2. 左側のメニューから「**SQL Editor**」をクリック
3. 「**New query**」ボタンをクリック（新しいクエリを作成）

### Step 2: SQLファイルを開く

エクスプローラー（またはファイルマネージャー）で以下のファイルを開きます：

- `C:\Users\taka-\OneDrive\デスクトップ\project\survey-app\docs\epic1-01-schools.sql`

### Step 3: SQLをコピー＆ペースト

1. SQLファイルをメモ帳やVS Codeで開く
2. **ファイル全体を選択**（Ctrl+A）
3. **コピー**（Ctrl+C）
4. SupabaseのSQL Editorのクエリエリアに**貼り付け**（Ctrl+V）

### Step 4: SQLを実行

1. SQL Editorの「**RUN**」ボタン（または**Ctrl+Enter**）をクリック
2. 「Success. No rows returned」または「Success. X rows returned」というメッセージが表示されれば成功です

### Step 5: 次のSQLファイルを実行

Step 2〜4を繰り返して、残りの3つのSQLファイルを実行します：

- `docs/epic1-02-survey-responses-alter.sql`
- `docs/epic1-03-aggregates.sql`
- `docs/epic1-04-backfill.sql`

## 重要な注意事項

### ✅ 正しい手順

1. **各SQLファイルを個別に実行する**
   - 1つずつファイルを開いて、コピー＆ペーストして実行
   - 複数のSQLファイルを同時に実行しない

2. **ファイル全体をコピーする**
   - SQLファイルを開いたら、**Ctrl+A（全選択）** → **Ctrl+C（コピー）**
   - ファイルの最初の行から最後の行まで、全てをコピー

3. **SQL Editorをクリアしてから貼り付け**
   - 新しいクエリを作成するか、既存のクエリを**Ctrl+A（全選択）** → **Delete（削除）**
   - その後、**Ctrl+V（貼り付け）**

### ❌ 間違った手順（エラーの原因）

1. **TypeScriptファイルをコピーしてしまう**
   - `lib/utils.ts`や`app/api/submit/route.ts`などのTypeScriptファイルはコピーしない
   - **SQLファイル（.sql）のみ**をコピーしてください

2. **複数のファイルを同時にコピーする**
   - 1つのファイルだけを開いて、そのファイルの内容だけをコピーしてください

3. **ファイルの一部だけをコピーする**
   - SQLファイルの**最初の行から最後の行まで全て**をコピーしてください

## 実行後の確認

### 4つのSQLファイル全てを実行したら

`docs/epic1-04-backfill.sql`の最後に含まれている確認クエリが自動的に実行されます。
結果を確認してください：

1. **schoolsテーブルの学校数**
   - `school_count` が表示されます

2. **school_idが設定されている口コミ数**
   - `review_count_with_school_id` が表示されます

3. **検索用カラムが設定されている口コミ数**
   - 各カラムの設定数を確認できます

## トラブルシューティング

### エラー: "relation 'schools' does not exist"

→ `epic1-01-schools.sql`を先に実行してください。

### エラー: "relation 'survey_responses' does not exist"

→ 既存のテーブルが存在しない可能性があります。`supabase-schema.sql`または`supabase-schema-safe.sql`を先に実行してください。

### エラー: "column 'school_id' does not exist"

→ `epic1-02-survey-responses-alter.sql`を先に実行してください。

### エラー: "syntax error at or near '{'"

→ TypeScriptコードが混入している可能性があります。SQLファイル（.sql）のみをコピーしてください。

## 完了後の次のステップ

全てのSQLが成功したら：

1. 動作確認（新規投稿のテスト）
2. Epic2（Media MVP）の実装に進む







