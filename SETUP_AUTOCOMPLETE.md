# 学校名オートコンプリート機能 セットアップ手順

このドキュメントでは、学校名オートコンプリート機能を有効にするための手順を説明します。

## 前提条件

- Supabaseプロジェクトが設定済みであること
- Supabaseのダッシュボードにアクセスできること
- `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` が環境変数に設定されていること

## 簡易チェックリスト

- [ ] 手順1: SQLマイグレーションを4つ実行
  - [ ] `add-school-master-fields.sql`
  - [ ] `create-school-aliases.sql`（関数作成も忘れずに）
  - [ ] `add-school-fields-to-survey.sql`
  - [ ] `enable-pg-trgm.sql`
- [ ] 手順2: `npm install` で依存関係をインストール
- [ ] 手順3: 環境変数の確認（`.env.local`に設定済みか）
- [ ] 手順4: 初期データ投入（`npm run seed:schools`）
- [ ] 手順5: 動作確認（`npm run dev`でアンケートフォームをテスト）

## 手順1: SQLマイグレーションファイルの実行

SupabaseのSQL Editorで、以下の順序でマイグレーションファイルを実行してください。

### 1-1. `add-school-master-fields.sql` の実行

**目的**: `schools`テーブルに`name_normalized`、`status`、`prefectures`カラムを追加

1. Supabaseダッシュボードにログイン
2. 左メニューから「SQL Editor」を選択
3. 「New query」をクリック
4. `supabase-migrations/add-school-master-fields.sql` の内容をコピー＆ペースト
5. 「Run」ボタンをクリックして実行
6. エラーが出ないことを確認（既存データがある場合は警告が表示される場合がありますが、問題ありません）

**確認**: 実行後、`schools`テーブルに以下のカラムが追加されていることを確認
- `name_normalized` (TEXT NOT NULL)
- `status` (TEXT NOT NULL, DEFAULT 'active')
- `prefectures` (TEXT[])

### 1-2. `create-school-aliases.sql` の実行

**目的**: `school_aliases`テーブルを作成（学校の別名・表記ゆれを管理）

1. SQL Editorで新しいクエリを作成
2. `supabase-migrations/create-school-aliases.sql` の内容をコピー＆ペースト
3. 「Run」ボタンをクリックして実行

**注意**: `update_updated_at_column()` 関数が存在しない場合は、以下の関数を先に作成してください：

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 1-3. `add-school-fields-to-survey.sql` の実行

**目的**: `survey_responses`テーブルに`school_id`、`school_name_input`カラムを追加

1. SQL Editorで新しいクエリを作成
2. `supabase-migrations/add-school-fields-to-survey.sql` の内容をコピー＆ペースト
3. 「Run」ボタンをクリックして実行

**確認**: 実行後、`survey_responses`テーブルに以下のカラムが追加されていることを確認
- `school_id` (UUID, NULL許可)
- `school_name_input` (TEXT, NULL許可)

### 1-4. `enable-pg-trgm.sql` の実行

**目的**: `pg_trgm`拡張を有効化し、曖昧検索を高速化するためのインデックスを作成

1. SQL Editorで新しいクエリを作成
2. `supabase-migrations/enable-pg-trgm.sql` の内容をコピー＆ペースト
3. 「Run」ボタンをクリックして実行

**注意**: SupabaseのFreeプランでは`pg_trgm`拡張が利用できない場合があります。その場合は、このマイグレーションをスキップしても動作しますが、検索パフォーマンスが低下する可能性があります。

## 手順2: 依存関係のインストール

プロジェクトルートで以下のコマンドを実行してください：

```bash
npm install
```

このコマンドで、既存の依存関係に加えて、`tsx`がインストールされます（`seed:schools`スクリプトの実行に必要）。

## 手順3: 環境変数の確認

`.env.local`ファイル（または環境変数設定ファイル）に以下が設定されていることを確認してください：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

`SUPABASE_SERVICE_ROLE_KEY`は、初期データ投入スクリプトを実行するために必要です（サービスロールキーは管理者権限が必要な操作に使用されます）。

## 手順4: 初期データの投入（オプション）

### 4-1. CSVファイルの準備

`20260108_通信制高校一覧（加工版）.csv` ファイルを準備してください。

**CSVファイルの配置方法（優先順位順）**:

1. **環境変数で指定（推奨）**: `.env.local`に以下を追加
   ```env
   CSV_FILE_PATH=C:\path\to\20260108_通信制高校一覧（加工版）.csv
   ```

2. **プロジェクトルートに配置**: プロジェクトルート（`package.json`がある場所）にCSVファイルを配置

