# ダミーデータ削除ガイド

## 概要

このガイドでは、CSVファイルに含まれる学校のみを残し、それ以外の学校と関連データを削除する手順を説明します。

## 前提条件

1. CSVファイル（`20260108_通信制高校一覧（加工版）.csv`）がプロジェクトルートに存在すること
2. 環境変数（`.env.local`）が正しく設定されていること
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. **重要**: 削除実行前にSupabaseダッシュボードでバックアップを取得すること

## 実行手順

### 1. バックアップの取得

Supabaseダッシュボードからデータベースのバックアップを取得してください。

**詳細な手順**: `SUPABASE_BACKUP_GUIDE.md`を参照してください。

**最小限のバックアップ（推奨）**:
1. `schools`テーブルをCSVエクスポート
2. `survey_responses`テーブルをCSVエクスポート

**手順（簡単版）**:
1. Supabaseダッシュボード → 「Table Editor」
2. `schools`テーブルを選択 → 「...」メニュー → 「Export as CSV」
3. `survey_responses`テーブルを選択 → 「...」メニュー → 「Export as CSV」

### 2. 削除スクリプトの実行

```bash
npm run delete-dummy-data
```

### 3. 確認プロンプト

スクリプトは削除前に以下の情報を表示します：

- 保持する学校数
- 削除対象の学校数
- 削除される口コミ数
- 削除されるいいね数
- 削除される別名数
- 削除対象の学校一覧（最初の20件）

確認後、`y`を入力して削除を実行します。

## 削除前後の確認クエリ

### 削除前の確認

```sql
-- 全学校数
SELECT COUNT(*) as total_schools FROM schools;

-- CSVに含まれる学校数（確認用）
-- 注: CSVファイルの学校名を正規化して照合する必要があります
SELECT COUNT(*) as csv_schools 
FROM schools 
WHERE name_normalized IN (
  -- CSVファイルの学校名を正規化したリスト
  -- スクリプト実行時に表示される保持対象の学校名を使用
);

-- 削除対象の学校数
SELECT COUNT(*) as schools_to_delete 
FROM schools 
WHERE name_normalized NOT IN (
  -- CSVファイルの学校名を正規化したリスト
);

-- 削除対象の学校一覧
SELECT id, name, name_normalized, status 
FROM schools 
WHERE name_normalized NOT IN (
  -- CSVファイルの学校名を正規化したリスト
)
ORDER BY name;

-- 削除対象の学校に関連する口コミ数
SELECT COUNT(*) as responses_to_delete
FROM survey_responses
WHERE school_id IN (
  SELECT id FROM schools 
  WHERE name_normalized NOT IN (
    -- CSVファイルの学校名を正規化したリスト
  )
);

-- 削除対象の学校に関連する口コミの詳細
SELECT sr.id, sr.school_id, s.name as school_name, sr.created_at
FROM survey_responses sr
JOIN schools s ON sr.school_id = s.id
WHERE s.name_normalized NOT IN (
  -- CSVファイルの学校名を正規化したリスト
)
ORDER BY sr.created_at DESC;
```

### 削除後の確認

```sql
-- 残存する学校数
SELECT COUNT(*) as remaining_schools FROM schools;

-- 残存する学校一覧
SELECT id, name, name_normalized, status 
FROM schools 
ORDER BY name;

-- 残存する口コミ数
SELECT COUNT(*) as remaining_responses FROM survey_responses;

-- 学校ごとの口コミ数
SELECT s.id, s.name, COUNT(sr.id) as review_count
FROM schools s
LEFT JOIN survey_responses sr ON s.id = sr.school_id
GROUP BY s.id, s.name
ORDER BY review_count DESC;

-- 口コミが紐づいていない学校（確認用）
SELECT s.id, s.name, s.status
FROM schools s
LEFT JOIN survey_responses sr ON s.id = sr.school_id
WHERE sr.id IS NULL
ORDER BY s.name;
```

## 削除されるデータ

以下のデータが削除されます：

1. **schoolsテーブル**: CSVに含まれない学校
2. **survey_responsesテーブル**: 削除対象の学校に関連する口コミ
3. **review_likesテーブル**: 削除された口コミに関連するいいね（存在する場合）
4. **school_aliasesテーブル**: 削除対象の学校に関連する別名（CASCADEで自動削除）

## 注意事項

1. **不可逆的な操作**: 削除は元に戻せません。必ずバックアップを取得してください。
2. **関連データ**: 削除対象の学校に関連する口コミもすべて削除されます。
3. **確認**: 削除前に表示される削除対象の学校一覧を必ず確認してください。
4. **実行タイミング**: デプロイ前に実行することを推奨します。

## トラブルシューティング

### エラー: 環境変数が設定されていません

`.env.local`ファイルに以下が設定されているか確認してください：

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### エラー: CSVファイルが見つかりません

CSVファイルがプロジェクトルートに存在するか確認してください：

- ファイル名: `20260108_通信制高校一覧（加工版）.csv`
- 場所: プロジェクトルート（`survey-app`フォルダ）

### 削除後に集計データが正しくない場合

削除後、集計データを再計算してください：

```bash
npm run recalculate-aggregates
```

## 関連スクリプト

- `npm run seed:schools`: CSVから学校データを投入
- `npm run recalculate-aggregates`: 集計データを再計算
- `npm run check-env`: 環境変数の確認
