# Supabaseバックアップ取得ガイド

## 概要

Supabaseダッシュボードからデータをバックアップする方法を説明します。削除スクリプト実行前のバックアップとして、以下の方法を推奨します。

## 方法1: Table EditorからCSVエクスポート（最も簡単・推奨）

### 手順

#### 1. schoolsテーブルのバックアップ

1. Supabaseダッシュボードにログイン
2. 左側のメニューから「**Table Editor**」をクリック
3. `schools`テーブルを選択
4. テーブルの右上にある「**...**」（三点リーダー）メニューをクリック
5. 「**Export as CSV**」または「**Download CSV**」を選択
6. CSVファイルがダウンロードされます（例: `schools.csv`）

#### 2. survey_responsesテーブルのバックアップ

1. 同じく「**Table Editor**」で`survey_responses`テーブルを選択
2. 右上の「**...**」メニューから「**Export as CSV**」を選択
3. CSVファイルをダウンロード（例: `survey_responses.csv`）

#### 3. その他のテーブル（必要に応じて）

以下のテーブルも同様にエクスポートできます：
- `school_aliases`
- `review_likes`（存在する場合）
- `contact_messages`（存在する場合）
- `contact_settings`（存在する場合）

**注意**: 大量のデータがある場合、CSVエクスポートに時間がかかる場合があります。

## 方法2: SQL Editorからデータエクスポート

### 手順

1. Supabaseダッシュボードで「**SQL Editor**」を開く
2. 「**New query**」をクリック
3. 以下のSQLを実行：

```sql
-- schoolsテーブルの全データを取得
SELECT * FROM schools ORDER BY name;
```

4. 結果の右上にある「**Download**」ボタンまたは「**Export**」ボタンをクリック
5. 「**CSV**」形式を選択してダウンロード

### 複数テーブルを一度にエクスポート

```sql
-- 主要テーブルのデータを確認
SELECT 
  'schools' as table_name,
  COUNT(*) as record_count
FROM schools
UNION ALL
SELECT 
  'survey_responses' as table_name,
  COUNT(*) as record_count
FROM survey_responses
UNION ALL
SELECT 
  'school_aliases' as table_name,
  COUNT(*) as record_count
FROM school_aliases;
```

## 方法3: pg_dumpを使用した完全バックアップ（上級者向け）

PostgreSQLの`pg_dump`コマンドを使用して、データベース全体をバックアップできます。

### 前提条件

- PostgreSQLクライアントツールがインストールされていること
- Supabaseの接続情報（ホスト、ポート、データベース名、ユーザー名、パスワード）

### 接続情報の取得

1. Supabaseダッシュボードで「**Settings**」→「**Database**」を開く
2. 「**Connection string**」セクションで接続情報を確認
   - または「**Connection pooling**」セクションで接続文字列を取得

### pg_dumpの実行

```bash
# 接続文字列を使用する場合
pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres" > backup.sql

# または個別パラメータを使用
pg_dump -h [HOST] -p [PORT] -U postgres -d postgres -F p -f backup.sql
```

**注意**: 
- `[PASSWORD]`、`[HOST]`、`[PORT]`を実際の値に置き換えてください
- パスワードは接続文字列に含めるか、実行時に入力します
- バックアップファイルは安全な場所に保存してください

## 削除スクリプト実行前の推奨バックアップ手順

### 最小限のバックアップ（推奨）

削除スクリプト実行前に、最低限以下のテーブルをバックアップしてください：

1. **schools**テーブル（CSVエクスポート）
2. **survey_responses**テーブル（CSVエクスポート）

### 完全なバックアップ

すべてのテーブルをバックアップする場合：

1. `schools`
2. `survey_responses`
3. `school_aliases`
4. `review_likes`（存在する場合）
5. `contact_messages`（存在する場合）
6. `contact_settings`（存在する場合）
7. `articles`（存在する場合）

## バックアップファイルの保存

- バックアップファイルは安全な場所に保存してください
- ファイル名に日付を含めることを推奨（例: `schools_20260108.csv`）
- バックアップファイルは`.gitignore`に含まれているため、Gitにはコミットされません

## バックアップからの復元方法

### CSVから復元（Table Editor使用）

1. Supabaseダッシュボードで「**Table Editor**」を開く
2. 対象のテーブルを選択
3. 「**Insert**」→「**Import data from CSV**」を選択
4. バックアップしたCSVファイルをアップロード

**注意**: 
- 既存のデータと競合する場合は、事前にテーブルをクリアする必要があります
- 外部キー制約がある場合は、参照先のテーブルから復元してください

### SQLから復元（pg_dump使用）

```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres" < backup.sql
```

## トラブルシューティング

### CSVエクスポートが遅い

大量のデータがある場合、CSVエクスポートに時間がかかることがあります。その場合は：
- SQL Editorで`LIMIT`を使用してデータを分割してエクスポート
- または`pg_dump`を使用

### エクスポートが失敗する

- ブラウザをリフレッシュして再試行
- 別のブラウザで試す
- SQL Editorから直接エクスポートを試す

## 関連ドキュメント

- [Supabase公式ドキュメント - Database Backups](https://supabase.com/docs/guides/platform/backups)
- [PostgreSQL公式ドキュメント - pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