3. **デフォルトパス**: 以下のパスに配置
   ```
   ../Career Essence/通信制メディア/20260108_通信制高校一覧（加工版）.csv
   ```

**CSVファイルの形式**:
- 1行目: ヘッダー行（`学校名（ユニーク）`など）
- 2行目以降: 学校名（1列目）

### 4-2. CSVファイルのパスを修正（必要に応じて）

プロジェクトルートにCSVファイルを配置する場合は、`scripts/seedSchoolsFromCsv.ts`の25行目を以下のように修正してください：

```typescript
// 修正前
const csvPath = join(process.cwd(), '..', 'Career Essence', '通信制メディア', '20260108_通信制高校一覧（加工版）.csv');

// 修正後（プロジェクトルートに配置する場合）
const csvPath = join(process.cwd(), '20260108_通信制高校一覧（加工版）.csv');
```

### 4-3. 初期データ投入スクリプトの実行

```bash
npm run seed:schools
```

**実行結果の確認**:
- 成功: 各学校名が追加されたことを示すログが表示されます
- スキップ: 既に存在する学校名はスキップされます
- エラー: エラーが発生した場合は、ログを確認して問題を解決してください

**注意**: 
- 既存の`schools`テーブルにデータがある場合、`name_normalized`が正しく設定されていない可能性があります
- その場合は、既存データに対して`name_normalized`を更新する必要があります

## 手順5: 既存データの移行（オプション）

既存の`survey_responses`テーブルに`school_name`データがある場合、それらを`schools`テーブルに移行することができます。

### 5-1. 移行スクリプトの実行

```bash
npm run migrate:schools
```

このスクリプトは：
1. `survey_responses`からユニークな`school_name`を取得
2. 各学校名に対して`schools`テーブルにエントリを作成（`status='active'`）
3. `survey_responses`の`school_id`を更新

**注意**: 
- このスクリプトは既存データを変更します
- 実行前にデータベースのバックアップを取ることを推奨します

## 手順6: 動作確認

### 6-1. 開発サーバーの起動

```bash
npm run dev
```

### 6-2. アンケートフォームでのテスト

1. `http://localhost:3000/survey` にアクセス
2. 学校名入力欄で以下をテスト：
   - **オートコンプリート**: 学校名を入力すると、候補が表示されることを確認
   - **候補選択**: 候補をクリックすると、選択された状態になることを確認
   - **新規追加**: 候補がない場合、「追加して続ける」が表示され、クリックで新規追加できることを確認
   - **送信**: アンケートを送信し、`survey_responses`に`school_id`が保存されることを確認

### 6-3. 管理画面での確認

1. `/admin/schools` にアクセス
2. 以下を確認：
   - 学校一覧が表示される
   - `status`フィルタが機能する
   - `prefecture`フィルタが機能する
   - 各学校の編集ページで`status`変更、`alias`管理、統合機能が使用できる

## トラブルシューティング

### マイグレーション実行時のエラー

**エラー: "column already exists"**
- 既にカラムが存在している場合は、`IF NOT EXISTS`句によりスキップされます。問題ありません。

**エラー: "function update_updated_at_column() does not exist"**
- `create-school-aliases.sql`を実行する前に、手順1-2で説明した関数を作成してください。

### 初期データ投入時のエラー

**エラー: "環境変数が設定されていません"**
- `.env.local`ファイルに`NEXT_PUBLIC_SUPABASE_URL`と`SUPABASE_SERVICE_ROLE_KEY`が設定されていることを確認してください。

**エラー: "CSVファイルが見つかりません"**
- CSVファイルのパスを確認し、必要に応じて`scripts/seedSchoolsFromCsv.ts`のパスを修正してください。

### オートコンプリートが動作しない

**候補が表示されない**
- ブラウザの開発者ツールでネットワークタブを確認し、`/api/schools/search`へのリクエストが正常に返ってきているか確認してください
- `schools`テーブルにデータが存在することを確認してください
- `name_normalized`が正しく設定されているか確認してください

**検索が遅い**
- `pg_trgm`拡張が有効になっているか確認してください
- `idx_schools_name_normalized_trgm`インデックスが作成されているか確認してください

## 次のステップ

セットアップが完了したら：

1. 既存の`school_name`データに対して`name_normalized`を更新（必要に応じて）
2. 管理画面で`pending`状態の学校を`active`に変更
3. 重複している学校を統合機能でマージ

## 参考資料

- [Supabase SQL Editor ドキュメント](https://supabase.com/docs/guides/database/overview)
- [pg_trgm 拡張 ドキュメント](https://www.postgresql.org/docs/current/pgtrgm.html)

